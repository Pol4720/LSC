#!/usr/bin/env node
/**
 * LSC · Privacy guard
 * ---------------------------------------------------------------------------
 * Fails CI if anything under data/submissions or data/crm was committed in
 * plaintext. The repository is public, so an unsealed record would leak a real
 * person's name, phone and budget. This is the last line of defence.
 *
 *   node scripts/check-encrypted.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['data/submissions', 'data/crm'];
const EXPECTED_ALG = 'ECDH-P256-HKDF-A256GCM';

/** Field names that must never appear as plaintext keys in a data file. */
const PII_KEYS = ['fullName', 'phone', 'email', 'contact', 'data'];

const problems = [];

for (const rel of DIRS) {
  let names;
  try { names = await readdir(join(ROOT, rel)); }
  catch (e) { if (e.code === 'ENOENT') continue; throw e; }

  for (const name of names.filter((n) => n.endsWith('.json'))) {
    const path = `${rel}/${name}`;
    const raw = await readFile(join(ROOT, path), 'utf8');
    let obj;
    try { obj = JSON.parse(raw); }
    catch { problems.push(`${path}: not valid JSON`); continue; }

    const sealed = obj?.alg === EXPECTED_ALG && typeof obj.ct === 'string' && typeof obj.iv === 'string';
    if (sealed) continue;

    const leaked = PII_KEYS.filter((k) => k in (obj || {}));
    problems.push(
      `${path}: NOT sealed (alg=${obj?.alg ?? 'none'})` +
      (leaked.length ? ` — plaintext keys present: ${leaked.join(', ')}` : ''),
    );
  }
}

if (problems.length) {
  console.error('❌ Unencrypted client data detected in a public repository:\n');
  for (const p of problems) console.error(`   · ${p}`);
  console.error('\nRemove these files (and scrub the history if they were pushed) before continuing.');
  process.exit(1);
}

console.log('✅ Every data record is sealed.');
