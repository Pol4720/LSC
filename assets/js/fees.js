/* =========================================================================
   LSC · All-in cost engine
   ---------------------------------------------------------------------------
   Turns a hammer price into the number the client actually pays, and inverts
   it: given an all-in budget, what is the highest safe hammer bid?

   IMPORTANT: every table below is an EDITABLE DEFAULT, not an official quote.
   Auction houses revise their fee schedules regularly, so the advisor console
   exposes the whole structure for editing and persists overrides to the repo.
   Always confirm against the live fee schedule before committing to a bid.
   ========================================================================= */

/** Tiered fee table: [maxHammerPriceExclusive, feeAmount]. Last entry may be a rate. */
const T = (rows, tailRate) => ({ rows, tailRate });

export const DEFAULT_FEES = {
  version: 3,
  updated: '2026-08-01',
  currency: 'USD',

  copart: {
    label: 'Copart',
    /** Standard (non-licensed / public) buyer fee brackets. */
    buyerFee: T([
      [50, 25], [100, 45], [200, 80], [300, 130], [350, 132.5], [400, 150],
      [450, 170], [500, 180], [550, 200], [600, 205], [700, 235], [800, 260],
      [900, 280], [1000, 305], [1200, 355], [1300, 380], [1400, 400], [1500, 410],
      [1600, 450], [1700, 465], [1800, 485], [2000, 505], [2400, 555], [2500, 575],
      [3000, 610], [3500, 655], [4000, 705], [4500, 725], [5000, 750], [6000, 775],
      [7000, 800], [7500, 825], [10000, 845], [15000, 880],
    ], 0.075),
    /** Internet / virtual bidding fee. */
    virtualBidFee: T([
      [100, 0], [500, 39], [1000, 49], [1500, 59], [2000, 69], [4000, 79],
      [6000, 89], [8000, 99], [Infinity, 119],
    ], 0),
    gateFee: 95,
    environmentalFee: 15,
    docFee: 79,
    /** Broadly applied when the lot is not paid within the free window. */
    lateFeePerDay: 50,
    freeStorageDays: 3,
  },

  iaai: {
    label: 'IAA (IAAI)',
    buyerFee: T([
      [50, 25], [100, 50], [200, 85], [300, 135], [400, 155], [500, 185],
      [600, 210], [700, 240], [800, 265], [900, 285], [1000, 310], [1200, 360],
      [1400, 405], [1600, 455], [1800, 490], [2000, 510], [2400, 560], [2500, 580],
      [3000, 615], [3500, 660], [4000, 710], [4500, 730], [5000, 755], [6000, 780],
      [7000, 805], [7500, 830], [10000, 850], [15000, 885],
    ], 0.075),
    virtualBidFee: T([
      [100, 0], [500, 39], [1000, 49], [1500, 59], [2000, 69], [4000, 79],
      [6000, 89], [8000, 99], [Infinity, 129],
    ], 0),
    gateFee: 79,
    environmentalFee: 15,
    docFee: 79,
    lateFeePerDay: 50,
    freeStorageDays: 2,
  },

  manheim: {
    label: 'Manheim',
    buyerFee: T([
      [1000, 200], [2000, 280], [3000, 340], [4000, 400], [5000, 450],
      [7500, 520], [10000, 580], [15000, 640], [20000, 700], [30000, 790],
    ], 0.03),
    virtualBidFee: T([[Infinity, 75]], 0),
    gateFee: 60,
    environmentalFee: 0,
    docFee: 65,
    lateFeePerDay: 40,
    freeStorageDays: 3,
  },

  acv: {
    label: 'ACV Auctions',
    buyerFee: T([
      [2500, 250], [5000, 325], [10000, 425], [15000, 525], [25000, 625],
    ], 0.028),
    virtualBidFee: T([[Infinity, 0]], 0),
    gateFee: 0,
    environmentalFee: 0,
    docFee: 75,
    lateFeePerDay: 0,
    freeStorageDays: 3,
  },

  /** Broker representation fee, tiered on final purchase price. */
  broker: {
    label: { es: 'Comisión de representación', en: 'Representation fee' },
    tiers: T([
      [3000, 499], [6000, 599], [10000, 699], [16000, 799],
    ], 0),
    flatAbove: 899,
    /** Paid advisory session pricing (informational). */
    advisoryFirst: 149,
    advisoryExtra: 39,
  },

  /** Ground transport estimate (Super Dispatch style: base + per-mile taper). */
  transport: {
    base: 180,
    perMileTiers: [
      [250, 1.55],   // first 250 miles
      [750, 1.05],   // 251-750
      [1500, 0.82],  // 751-1500
      [Infinity, 0.68],
    ],
    nonRunningSurcharge: 175,
    oversizeSurcharge: 150,   // pickup / SUV / van
    enclosedMultiplier: 1.6,
    minimum: 225,
  },

  /** Title, registration and paperwork. */
  paperwork: {
    titleProcessing: 125,
    notary: 25,
    tempTag: 45,
  },

  /** Export logistics, when the destination is outside the US. */
  export: {
    roro: 1150,
    container20Shared: 1450,
    container40Exclusive: 3200,
    portHandling: 275,
    oceanInsuranceRate: 0.015, // of declared value
    customsBroker: 225,
  },

  /** Sales tax applied on the hammer + fees when registering in-state. */
  taxRateDefault: 0.07,
};

/* ------------------------------------------------------------- lookups --- */
export function tierAmount(table, amount) {
  if (!table) return 0;
  const rows = table.rows || [];
  for (const [max, fee] of rows) if (amount < max) return fee;
  const rate = table.tailRate || 0;
  return rate > 0 ? round2(amount * rate) : (rows.length ? rows[rows.length - 1][1] : 0);
}

export function brokerFee(price, fees = DEFAULT_FEES) {
  const b = fees.broker;
  for (const [max, fee] of b.tiers.rows) if (price < max) return fee;
  return b.flatAbove;
}

export function transportCost(miles, opts = {}, fees = DEFAULT_FEES) {
  const cfg = fees.transport;
  const m = Math.max(0, Number(miles) || 0);
  if (m === 0) return 0;
  let cost = cfg.base;
  let remaining = m, prev = 0;
  for (const [upTo, rate] of cfg.perMileTiers) {
    const span = Math.min(remaining, upTo - prev);
    if (span <= 0) break;
    cost += span * rate;
    remaining -= span;
    prev = upTo;
    if (remaining <= 0) break;
  }
  if (opts.nonRunning) cost += cfg.nonRunningSurcharge;
  if (opts.oversize) cost += cfg.oversizeSurcharge;
  if (opts.enclosed) cost *= cfg.enclosedMultiplier;
  return round2(Math.max(cfg.minimum, cost));
}

export function exportCost(mode, declaredValue = 0, fees = DEFAULT_FEES) {
  const e = fees.export;
  const shipping = mode === 'roro' ? e.roro
    : mode === 'container20' ? e.container20Shared
    : mode === 'container40' ? e.container40Exclusive
    : 0;
  if (!shipping) return 0;
  return round2(shipping + e.portHandling + e.customsBroker + declaredValue * e.oceanInsuranceRate);
}

/* ------------------------------------------------------------ estimate --- */
/**
 * Full breakdown for a given hammer price.
 *
 * @param {object} o
 * @param {number} o.hammer            winning bid before fees
 * @param {'copart'|'iaai'|'manheim'|'acv'} [o.auction='copart']
 * @param {number} [o.miles=0]         yard → destination distance
 * @param {boolean} [o.nonRunning]     vehicle does not start
 * @param {boolean} [o.oversize]       SUV / pickup / van
 * @param {boolean} [o.enclosed]       enclosed carrier
 * @param {boolean} [o.includeBroker=true]
 * @param {boolean} [o.includePaperwork=true]
 * @param {number}  [o.repairBudget=0]
 * @param {number}  [o.taxRate=0]      0 to skip
 * @param {'none'|'roro'|'container20'|'container40'} [o.exportMode='none']
 * @param {number} [o.extra=0]         arbitrary extra costs
 * @param {object} [o.fees]            fee table override
 */
export function estimate(o = {}) {
  const fees = o.fees || DEFAULT_FEES;
  const hammer = Math.max(0, Number(o.hammer) || 0);
  const key = o.auction && fees[o.auction] ? o.auction : 'copart';
  const a = fees[key];

  // No bid, no charges — every auction fee is contingent on an actual sale.
  const buyer = hammer > 0 ? tierAmount(a.buyerFee, hammer) : 0;
  const virtualBid = hammer > 0 ? tierAmount(a.virtualBidFee, hammer) : 0;
  const gate = hammer > 0 ? a.gateFee : 0;
  const env = hammer > 0 ? a.environmentalFee : 0;
  const doc = hammer > 0 ? a.docFee : 0;
  const auctionFees = round2(buyer + virtualBid + gate + env + doc);

  const broker = o.includeBroker === false || hammer === 0 ? 0 : brokerFee(hammer, fees);
  const transport = transportCost(o.miles, o, fees);
  const paperwork = o.includePaperwork === false || hammer === 0
    ? 0
    : round2(fees.paperwork.titleProcessing + fees.paperwork.notary);
  const exportFees = exportCost(o.exportMode, hammer, fees);
  const repair = Math.max(0, Number(o.repairBudget) || 0);
  const extra = Math.max(0, Number(o.extra) || 0);

  const taxableBase = hammer + auctionFees;
  const taxRate = Math.max(0, Number(o.taxRate) || 0);
  const tax = round2(taxableBase * taxRate);

  const subtotalAuction = round2(hammer + auctionFees + tax);
  const total = round2(subtotalAuction + broker + transport + paperwork + exportFees + repair + extra);

  return {
    hammer: round2(hammer),
    auction: key,
    auctionLabel: a.label,
    lines: [
      { id: 'hammer', group: 'auction', amount: round2(hammer) },
      { id: 'buyerFee', group: 'auction', amount: round2(buyer) },
      { id: 'virtualBidFee', group: 'auction', amount: round2(virtualBid) },
      { id: 'gateFee', group: 'auction', amount: round2(gate) },
      { id: 'environmentalFee', group: 'auction', amount: round2(env) },
      { id: 'docFee', group: 'auction', amount: round2(doc) },
      { id: 'tax', group: 'auction', amount: tax },
      { id: 'broker', group: 'service', amount: round2(broker) },
      { id: 'transport', group: 'logistics', amount: round2(transport) },
      { id: 'paperwork', group: 'service', amount: paperwork },
      { id: 'export', group: 'logistics', amount: exportFees },
      { id: 'repair', group: 'other', amount: round2(repair) },
      { id: 'extra', group: 'other', amount: round2(extra) },
    ].filter((l) => l.amount > 0),
    auctionFees,
    broker: round2(broker),
    transport: round2(transport),
    paperwork,
    exportFees,
    repair: round2(repair),
    extra: round2(extra),
    tax,
    subtotalAuction,
    total,
    /** Everything on top of the hammer price, as a share of the hammer. */
    overheadRatio: hammer > 0 ? round2((total - hammer) / hammer) : 0,
  };
}

/**
 * Inverse solve: the highest hammer price whose all-in total stays within
 * `budget`. Monotonic in `hammer`, so a bisection converges quickly.
 */
export function maxBidForBudget(budget, opts = {}) {
  const target = Number(budget) || 0;
  if (target <= 0) return { maxBid: 0, estimate: estimate({ ...opts, hammer: 0 }) };
  if (estimate({ ...opts, hammer: 0 }).total > target) {
    return { maxBid: 0, estimate: estimate({ ...opts, hammer: 0 }), insufficient: true };
  }
  let lo = 0, hi = Math.max(1000, target);
  while (estimate({ ...opts, hammer: hi }).total <= target && hi < 10_000_000) hi *= 2;
  for (let i = 0; i < 60 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    if (estimate({ ...opts, hammer: mid }).total <= target) lo = mid; else hi = mid;
  }
  const maxBid = Math.floor(lo / 25) * 25; // auctions bid in $25 increments
  return { maxBid, estimate: estimate({ ...opts, hammer: maxBid }) };
}

/* --------------------------------------------------------------- i18n ---- */
export const LINE_LABELS = {
  hammer: { es: 'Precio de martillo (puja ganadora)', en: 'Hammer price (winning bid)' },
  buyerFee: { es: 'Comisión de la subasta (buyer fee)', en: 'Auction buyer fee' },
  virtualBidFee: { es: 'Cargo por puja en línea', en: 'Internet bid fee' },
  gateFee: { es: 'Gate fee (salida del patio)', en: 'Gate fee' },
  environmentalFee: { es: 'Cargo ambiental', en: 'Environmental fee' },
  docFee: { es: 'Documentación de la subasta', en: 'Auction documentation' },
  tax: { es: 'Impuesto sobre la venta', en: 'Sales tax' },
  broker: { es: 'Comisión del bróker', en: 'Broker fee' },
  transport: { es: 'Transporte terrestre', en: 'Ground transport' },
  paperwork: { es: 'Título, traspaso y notaría', en: 'Title, transfer & notary' },
  export: { es: 'Exportación (naviera, puerto, aduana)', en: 'Export (ocean, port, customs)' },
  repair: { es: 'Presupuesto de reparación', en: 'Repair budget' },
  extra: { es: 'Otros gastos', en: 'Other costs' },
};

export const GROUP_LABELS = {
  auction: { es: 'Subasta', en: 'Auction' },
  service: { es: 'Servicio', en: 'Service' },
  logistics: { es: 'Logística', en: 'Logistics' },
  other: { es: 'Otros', en: 'Other' },
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
