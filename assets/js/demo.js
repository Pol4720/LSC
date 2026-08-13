/* =========================================================================
   Demo mode
   ---------------------------------------------------------------------------
   A self-contained sandbox that runs the whole product end to end — browsing
   auction lots, simulating a bid, real-time cost calculation, a PDF quote and
   an advisor dashboard — on fictional data, with no advisor key, no GitHub
   token and no network write ever required. It is entirely additive: demo
   state lives only in memory, never touches the real console's storage
   (localStorage vault, IndexedDB records) or the repository.
   ========================================================================= */

import { AUCTIONS, byId, TITLE_TYPES, BODY_TYPES } from './catalogs.js';
import { DEFAULT_FEES, estimate } from './fees.js';

let cache = null;

/** Fetches the three fictional JSON datasets, relative to this module so it
 *  resolves correctly under any subpath deployment (e.g. GitHub Pages). */
export async function loadDemoData() {
  if (cache) return cache;
  const base = new URL('../../data/demo/', import.meta.url);
  const [vehicles, clients, bids] = await Promise.all(
    ['vehicles.json', 'clients.json', 'bids.json'].map((f) =>
      fetch(new URL(f, base)).then((r) => {
        if (!r.ok) throw new Error(`demo dataset ${f}: HTTP ${r.status}`);
        return r.json();
      })),
  );
  cache = { vehicles, clients, bids: [...bids] };
  return cache;
}

export function vehicleLabel(v) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`;
}

export function auctionLabel(id) {
  const a = byId(AUCTIONS, id);
  return a ? a.label : id;
}

export function titleLabel(id, lang) {
  const t = byId(TITLE_TYPES, id);
  return t ? (typeof t.label === 'string' ? t.label : t.label[lang]) : id;
}

export function bodyLabel(id, lang) {
  const b = byId(BODY_TYPES, id);
  return b ? (typeof b.label === 'string' ? b.label : b.label[lang]) : id;
}

/**
 * Validate a simulated bid before it can be placed. Returns null when valid,
 * or an i18n-ready error reason otherwise.
 */
export function validateBid(vehicle, amount, { minIncrement = 25 } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'invalid';
  if (n % minIncrement !== 0) return 'increment';
  if (n < vehicle.currentBid + minIncrement) return 'tooLow';
  if (n > vehicle.estRetailValue * 1.5) return 'tooHigh';
  return null;
}

/** Places a simulated bid in memory: appends a bid, updates the vehicle's
 *  current price, and reports whether it becomes the new leading bid. */
export function placeBid(data, { vehicleId, clientId, amount }) {
  const vehicle = data.vehicles.find((v) => v.id === vehicleId);
  const winning = amount > vehicle.currentBid;
  const bid = {
    id: `BID-SIM-${Date.now().toString(36).toUpperCase()}`,
    clientId: clientId || null,
    vehicleId,
    amount,
    status: winning ? 'winning' : 'outbid',
    placedAt: new Date().toISOString(),
    simulated: true,
  };
  data.bids = [bid, ...data.bids];
  if (winning) vehicle.currentBid = amount;
  return bid;
}

/** Runs the shared cost engine for a vehicle at a given hammer price. */
export function quoteFor(vehicle, hammer, opts = {}) {
  return estimate({
    auction: vehicle.source, hammer, fees: DEFAULT_FEES,
    miles: opts.miles ?? 400, includeBroker: true, taxRate: opts.taxRate ?? 0.06,
    exportMode: opts.exportMode ?? 'none', repairBudget: opts.repairBudget ?? 0,
  });
}

/**
 * Advisor performance summary from the fictional portfolio: how many clients,
 * how many cars sold (won bids), and an estimated commission total — the
 * three numbers the mission's "advisor performance dashboard" calls for.
 */
export function performanceSummary(data) {
  const wonBids = data.bids.filter((b) => b.status === 'won');
  let earnings = 0;
  for (const bid of wonBids) {
    const vehicle = data.vehicles.find((v) => v.id === bid.vehicleId);
    if (!vehicle) continue;
    earnings += quoteFor(vehicle, bid.amount).broker;
  }
  return {
    clientCount: data.clients.length,
    carsSold: wonBids.length,
    estimatedEarnings: Math.round(earnings),
    activeBids: data.bids.filter((b) => b.status === 'winning').length,
  };
}
