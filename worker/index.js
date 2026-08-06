/**
 * LSC · Submission relay (Cloudflare Worker)
 * ---------------------------------------------------------------------------
 * Same contract as api/submit.js, for people who prefer Cloudflare's free tier
 * (email signup, no phone number required).
 *
 *   wrangler secret put GITHUB_TOKEN
 *   wrangler deploy
 *
 * Variables live in worker/wrangler.toml. Point CONFIG.relayUrl at the
 * deployed worker URL and you get real-time repository storage.
 *
 * The worker stores the ciphertext exactly as received — it can never read it.
 */

const API = 'https://api.github.com';
const ID_RE = /^LSC-\d{8}-[A-Z0-9]{4,12}$/;
const MAX_BYTES = 256 * 1024;

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

function cors(origin, allowedRaw) {
  const allowed = String(allowedRaw || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.some((a) => origin === a || (origin && origin.startsWith(a)));
  return {
    headers: {
      'Access-Control-Allow-Origin': ok ? (origin || '*') : (allowed[0] || '*'),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
    ok,
  };
}

/** Chunked base64 — spreading a 256 KB array into fromCharCode overflows the stack. */
function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const { headers, ok } = cors(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, headers);
    if (!ok) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403, headers);
    if (!env.GITHUB_TOKEN) return json({ error: 'RELAY_NOT_CONFIGURED' }, 500, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'BAD_JSON' }, 400, headers); }

    const id = String(body?.id || '');
    const envelope = body?.envelope || body;
    if (!ID_RE.test(id)) return json({ error: 'BAD_ID' }, 400, headers);

    const content = JSON.stringify(envelope, null, 2) + '\n';
    const bytes = new TextEncoder().encode(content);
    if (bytes.length > MAX_BYTES) return json({ error: 'TOO_LARGE' }, 413, headers);

    const owner = env.GITHUB_OWNER || 'Pol4720';
    const repo = env.GITHUB_REPO || 'LSC';
    const branch = env.GITHUB_BRANCH || 'main';
    const path = `data/submissions/${id}.json`;
    const url = `${API}/repos/${owner}/${repo}/contents/${path}`;
    const gh = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'lsc-relay',
    };

    const probe = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: gh });
    if (probe.status === 200) return json({ error: 'ALREADY_EXISTS', id }, 409, headers);

    const put = await fetch(url, {
      method: 'PUT',
      headers: gh,
      body: JSON.stringify({
        message: `feat(intake): new client request ${id}`,
        content: toBase64(bytes),
        branch,
      }),
    });
    if (!put.ok) {
      return json({ error: 'GITHUB_WRITE_FAILED', status: put.status, detail: (await put.text()).slice(0, 400) }, 502, headers);
    }
    const out = await put.json();
    return json({ ok: true, id, path, commit: out.commit?.sha || null }, 201, headers);
  },
};
