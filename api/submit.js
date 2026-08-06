/**
 * LSC · Submission relay (Vercel Serverless Function)
 * ---------------------------------------------------------------------------
 * Accepts a sealed envelope from the public intake form and commits it to the
 * repository, giving real-time storage without exposing any credential to the
 * browser. Deploy this project to Vercel and set:
 *
 *   GITHUB_TOKEN   fine-grained PAT, "Contents: Read and write" on this repo
 *   GITHUB_OWNER   e.g. Pol4720          (defaults to the value below)
 *   GITHUB_REPO    e.g. LSC
 *   GITHUB_BRANCH  e.g. main
 *   ALLOWED_ORIGIN e.g. https://pol4720.github.io  (comma-separated list)
 *
 * Then set relayUrl in assets/js/config.js to https://<app>.vercel.app/api/submit
 *
 * The endpoint never decrypts anything: it stores exactly the ciphertext the
 * browser produced. Even a compromised relay cannot read client data.
 */

const API = 'https://api.github.com';

const cfg = () => ({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER || 'Pol4720',
  repo: process.env.GITHUB_REPO || 'LSC',
  branch: process.env.GITHUB_BRANCH || 'main',
  allowed: (process.env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
});

const ID_RE = /^LSC-\d{8}-[A-Z0-9]{4,12}$/;
const MAX_BYTES = 256 * 1024;

function corsHeaders(origin, allowed) {
  const ok = allowed.length === 0 || allowed.some((a) => origin === a || origin?.startsWith(a));
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default async function handler(req, res) {
  const c = cfg();
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin, c.allowed);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!c.token) return res.status(500).json({ error: 'RELAY_NOT_CONFIGURED' });
  if (c.allowed.length && !c.allowed.some((a) => origin === a || origin.startsWith(a))) {
    return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'BAD_JSON' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'BAD_BODY' });

  const id = String(body.id || '');
  const envelope = body.envelope || body;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'BAD_ID' });

  const content = JSON.stringify(envelope, null, 2) + '\n';
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) return res.status(413).json({ error: 'TOO_LARGE' });

  const path = `data/submissions/${id}.json`;
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${path}`;
  const gh = {
    Authorization: `Bearer ${c.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'lsc-relay',
  };

  try {
    // Never overwrite an existing submission.
    const probe = await fetch(`${url}?ref=${encodeURIComponent(c.branch)}`, { headers: gh });
    if (probe.status === 200) return res.status(409).json({ error: 'ALREADY_EXISTS', id });

    const put = await fetch(url, {
      method: 'PUT',
      headers: gh,
      body: JSON.stringify({
        message: `feat(intake): new client request ${id}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: c.branch,
      }),
    });
    if (!put.ok) {
      const detail = await put.text();
      return res.status(502).json({ error: 'GITHUB_WRITE_FAILED', status: put.status, detail: detail.slice(0, 400) });
    }
    const out = await put.json();
    return res.status(201).json({ ok: true, id, path, commit: out.commit?.sha || null });
  } catch (e) {
    return res.status(502).json({ error: 'RELAY_ERROR', message: String(e.message || e) });
  }
}
