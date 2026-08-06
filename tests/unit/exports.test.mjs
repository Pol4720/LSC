import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCsv, toLongCsv, toJson, toVCard, toVCards, toMarkdownAll,
  toPrintableHtml, toWhatsApp, toICal, csvEscape, exportFilename,
} from '../../assets/js/exports.js';
import { allFields } from '../../assets/js/schema.js';
import { fullAnswers } from './validate.test.mjs';

const record = (over = {}) => ({
  id: 'LSC-20260806-ABC123',
  createdAt: '2026-08-06T12:00:00.000Z',
  data: fullAnswers(),
  crm: { stage: 'searching', priority: 'hot', tags: ['vip', 'referido'], notes: [], lots: [], updatedAt: '2026-08-06T13:00:00.000Z' },
  ...over,
});

/* ---- CSV ----------------------------------------------------------------- */

test('csvEscape quotes only when it must', () => {
  assert.equal(csvEscape('simple'), 'simple');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape('line\nbreak'), '"line\nbreak"');
  assert.equal(csvEscape(null), '');
});

test('wide CSV has one header column per schema field plus the CRM columns', () => {
  const csv = toCsv([record()], 'es');
  const header = csv.replace(/^﻿/, '').split('\r\n')[0].split(',');
  const fieldCount = allFields().filter((f) => f.type !== 'info').length;
  assert.equal(header.length, fieldCount + 10);
  assert.equal(header[0], 'id');
  assert.ok(header.includes('contact.fullName'));
});

test('wide CSV rows line up with the header, even with commas in answers', () => {
  const r = record();
  r.data.references.notes = 'Quiero, sobre todo, "ahorro"';
  const csv = toCsv([r], 'es');
  const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
  assert.equal(lines.length, 2);
  assert.equal(countCsvFields(lines[0]), countCsvFields(lines[1]));
  assert.ok(csv.includes('"Quiero, sobre todo, ""ahorro"""'));
});

test('CSV starts with a BOM so Excel reads Spanish accents', () => {
  assert.ok(toCsv([record()], 'es').startsWith('﻿'));
  assert.ok(toCsv([record()], 'es').includes('María Fernández'));
});

test('CSV never emits a raw newline outside a quoted field', () => {
  const r = record();
  r.data.references.lots = [{ url: 'https://www.copart.com/lot/1', note: 'a' }, { url: 'https://www.copart.com/lot/2', note: 'b' }];
  const csv = toCsv([r], 'es');
  assert.equal(csv.replace(/^﻿/, '').trimEnd().split('\r\n').length, 2);
});

test('long CSV emits one row per answered question', () => {
  const csv = toLongCsv([record()], 'es');
  const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
  assert.ok(lines.length > 25);
  assert.equal(lines[0], 'client_id,created_at,section,question,answer');
  assert.ok(lines.every((l) => l.startsWith('LSC-20260806-ABC123') || l.startsWith('client_id')));
});

test('CSV of an empty portfolio is still a valid header-only file', () => {
  const csv = toCsv([], 'es');
  assert.equal(csv.replace(/^﻿/, '').trimEnd().split('\r\n').length, 1);
});

/* ---- JSON ---------------------------------------------------------------- */

test('JSON export round-trips through JSON.parse', () => {
  const parsed = JSON.parse(toJson([record(), record({ id: 'LSC-20260806-XYZ999' })]));
  assert.equal(parsed.count, 2);
  assert.equal(parsed.records[0].id, 'LSC-20260806-ABC123');
  assert.ok(parsed.exportedAt);
});

/* ---- vCard --------------------------------------------------------------- */

test('vCard is well formed and escapes special characters', () => {
  const v = toVCard(record(), 'es');
  assert.ok(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0'));
  assert.ok(v.trimEnd().endsWith('END:VCARD'));
  assert.match(v, /FN:María Fernández/);
  assert.match(v, /TEL;TYPE=CELL:\+1 786 555 0100/);
  assert.match(v, /N:Fernández;María;;;/);

  const weird = record();
  weird.data.contact.fullName = 'Ana; Luz, Pérez';
  assert.match(toVCard(weird), /FN:Ana\\; Luz\\, Pérez/);
});

test('multiple vCards concatenate without losing a card', () => {
  const many = toVCards([record(), record({ id: 'LSC-20260806-XYZ999' })]);
  assert.equal((many.match(/BEGIN:VCARD/g) || []).length, 2);
  assert.equal((many.match(/END:VCARD/g) || []).length, 2);
});

/* ---- iCal ---------------------------------------------------------------- */

test('iCal wraps events with the required envelope', () => {
  const ics = toICal([{ id: 'N-1', start: '2026-08-10T15:00:00Z', title: 'Asesoría María', description: 'Primera sesión' }]);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.match(ics, /DTSTART:20260810T150000Z/);
  assert.match(ics, /SUMMARY:Asesoría María/);
});

/* ---- Markdown & HTML ----------------------------------------------------- */

test('the portfolio markdown carries an index table and a section per client', () => {
  const md = toMarkdownAll([record(), record({ id: 'LSC-20260806-XYZ999' })], 'es');
  assert.match(md, /^# Cartera de clientes/m);
  assert.equal((md.match(/^## /gm) || []).length >= 12, true);
  assert.ok(md.includes('LSC-20260806-XYZ999'));
});

test('printable HTML escapes user content instead of injecting it', () => {
  const r = record();
  r.data.references.notes = '<script>alert(1)</script>';
  const html = toPrintableHtml(r, 'es');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('María Fernández'));
});

test('the WhatsApp brief stays short and includes the essentials', () => {
  const w = toWhatsApp(record(), 'es');
  assert.match(w, /LSC-20260806-ABC123/);
  assert.match(w, /María Fernández/);
  assert.match(w, /\+1 786 555 0100/);
  assert.ok(w.split('\n').length <= 8);
});

/* ---- filenames ----------------------------------------------------------- */

test('export filenames are timestamped and safe', () => {
  const name = exportFilename('clientes', 'csv', 12);
  assert.match(name, /^lsc-clientes-12-\d{8}-\d{4}\.csv$/);
  assert.match(exportFilename('backup', 'json'), /^lsc-backup-\d{8}-\d{4}\.json$/);
});

/* ---- helper -------------------------------------------------------------- */
function countCsvFields(line) {
  let n = 1, inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { i++; continue; }
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) n++;
  }
  return n;
}
