import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLotUrl, isValidVin, byId, TITLE_TYPES, PIPELINE_STAGES, GLOSSARY, MAKES } from '../../assets/js/catalogs.js';
import { deepGet, deepSet, fuzzyScore, norm, isEmpty, clamp, uid, fmtMoney, fmtNumber, I18n } from '../../assets/js/core.js';
import { summarize, headline, deriveProfile, formatValue, toPlainText, toMarkdown } from '../../assets/js/summary.js';
import { fullAnswers } from './validate.test.mjs';

/* ---- catalogs ------------------------------------------------------------ */

test('lot URLs are recognised per auction house', () => {
  assert.equal(parseLotUrl('https://www.copart.com/lot/12345678/salvage-2018-toyota').source, 'copart');
  assert.equal(parseLotUrl('https://www.copart.com/lot/12345678').lot, '12345678');
  assert.equal(parseLotUrl('https://www.iaai.com/VehicleDetail/40123456~US').source, 'iaai');
  assert.equal(parseLotUrl('https://bid.cars/en/lot/12345').source, 'bidcars');
  assert.equal(parseLotUrl('https://autoastat.com/en/search').source, 'autoastat');
  assert.equal(parseLotUrl('https://example.com/nada').source, null);
  assert.equal(parseLotUrl(''), null);
});

test('a VIN inside a lot URL is extracted and validated', () => {
  const withVin = parseLotUrl('https://www.copart.com/lot/999/2018-honda-civic-2HGFC2F59JH542514');
  assert.equal(withVin.vin, '2HGFC2F59JH542514');
});

test('VIN check-digit validation catches typos', () => {
  assert.ok(isValidVin('1HGBH41JXMN109186'));   // canonical NHTSA sample
  assert.ok(!isValidVin('1HGBH41J1MN109186'));  // wrong check digit
  assert.ok(!isValidVin('1HGBH41JXMN10918'));   // 16 chars
  assert.ok(!isValidVin('1HGBH41JXMN1091IO'));  // contains I and O
  assert.ok(!isValidVin(''));
});

test('catalog lookups and glossary coverage', () => {
  assert.equal(byId(TITLE_TYPES, 'salvage').id, 'salvage');
  assert.equal(byId(TITLE_TYPES, 'nope'), null);
  assert.equal(PIPELINE_STAGES[0].id, 'new');
  assert.ok(PIPELINE_STAGES.every((s) => s.label.es && s.label.en && s.color));
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    const text = typeof entry.text === 'string' ? { es: entry.text, en: entry.text } : entry.text;
    assert.ok(text.es && text.en, `glossary "${key}" is missing a translation`);
  }
  assert.equal(new Set(MAKES).size, MAKES.length, 'MAKES has duplicates');
});

/* ---- core ---------------------------------------------------------------- */

test('deepGet / deepSet walk dotted paths and create the spine', () => {
  const o = {};
  deepSet(o, 'a.b.c', 42);
  assert.equal(o.a.b.c, 42);
  assert.equal(deepGet(o, 'a.b.c'), 42);
  assert.equal(deepGet(o, 'a.x.y'), undefined);
  assert.equal(deepGet(null, 'a'), undefined);
  deepSet(o, 'a.b.c', 0);
  assert.equal(deepGet(o, 'a.b.c'), 0);
});

test('norm strips accents and case so Spanish search works', () => {
  assert.equal(norm('María Fernández Ñandú'), 'maria fernandez nandu');
  assert.equal(norm(null), '');
});

test('fuzzy search ranks prefixes above scattered matches', () => {
  assert.equal(fuzzyScore('', 'anything'), 1);
  assert.ok(fuzzyScore('mar', 'María Fernández') > 0.8);
  assert.ok(fuzzyScore('maria', 'MARÍA') === 1);
  assert.ok(fuzzyScore('fern', 'María Fernández') > 0);
  assert.ok(fuzzyScore('mar', 'María Fernández') > fuzzyScore('mrf', 'María Fernández'));
  assert.equal(fuzzyScore('zzz', 'María'), 0);
});

test('isEmpty and clamp behave on every input shape', () => {
  for (const v of [null, undefined, '', '  ', [], {}]) assert.ok(isEmpty(v), JSON.stringify(v));
  for (const v of [0, false, 'a', [1], { a: 1 }]) assert.ok(!isEmpty(v), JSON.stringify(v));
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
});

test('generated ids follow the relay-accepted pattern', () => {
  const ids = new Set();
  for (let i = 0; i < 400; i++) {
    const id = uid('LSC-');
    assert.match(id, /^LSC-\d{8}-[A-Z0-9]{6}$/);
    ids.add(id);
  }
  assert.ok(ids.size > 395, 'ids collide far too often');
});

test('money and number formatting stay stable across languages', () => {
  assert.match(fmtMoney(12500, { lang: 'en' }), /\$12,500/);
  assert.equal(fmtMoney(NaN), '—');
  assert.equal(fmtNumber('nope'), '—');
});

/* ---- summary ------------------------------------------------------------- */

test('summarize produces readable groups in both languages', () => {
  const data = fullAnswers();
  for (const lang of ['es', 'en']) {
    const groups = summarize(data, lang);
    assert.ok(groups.length >= 6, `${lang}: too few groups`);
    for (const g of groups) {
      assert.ok(g.title, `${lang}: group without a title`);
      for (const it of g.items) {
        assert.ok(it.label, `${lang}: item without a label`);
        assert.ok(String(it.value).length > 0);
        assert.ok(!String(it.value).includes('[object Object]'), `${lang}: raw object leaked into ${it.id}`);
        assert.ok(!String(it.value).includes('undefined'), `${lang}: undefined leaked into ${it.id}`);
      }
    }
  }
});

test('option ids are resolved to human labels, not raw keys', () => {
  const groups = summarize(fullAnswers(), 'es');
  const flat = groups.flatMap((g) => g.items);
  const titles = flat.find((i) => i.id === 'condition.titles');
  assert.ok(titles.value.includes('Título limpio'));
  assert.ok(!titles.value.includes('clean'));
});

test('formatValue handles each field type', () => {
  const f = (t, extra = {}) => ({ id: 'x', type: t, label: { es: 'x', en: 'x' }, ...extra });
  assert.equal(formatValue(f('switch'), true, 'es'), 'Sí');
  assert.equal(formatValue(f('money'), 1500, 'en'), '$1,500');
  assert.equal(formatValue(f('yearrange'), { from: 2010, to: 2020 }), '2010 – 2020');
  assert.equal(formatValue(f('tags'), ['a', 'b']), 'a · b');
  assert.equal(formatValue(f('text'), '', 'es'), null);
  assert.match(formatValue(f('repeater'), [{ url: 'https://www.copart.com/lot/77', note: 'ok' }]), /\[copart #77\]/);
});

test('headline summarises the car and budget in one line', () => {
  const h = headline(fullAnswers(), 'es');
  assert.match(h, /RAV4/);
  assert.match(h, /12/);
  assert.ok(headline({}, 'en').length > 0);
});

test('deriveProfile scores risk, urgency and budget band', () => {
  const p = deriveProfile(fullAnswers());
  assert.equal(p.budgetBand, 'mid');
  assert.equal(p.riskAppetite, 'medium');
  assert.equal(p.needsEducation, true);
  assert.ok(p.heat > 0 && p.heat <= 100);

  const risky = deriveProfile({
    condition: { titles: ['salvage', 'nonrepairable'], damageTolerance: 'heavy' },
    budget: { total: 40000, urgency: 'asap' },
    goal: { useCases: ['resale', 'export'], experience: 'expert' },
  });
  assert.equal(risky.riskAppetite, 'high');
  assert.equal(risky.budgetBand, 'premium');
  assert.equal(risky.isResale, true);
  assert.equal(risky.isExport, true);
  assert.equal(risky.needsEducation, false);
});

test('plain text and markdown briefs contain the client data', () => {
  const record = { id: 'LSC-20260806-ABC123', createdAt: '2026-08-06T12:00:00Z', data: fullAnswers() };
  const txt = toPlainText(record, 'es');
  assert.match(txt, /LSC-20260806-ABC123/);
  assert.match(txt, /María Fernández/);
  const md = toMarkdown(record, 'en');
  assert.match(md, /^# Client request/m);
  assert.match(md, /\| \*\*/);
});

test('I18n falls back to Spanish for unknown keys and interpolates vars', () => {
  I18n.lang = 'en';
  assert.equal(I18n.t('common.next'), 'Continue');
  assert.equal(I18n.t('err.min', { min: 500 }), 'Minimum value is 500');
  assert.equal(I18n.t('no.such.key'), 'no.such.key');
  assert.equal(I18n.L({ es: 'hola', en: 'hi' }), 'hi');
  assert.equal(I18n.L('plano'), 'plano');
  I18n.lang = 'es';
  assert.equal(I18n.L({ es: 'hola', en: 'hi' }), 'hola');
  assert.equal(I18n.L({ en: 'only-en' }), 'only-en');
});
