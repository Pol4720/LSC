import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORMS, PLATFORM_GROUPS, platformById, platformsByGroup, contextualUrl,
} from '../../assets/js/platforms.js';

test('every platform is complete and well formed', () => {
  const ids = new Set();
  const groups = new Set(PLATFORM_GROUPS.map((g) => g.id));
  for (const p of PLATFORMS) {
    assert.ok(p.id, 'platform without an id');
    assert.ok(!ids.has(p.id), `duplicate platform id: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.name, `${p.id}: no name`);
    assert.ok(groups.has(p.group), `${p.id}: unknown group "${p.group}"`);
    assert.match(p.url, /^https:\/\/[^\s"']+$/, `${p.id}: bad url`);
    assert.ok(p.mark && p.mark.length <= 3, `${p.id}: mark must be 1-3 characters`);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, `${p.id}: bad colour`);
    assert.match(p.fg, /^#[0-9a-f]{6}$/i, `${p.id}: bad foreground`);
    assert.ok(p.desc?.es && p.desc?.en, `${p.id}: description needs both languages`);
  }
});

test('every platform mark has readable contrast on its own colour', () => {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  for (const p of PLATFORMS) {
    const a = lum(p.color), b = lum(p.fg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= 4.5, `${p.id}: contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
  }
});

test('every group has at least one platform and both labels', () => {
  for (const g of PLATFORM_GROUPS) {
    assert.ok(g.label.es && g.label.en, `${g.id}: group label needs both languages`);
    assert.ok(platformsByGroup(g.id).length > 0, `${g.id}: group is empty`);
  }
});

test('all the platforms named in the brief are present', () => {
  for (const id of ['copart', 'iaai', 'manheim', 'acv', 'bidcars', 'carfax', 'superdispatch', 'autoastat', 'lsc']) {
    assert.ok(platformById(id), `missing platform: ${id}`);
  }
  assert.equal(platformById('nope'), null);
});

test('contextualUrl prefers VIN, then search, then the home page', () => {
  const copart = platformById('copart');
  assert.equal(contextualUrl(copart), copart.url);
  assert.match(contextualUrl(copart, { query: 'Toyota RAV4' }), /query=Toyota%20RAV4/);
  assert.match(contextualUrl(copart, { vin: '1HGBH41JXMN109186' }), /1HGBH41JXMN109186/);
  assert.match(
    contextualUrl(copart, { vin: '1HGBH41JXMN109186', query: 'ignored' }),
    /1HGBH41JXMN109186/,
  );

  const acv = platformById('acv');   // no deep links at all
  assert.equal(contextualUrl(acv, { vin: 'X', query: 'Y' }), acv.url);
});

test('deep links escape user input instead of injecting it', () => {
  const carfax = platformById('carfax');
  const url = carfax.vin('A B&c=1');
  assert.ok(!url.includes(' '));
  assert.ok(!url.includes('&c=1'));
  assert.match(url, /A%20B%26c%3D1/);
});

test('every generated link stays on the platform origin', () => {
  for (const p of PLATFORMS) {
    const origin = new URL(p.url).origin;
    for (const url of [contextualUrl(p, { query: 'test' }), contextualUrl(p, { vin: 'VIN123' })]) {
      const host = new URL(url).hostname;
      const base = new URL(origin).hostname.replace(/^www\./, '');
      assert.ok(host.endsWith(base) || host.endsWith(base.split('.').slice(-2).join('.')),
        `${p.id}: deep link left the site → ${url}`);
    }
  }
});
