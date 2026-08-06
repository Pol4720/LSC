import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FEES, tierAmount, brokerFee, transportCost, exportCost,
  estimate, maxBidForBudget,
} from '../../assets/js/fees.js';

test('tierAmount picks the bracket the amount falls into', () => {
  const table = DEFAULT_FEES.copart.buyerFee;
  assert.equal(tierAmount(table, 0), 25);
  assert.equal(tierAmount(table, 49.99), 25);
  assert.equal(tierAmount(table, 50), 45);
  assert.equal(tierAmount(table, 999), 305);
  assert.equal(tierAmount(table, 1000), 355);
});

test('tierAmount falls back to the percentage rate above the last bracket', () => {
  const table = DEFAULT_FEES.copart.buyerFee;
  assert.equal(tierAmount(table, 20000), Math.round(20000 * 0.075 * 100) / 100);
});

test('buyer fees never decrease as the price rises', () => {
  for (const key of ['copart', 'iaai', 'manheim', 'acv']) {
    let prev = -1;
    for (let p = 0; p <= 40000; p += 137) {
      const fee = tierAmount(DEFAULT_FEES[key].buyerFee, p);
      assert.ok(fee >= prev - 0.01, `${key}: fee dropped at $${p} (${fee} < ${prev})`);
      prev = fee;
    }
  }
});

test('broker fee follows the published tiers and flattens at $899', () => {
  assert.equal(brokerFee(2000), 499);
  assert.equal(brokerFee(5999), 599);
  assert.equal(brokerFee(9999), 699);
  assert.equal(brokerFee(15999), 799);
  assert.equal(brokerFee(16000), 899);
  assert.equal(brokerFee(90000), 899);
});

test('transport is zero at zero miles and monotonic afterwards', () => {
  assert.equal(transportCost(0), 0);
  let prev = 0;
  for (let m = 25; m <= 3000; m += 25) {
    const c = transportCost(m);
    assert.ok(c >= prev, `transport dropped at ${m} miles`);
    prev = c;
  }
  assert.ok(transportCost(50) >= DEFAULT_FEES.transport.minimum);
});

test('transport surcharges stack in the expected direction', () => {
  const base = transportCost(500);
  assert.ok(transportCost(500, { nonRunning: true }) > base);
  assert.ok(transportCost(500, { oversize: true }) > base);
  assert.ok(transportCost(500, { enclosed: true }) > base);
});

test('export cost is zero when the car stays in the US', () => {
  assert.equal(exportCost('none', 10000), 0);
  assert.ok(exportCost('roro', 10000) > 0);
  assert.ok(exportCost('container40', 10000) > exportCost('roro', 10000));
});

test('estimate of a zero hammer price charges nothing', () => {
  const e = estimate({ hammer: 0 });
  assert.equal(e.total, 0);
  assert.equal(e.lines.length, 0);
});

test('estimate adds up exactly to the sum of its lines', () => {
  const e = estimate({
    hammer: 7500, auction: 'copart', miles: 800, oversize: true,
    repairBudget: 1200, taxRate: 0.07, extra: 150,
  });
  const sum = e.lines.reduce((a, l) => a + l.amount, 0);
  assert.ok(Math.abs(sum - e.total) < 0.02, `lines ${sum} vs total ${e.total}`);
  assert.ok(e.total > 7500);
});

test('estimate is monotonically increasing in the hammer price', () => {
  let prev = -1;
  for (let h = 0; h <= 30000; h += 250) {
    const total = estimate({ hammer: h, miles: 400 }).total;
    assert.ok(total >= prev, `total dropped at hammer $${h}`);
    prev = total;
  }
});

test('maxBidForBudget lands inside the budget and one increment above busts it', () => {
  const opts = { auction: 'copart', miles: 500, taxRate: 0.07 };
  for (const budget of [3000, 8000, 15000, 42000]) {
    const { maxBid } = maxBidForBudget(budget, opts);
    assert.ok(estimate({ ...opts, hammer: maxBid }).total <= budget,
      `budget ${budget}: bid ${maxBid} exceeds it`);
    assert.ok(estimate({ ...opts, hammer: maxBid + 250 }).total > budget,
      `budget ${budget}: bid ${maxBid} leaves too much on the table`);
  }
});

test('maxBidForBudget rounds down to a $25 auction increment', () => {
  const { maxBid } = maxBidForBudget(9137, { miles: 300 });
  assert.equal(maxBid % 25, 0);
});

test('maxBidForBudget reports an impossible budget instead of guessing', () => {
  const r = maxBidForBudget(50, { miles: 2000 });
  assert.equal(r.maxBid, 0);
  assert.equal(r.insufficient, true);
});

test('custom fee tables override the defaults', () => {
  const fees = structuredClone(DEFAULT_FEES);
  fees.broker.flatAbove = 0;
  fees.broker.tiers.rows = [[Infinity, 0]];
  const withBroker = estimate({ hammer: 20000 }).total;
  const without = estimate({ hammer: 20000, fees }).total;
  assert.ok(without < withBroker);
});
