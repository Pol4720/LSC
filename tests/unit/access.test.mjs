import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBackoffMs, secondsRemaining, EXPIRY_PRESETS, generateAccessCode,
  grantStatus, isGrantUsable, mergeGrants, withTimeout,
} from '../../assets/js/access.js';

/* ---- throttle -------------------------------------------------------- */

test('the first three failed attempts cost nothing', () => {
  assert.equal(computeBackoffMs(0), 0);
  assert.equal(computeBackoffMs(1), 0);
  assert.equal(computeBackoffMs(2), 0);
  assert.equal(computeBackoffMs(3), 0);
});

test('the backoff doubles from the fourth failure and then caps', () => {
  assert.equal(computeBackoffMs(4), 2000);
  assert.equal(computeBackoffMs(5), 4000);
  assert.equal(computeBackoffMs(6), 8000);
  assert.equal(computeBackoffMs(7), 16000);
  assert.equal(computeBackoffMs(8), 32000);
  assert.equal(computeBackoffMs(9), 60000);   // would be 64000 uncapped
  assert.equal(computeBackoffMs(40), 60000);  // stays capped forever after
});

test('backoff never decreases as failures accumulate', () => {
  let prev = -1;
  for (let n = 0; n <= 30; n++) {
    const ms = computeBackoffMs(n);
    assert.ok(ms >= prev, `backoff dropped at failure #${n}`);
    prev = ms;
  }
});

test('secondsRemaining rounds up so the UI never shows a stale 0s while still locked', () => {
  const now = 1_000_000;
  assert.equal(secondsRemaining(now + 1, now), 1);
  assert.equal(secondsRemaining(now + 999, now), 1);
  assert.equal(secondsRemaining(now + 1001, now), 2);
  assert.equal(secondsRemaining(now, now), 0);
  assert.equal(secondsRemaining(now - 5000, now), 0); // already past — never negative
});

/* ---- access codes ------------------------------------------------------ */

test('generated codes are high-entropy and consistently formatted', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const code = generateAccessCode();
    assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){3}$/,
      `unexpected shape: ${code}`);
    seen.add(code);
  }
  assert.ok(seen.size > 495, 'codes collide far too often for a security credential');
});

test('a generated code carries at least 64 bits of entropy', () => {
  // 16 symbols from a 32-character alphabet = 80 bits; assert the floor a
  // reviewer would actually check, so a future refactor can't quietly shrink it.
  const code = generateAccessCode();
  const symbols = code.replace(/-/g, '');
  assert.equal(symbols.length, 16);
  const bits = symbols.length * Math.log2(32);
  assert.ok(bits >= 64, `only ${bits} bits of entropy`);
});

/* ---- bounded network checks ------------------------------------------------ */

test('withTimeout resolves normally when the promise is fast enough', async () => {
  const value = await withTimeout(Promise.resolve('ok'), 200);
  assert.equal(value, 'ok');
});

test('withTimeout rejects instead of hanging when the promise is too slow', async () => {
  const never = new Promise(() => {}); // simulates a stalled fetch
  await assert.rejects(() => withTimeout(never, 30));
});

test('withTimeout propagates the promise\'s own rejection when it loses the race', async () => {
  await assert.rejects(() => withTimeout(Promise.reject(new Error('offline')), 200), /offline/);
});

/* ---- grant lifecycle ----------------------------------------------------- */

const grant = (over = {}) => ({
  id: 'GR-TEST', label: 'test', createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  revoked: false, vault: { ct: 'x', iv: 'y', salt: 'z' },
  ...over,
});

test('a fresh, non-revoked grant is active', () => {
  assert.equal(grantStatus(grant()), 'active');
  assert.equal(isGrantUsable(grant()), true);
});

test('a past-expiry grant reads as expired, not active', () => {
  const g = grant({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(grantStatus(g), 'expired');
  assert.equal(isGrantUsable(g), false);
});

test('revoked wins even if the expiry is still in the future', () => {
  const g = grant({ revoked: true });
  assert.equal(grantStatus(g), 'revoked');
  assert.equal(isGrantUsable(g), false);
});

test('a grant with no expiry is never usable', () => {
  const g = grant({ expiresAt: null });
  assert.equal(grantStatus(g), 'expired');
});

test('null/undefined is treated as revoked, not as a crash', () => {
  assert.equal(grantStatus(null), 'revoked');
  assert.equal(isGrantUsable(undefined), false);
});

test('usability flips exactly at the expiry instant', () => {
  const at = Date.now() + 10_000;
  const g = grant({ expiresAt: new Date(at).toISOString() });
  assert.equal(isGrantUsable(g, at - 1), true);
  assert.equal(isGrantUsable(g, at), false);
  assert.equal(isGrantUsable(g, at + 1), false);
});

/* ---- expiry presets ------------------------------------------------------- */

test('every expiry preset has both languages and an id', () => {
  for (const p of EXPIRY_PRESETS) {
    assert.ok(p.id, 'preset missing an id');
    assert.ok(p.label.es && p.label.en, `${p.id}: missing a translation`);
  }
});

test('preset durations are ascending and only "custom" has no fixed ms', () => {
  const timed = EXPIRY_PRESETS.filter((p) => p.id !== 'custom');
  let prev = 0;
  for (const p of timed) {
    assert.ok(p.ms > prev, `${p.id}: durations should be strictly increasing`);
    prev = p.ms;
  }
  assert.equal(EXPIRY_PRESETS.find((p) => p.id === 'custom').ms, null);
});

/* ---- merging two devices' grant lists ------------------------------------- */

test('mergeGrants keeps grants unique to either side', () => {
  const local = [grant({ id: 'A' })];
  const remote = [grant({ id: 'B' })];
  const merged = mergeGrants(local, remote);
  assert.deepEqual(merged.map((g) => g.id).sort(), ['A', 'B']);
});

test('a revocation on either side always wins the merge', () => {
  const local = [grant({ id: 'A', revoked: false })];
  const remoteRevoked = [grant({ id: 'A', revoked: true })];
  assert.equal(mergeGrants(local, remoteRevoked)[0].revoked, true);

  const localRevoked = [grant({ id: 'A', revoked: true })];
  const remoteNot = [grant({ id: 'A', revoked: false })];
  assert.equal(mergeGrants(localRevoked, remoteNot)[0].revoked, true);
});

test('mergeGrants is safe on empty inputs', () => {
  assert.deepEqual(mergeGrants([], []), []);
  assert.deepEqual(mergeGrants([grant({ id: 'A' })], []).map((g) => g.id), ['A']);
  assert.deepEqual(mergeGrants([], [grant({ id: 'A' })]).map((g) => g.id), ['A']);
});
