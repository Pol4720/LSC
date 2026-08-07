/* =========================================================================
   LSC · Access control
   ---------------------------------------------------------------------------
   Two protections layered on top of the encryption vault (crypto.js), both
   about WHO gets to open the console at all, not what they can decrypt once
   inside:

     1. Unlock throttling — escalating delay after repeated wrong guesses,
        persisted so a page reload cannot reset it.
     2. Temporary access grants — the advisor's private key wrapped a second
        (third, fourth…) time under a freshly generated, high-entropy code
        with an expiry and a revoked flag. Unlocking with a grant's code opens
        the console exactly like the real passphrase does — that IS what
        "authorize someone temporarily" means — but the grant can be revoked
        or simply left to expire, without ever disclosing the real passphrase.

   Everything here is pure and DOM-free so it can be unit-tested directly.
   Honest limits (stated in docs, not hidden): revocation and expiry are
   client-side checks. They stop *future* unlocks; they cannot reach into a
   browser tab that is already unlocked and force it closed. Nothing running
   entirely in a browser can promise that — the same is true of every other
   client-side security model, including OS screen locks.
   ========================================================================= */

import { randomCode } from './core.js';

/* ------------------------------------------------------------- throttle --- */
/** First THRESHOLD attempts are free; every attempt after that costs more. */
const THRESHOLD = 3;
const BASE_MS = 2000;
const CAP_MS = 60_000;

/** Delay required before the NEXT attempt, given how many have already failed. */
export function computeBackoffMs(failCount) {
  const n = Math.max(0, Math.floor(failCount) - THRESHOLD);
  if (n <= 0) return 0;
  return Math.min(CAP_MS, BASE_MS * 2 ** (n - 1));
}

/** Seconds left to show in the UI, rounded up so it never displays "0s" while still locked. */
export function secondsRemaining(until, now = Date.now()) {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * Race a promise against a timeout. Checking a temporary grant against the
 * live repository must never hang a failed-passphrase attempt indefinitely —
 * this advisor's connection is not always reliable, and a plain typo should
 * still fail fast most of the time.
 */
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

/* --------------------------------------------------------------- grants --- */
/** Expiry choices offered when creating a temporary grant. */
export const EXPIRY_PRESETS = [
  { id: '1h', ms: 60 * 60 * 1000, label: { es: '1 hora', en: '1 hour' } },
  { id: '4h', ms: 4 * 60 * 60 * 1000, label: { es: '4 horas', en: '4 hours' } },
  { id: '1d', ms: 24 * 60 * 60 * 1000, label: { es: '1 día', en: '1 day' } },
  { id: '3d', ms: 3 * 24 * 60 * 60 * 1000, label: { es: '3 días', en: '3 days' } },
  { id: '7d', ms: 7 * 24 * 60 * 60 * 1000, label: { es: '7 días', en: '7 days' } },
  { id: 'custom', ms: null, label: { es: 'Fecha y hora personalizada', en: 'Custom date & time' } },
];

/**
 * A random access code, generated — never advisor-chosen. The wrapped key it
 * protects may end up published in the (public) repository so other devices
 * can verify revocation live, so the code must resist offline brute force on
 * its own: 16 chars from a 32-symbol alphabet is 80 bits of entropy.
 */
export function generateAccessCode() {
  return [randomCode(4), randomCode(4), randomCode(4), randomCode(4)].join('-');
}

/** 'active' | 'expired' | 'revoked' */
export function grantStatus(grant, now = Date.now()) {
  if (!grant) return 'revoked';
  if (grant.revoked) return 'revoked';
  if (!grant.expiresAt || new Date(grant.expiresAt).getTime() <= now) return 'expired';
  return 'active';
}

export const isGrantUsable = (grant, now = Date.now()) => grantStatus(grant, now) === 'active';

/**
 * Merge two grant lists (e.g. this device's cache + a freshly fetched copy).
 * A grant only ever gets *more* restrictive over time — revoked flips true and
 * never back — so when the two copies disagree, the union wins: whichever
 * side has already recorded a revocation is trusted over one that hasn't
 * caught up yet. New ids from either side are kept.
 */
export function mergeGrants(local = [], remote = []) {
  const byId = new Map(local.map((g) => [g.id, g]));
  for (const g of remote) {
    const existing = byId.get(g.id);
    byId.set(g.id, !existing || g.revoked || existing.revoked ? { ...existing, ...g, revoked: Boolean(existing?.revoked || g.revoked) } : g);
  }
  return Array.from(byId.values());
}
