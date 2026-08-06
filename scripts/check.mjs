#!/usr/bin/env node
/**
 * LSC · Static integrity checks
 * ---------------------------------------------------------------------------
 * Catches the class of bug unit tests miss: a dangling import, an <img> that
 * 404s, a schema field with no English label, a stray CDN reference.
 *
 *   node scripts/check.mjs
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function walk(dir, filter, out = []) {
  let entries;
  try { entries = await readdir(join(ROOT, dir), { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'test-results', 'playwright-report'].includes(e.name)) continue;
      await walk(rel, filter, out);
    } else if (filter.test(e.name)) out.push(rel.replace(/^\.\//, ''));
  }
  return out;
}

/* ---- 1 · every relative import resolves ---------------------------------- */
const jsFiles = [
  ...(await walk('assets/js', /\.js$/)),
  ...(await walk('scripts', /\.mjs$/)),
];
for (const file of jsFiles) {
  const src = await readFile(join(ROOT, file), 'utf8');
  for (const m of src.matchAll(/(?:^|[\s(])(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
    const target = resolve(join(ROOT, dirname(file)), m[1]);
    if (!(await exists(target))) fail(`${file}: import not found → ${m[1]}`);
  }
  for (const m of src.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const target = resolve(join(ROOT, dirname(file)), m[1]);
    if (!(await exists(target))) fail(`${file}: dynamic import not found → ${m[1]}`);
  }
}

/* ---- 2 · HTML asset references resolve ----------------------------------- */
const htmlFiles = (await walk('.', /\.html$/)).filter((f) => !f.includes('node_modules'));
for (const file of htmlFiles) {
  const src = await readFile(join(ROOT, file), 'utf8');
  for (const m of src.matchAll(/(?:href|src)=["'“]([^"'#?]+)["'”]/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/|#)/.test(href)) continue;
    const target = resolve(join(ROOT, dirname(file)), href.replace(/[?#].*$/, ''));
    if (!(await exists(target))) fail(`${file}: broken reference → ${href}`);
  }
  if (!/<html[^>]+lang=/.test(src)) fail(`${file}: <html> has no lang attribute`);
  if (!/<meta[^>]+name=["']viewport["']/.test(src)) fail(`${file}: missing viewport meta`);
  if (!/<title>/.test(src)) fail(`${file}: missing <title>`);
}

/* ---- 3 · no external network dependencies -------------------------------- */
const shippedAssets = [
  ...(await walk('assets', /\.(js|css)$/)),
  ...htmlFiles,
];
const ALLOWED_EXTERNAL = [
  'http://www.w3.org/',            // SVG/XML namespaces
  'https://schema.org',
  'https://api.github.com',        // called with fetch, not loaded as a resource
  'https://raw.githubusercontent.com',
  'https://wa.me/',
  'https://www.copart.com', 'https://www.iaai.com', 'https://bid.cars',
  'https://autoastat.com', 'https://www.carfax.com', 'https://super.superdispatch.com',
  'https://openapi.vercel.sh',
];
for (const file of shippedAssets) {
  const src = await readFile(join(ROOT, file), 'utf8');
  for (const m of src.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/g)) {
    if (!ALLOWED_EXTERNAL.some((a) => m[1].startsWith(a))) {
      fail(`${file}: loads an external resource → ${m[1]} (the app must be fully self-contained)`);
    }
  }
  if (/@import\s+url\(\s*["']?https?:/.test(src)) fail(`${file}: CSS @import from the network`);
}

/* ---- 4 · schema integrity ------------------------------------------------- */
const { STEPS, allFields } = await import(new URL('../assets/js/schema.js', import.meta.url));
const seen = new Set();
const LANGS = ['es', 'en'];

const bilingual = (v, where, what) => {
  if (v === undefined || v === null) return;
  if (typeof v === 'string') return;         // deliberate brand/proper nouns
  for (const l of LANGS) if (!v[l]) warn(`${where}: ${what} has no "${l}" translation`);
};

for (const step of STEPS) {
  if (!step.id) fail('a step has no id');
  bilingual(step.title, `step:${step.id}`, 'title');
  bilingual(step.subtitle, `step:${step.id}`, 'subtitle');
  for (const f of step.fields) {
    if (!f.id) { fail(`step:${step.id} has a field without an id`); continue; }
    if (seen.has(f.id)) fail(`duplicate field id: ${f.id}`);
    seen.add(f.id);
    if (!f.type) fail(`${f.id}: no type`);
    if (!f.label) fail(`${f.id}: no label`);
    bilingual(f.label, f.id, 'label');
    bilingual(f.help, f.id, 'help');
    bilingual(f.placeholder, f.id, 'placeholder');

    const needsOptions = ['radio', 'multi', 'select', 'segmented', 'chips', 'priority'];
    if (needsOptions.includes(f.type)) {
      if (!Array.isArray(f.options) || !f.options.length) fail(`${f.id}: type ${f.type} needs options`);
      else {
        const ids = new Set();
        for (const o of f.options) {
          if (!o.id) fail(`${f.id}: an option has no id`);
          if (ids.has(o.id)) fail(`${f.id}: duplicate option id "${o.id}"`);
          ids.add(o.id);
          if (!o.label) fail(`${f.id}: option "${o.id}" has no label`);
          bilingual(o.label, `${f.id}/${o.id}`, 'option label');
          bilingual(o.desc, `${f.id}/${o.id}`, 'option desc');
        }
      }
    }
    if (f.type === 'repeater' && !Array.isArray(f.item)) fail(`${f.id}: repeater needs an item spec`);
    if (f.type === 'priority' && !f.sourceField) fail(`${f.id}: priority needs sourceField`);
    if (f.showIf && typeof f.showIf !== 'function') fail(`${f.id}: showIf must be a function`);
  }
}
if (allFields().length !== seen.size) fail('allFields() disagrees with the walked field set');

/* ---- 5 · UI dictionaries are complete ------------------------------------- */
const { UI } = await import(new URL('../assets/js/core.js', import.meta.url));
const esKeys = Object.keys(UI.es), enKeys = new Set(Object.keys(UI.en));
for (const k of esKeys) if (!enKeys.has(k)) fail(`UI dictionary: "${k}" missing from English`);
for (const k of enKeys) if (!esKeys.includes(k)) fail(`UI dictionary: "${k}" missing from Spanish`);

/* ---- 6 · fee tables are monotonic ----------------------------------------- */
const { DEFAULT_FEES } = await import(new URL('../assets/js/fees.js', import.meta.url));
for (const key of ['copart', 'iaai', 'manheim', 'acv']) {
  const rows = DEFAULT_FEES[key]?.buyerFee?.rows || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] <= rows[i - 1][0]) fail(`fees.${key}: bracket ceilings are not ascending at index ${i}`);
    if (rows[i][1] < rows[i - 1][1]) fail(`fees.${key}: fee decreases at index ${i}`);
  }
}

/* ---- report --------------------------------------------------------------- */
for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`   · ${e}`);
  process.exit(1);
}
console.log(`✅ Static checks passed — ${jsFiles.length} modules, ${htmlFiles.length} pages, ${seen.size} schema fields` +
  (warnings.length ? ` (${warnings.length} warning(s))` : ''));

