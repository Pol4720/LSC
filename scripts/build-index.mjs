#!/usr/bin/env node
/**
 * LSC · Rebuild data/index.json
 * ---------------------------------------------------------------------------
 * Produces a PII-free manifest of every sealed submission so the console (and
 * anyone without a token) can enumerate records through the raw CDN instead of
 * burning GitHub API calls.
 *
 * Only metadata that is already visible on the ciphertext is copied: the id,
 * the envelope timestamp, the key fingerprint and the byte size. No plaintext
 * is ever touched — this script cannot decrypt anything.
 *
 *   node scripts/build-index.mjs
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUBS = join(ROOT, 'data', 'submissions');
const CRM = join(ROOT, 'data', 'crm');
const OUT = join(ROOT, 'data', 'index.json');

async function listJson(dir) {
  try {
    const names = await readdir(dir);
    return names.filter((n) => n.endsWith('.json')).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

const records = [];
for (const name of await listJson(SUBS)) {
  const id = name.replace(/\.json$/, '');
  const raw = await readFile(join(SUBS, name), 'utf8');
  let envelope = null;
  try { envelope = JSON.parse(raw); } catch { /* keep it listed anyway */ }
  records.push({
    id,
    path: `data/submissions/${name}`,
    bytes: Buffer.byteLength(raw, 'utf8'),
    sealed: Boolean(envelope?.alg && envelope?.ct),
    alg: envelope?.alg ?? null,
    kid: envelope?.kid ?? null,
    ts: envelope?.ts ?? null,
  });
}

const crm = (await listJson(CRM)).map((n) => n.replace(/\.json$/, ''));

const index = {
  generatedAt: new Date().toISOString(),
  count: records.length,
  crmCount: crm.length,
  unsealed: records.filter((r) => !r.sealed).map((r) => r.id),
  records,
  crm,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');

console.log(`data/index.json · ${records.length} submission(s), ${crm.length} CRM overlay(s)`);
if (index.unsealed.length) {
  console.warn(`⚠️  ${index.unsealed.length} record(s) are NOT encrypted: ${index.unsealed.join(', ')}`);
}
