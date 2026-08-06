import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubRepo, GitHubError, PATHS, postToRelay } from '../../assets/js/github.js';

/** Tiny scripted fetch double: matches on method + URL substring. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {} });
    for (const r of routes) {
      if (r.method && r.method !== method) continue;
      if (!url.includes(r.match)) continue;
      if (r.once && r.used) continue;
      r.used = true;
      return response(r.status ?? 200, r.body ?? {});
    }
    return response(404, { message: 'Not Found' });
  };
  impl.calls = calls;
  return impl;
}

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => body,
});

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

test('a repo is only writable once a token is present', () => {
  const ro = new GitHubRepo({ owner: 'Pol4720', repo: 'LSC' });
  assert.equal(ro.configured, true);
  assert.equal(ro.canWrite, false);
  assert.equal(new GitHubRepo({ owner: 'a', repo: 'b', token: 't' }).canWrite, true);
  assert.equal(new GitHubRepo({}).configured, false);
});

test('the Authorization header appears only when a token is set', async () => {
  const anon = fakeFetch([{ match: '/contents/', body: { content: b64('{}'), encoding: 'base64', sha: 's', path: 'p' } }]);
  await new GitHubRepo({ owner: 'a', repo: 'b', fetchImpl: anon }).getFile('data/x.json');
  assert.ok(!('Authorization' in anon.calls[0].headers));

  const auth = fakeFetch([{ match: '/contents/', body: { content: b64('{}'), encoding: 'base64', sha: 's', path: 'p' } }]);
  await new GitHubRepo({ owner: 'a', repo: 'b', token: 'tok', fetchImpl: auth }).getFile('data/x.json');
  assert.equal(auth.calls[0].headers.Authorization, 'Bearer tok');
});

test('getFile decodes base64 UTF-8 content and returns null on 404', async () => {
  const text = '{"nombre":"María Fernández ñ"}';
  const repo = new GitHubRepo({
    owner: 'a', repo: 'b', token: 't',
    fetchImpl: fakeFetch([{ match: 'contents/data/ok.json', body: { content: b64(text), encoding: 'base64', sha: 'abc', path: 'data/ok.json', size: 9 } }]),
  });
  const file = await repo.getFile('data/ok.json');
  assert.equal(file.content, text);
  assert.equal(file.sha, 'abc');
  assert.equal(await repo.getFile('data/missing.json'), null);
});

test('listDir returns [] for a directory that does not exist yet', async () => {
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', token: 't', fetchImpl: fakeFetch([]) });
  assert.deepEqual(await repo.listDir('data/submissions'), []);
});

test('listDir maps entries and ignores non-array payloads', async () => {
  const repo = new GitHubRepo({
    owner: 'a', repo: 'b', token: 't',
    fetchImpl: fakeFetch([{
      match: 'contents/data/submissions',
      body: [{ name: 'LSC-1.json', path: 'data/submissions/LSC-1.json', sha: 's1', size: 10, type: 'file' }],
    }]),
  });
  const files = await repo.listDir('data/submissions');
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'LSC-1.json');
});

test('putFile looks up the existing sha so updates do not 409', async () => {
  const fetchImpl = fakeFetch([
    { method: 'GET', match: 'contents/data/x.json', body: { content: b64('{}'), encoding: 'base64', sha: 'OLD', path: 'data/x.json' } },
    { method: 'PUT', match: 'contents/data/x.json', status: 200, body: { content: { sha: 'NEW', path: 'data/x.json' }, commit: { sha: 'C1' } } },
  ]);
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', token: 't', branch: 'main', fetchImpl });
  const out = await repo.putFile('data/x.json', '{"a":1}', { message: 'test' });
  const put = fetchImpl.calls.find((c) => c.method === 'PUT');
  assert.equal(put.body.sha, 'OLD');
  assert.equal(put.body.branch, 'main');
  assert.equal(Buffer.from(put.body.content, 'base64').toString('utf8'), '{"a":1}');
  assert.equal(out.sha, 'NEW');
  assert.equal(out.commit, 'C1');
});

test('putFile omits sha when creating a brand-new file', async () => {
  const fetchImpl = fakeFetch([
    { method: 'PUT', match: 'contents/', body: { content: { sha: 'N' }, commit: { sha: 'C' } } },
  ]);
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', token: 't', fetchImpl });
  await repo.putJson('data/new.json', { hello: 'mundo' });
  const put = fetchImpl.calls.find((c) => c.method === 'PUT');
  assert.ok(!('sha' in put.body));
});

test('writes without a token fail fast instead of hitting the network', async () => {
  const fetchImpl = fakeFetch([]);
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', fetchImpl });
  await assert.rejects(() => repo.putFile('x.json', '{}'), /NO_TOKEN/);
  await assert.rejects(() => repo.deleteFile('x.json'), /NO_TOKEN/);
  await assert.rejects(() => repo.commitFiles([{ path: 'x', content: 'y' }]), /NO_TOKEN/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('commitFiles builds blobs, a tree, a commit and moves the ref', async () => {
  const fetchImpl = fakeFetch([
    { method: 'GET', match: 'git/ref/heads/main', body: { object: { sha: 'BASE' } } },
    { method: 'GET', match: 'git/commits/BASE', body: { tree: { sha: 'BASETREE' } } },
    { method: 'POST', match: 'git/blobs', body: { sha: 'BLOB' } },
    { method: 'POST', match: 'git/trees', body: { sha: 'TREE' } },
    { method: 'POST', match: 'git/commits', body: { sha: 'COMMIT' } },
    { method: 'PATCH', match: 'git/refs/heads/main', body: {} },
  ]);
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', token: 't', branch: 'main', fetchImpl });
  const sha = await repo.commitFiles([
    { path: 'data/crm/LSC-1.json', content: '{"stage":"new"}' },
    { path: 'data/crm/LSC-2.json', content: '{"stage":"won"}' },
  ], 'chore: sync');

  assert.equal(sha, 'COMMIT');
  const tree = fetchImpl.calls.find((c) => c.url.includes('git/trees'));
  assert.equal(tree.body.base_tree, 'BASETREE');
  assert.equal(tree.body.tree.length, 2);
  assert.equal(tree.body.tree[0].mode, '100644');
  const patch = fetchImpl.calls.find((c) => c.method === 'PATCH');
  assert.equal(patch.body.sha, 'COMMIT');
  assert.equal(patch.body.force, false);
});

test('commitFiles is a no-op for an empty change set', async () => {
  const fetchImpl = fakeFetch([]);
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', token: 't', fetchImpl });
  assert.equal(await repo.commitFiles([]), null);
  assert.equal(fetchImpl.calls.length, 0);
});

test('API errors surface as GitHubError with the status attached', async () => {
  const repo = new GitHubRepo({
    owner: 'a', repo: 'b', token: 'bad',
    fetchImpl: fakeFetch([{ match: '/repos/', status: 401, body: { message: 'Bad credentials' } }]),
  });
  await assert.rejects(() => repo.verify(), (e) => {
    assert.ok(e instanceof GitHubError);
    assert.equal(e.status, 401);
    assert.equal(e.message, 'Bad credentials');
    return true;
  });
});

test('paths with unusual characters are encoded segment by segment', async () => {
  const fetchImpl = fakeFetch([{ match: 'contents/', body: { content: b64('{}'), encoding: 'base64', sha: 's' } }]);
  const repo = new GitHubRepo({ owner: 'a', repo: 'b', token: 't', fetchImpl });
  await repo.getFile('data/sub dir/año #1.json');
  assert.ok(fetchImpl.calls[0].url.includes('data/sub%20dir/a%C3%B1o%20%231.json'));
  assert.ok(!fetchImpl.calls[0].url.includes('data%2Fsub'));
});

test('PATHS builds the documented layout', () => {
  assert.equal(PATHS.submission('LSC-1'), 'data/submissions/LSC-1.json');
  assert.equal(PATHS.crmRecord('LSC-1'), 'data/crm/LSC-1.json');
  assert.equal(PATHS.advisorKey, 'data/config/advisor-key.json');
});

test('the relay client raises the server error message', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => response(409, { error: 'ALREADY_EXISTS' });
  try {
    await assert.rejects(() => postToRelay('https://relay.test/api/submit', { id: 'x' }), /ALREADY_EXISTS/);
  } finally { globalThis.fetch = original; }
});

test('the relay client returns the parsed success body', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => response(201, { ok: true, id: 'LSC-1' });
  try {
    assert.deepEqual(await postToRelay('https://relay.test/api/submit', { id: 'LSC-1' }), { ok: true, id: 'LSC-1' });
  } finally { globalThis.fetch = original; }
});
