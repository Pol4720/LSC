import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  vehicleLabel, auctionLabel, validateBid, placeBid, quoteFor, performanceSummary,
} from '../../assets/js/demo.js';

// loadDemoData() itself is not exercised here: it resolves its dataset paths
// relative to import.meta.url via fetch(), which only works against http(s)
// URLs — true in the browser (where this module is served over http/https)
// but not under plain `node --test`, where the module's URL is file://.
// Playwright's e2e suite covers the real fetch path; these tests cover the
// dataset's shape and every pure function built on top of it.

async function readDataset(name) {
  return JSON.parse(await readFile(new URL(`../../data/demo/${name}.json`, import.meta.url), 'utf8'));
}

test('the fictional dataset meets the mission\'s minimum sizes', async () => {
  const vehicles = await readDataset('vehicles');
  const clients = await readDataset('clients');
  const bids = await readDataset('bids');
  assert.ok(vehicles.length >= 20, `only ${vehicles.length} vehicles`);
  assert.ok(clients.length >= 10, `only ${clients.length} clients`);
  assert.ok(bids.length >= 30, `only ${bids.length} bids`);

  const vehicleIds = new Set(vehicles.map((v) => v.id));
  const clientIds = new Set(clients.map((c) => c.id));
  for (const v of vehicles) {
    assert.ok(v.vin && v.vin.length === 17, `${v.id}: bad VIN`);
    assert.ok(v.currentBid > 0 && v.estRetailValue > 0, `${v.id}: bad pricing`);
  }
  for (const b of bids) {
    assert.ok(vehicleIds.has(b.vehicleId), `bid ${b.id} references unknown vehicle`);
    assert.ok(clientIds.has(b.clientId), `bid ${b.id} references unknown client`);
    assert.ok(b.amount > 0, `bid ${b.id}: non-positive amount`);
  }
});

test('vehicleLabel and auctionLabel format sensibly', () => {
  const v = { year: 2020, make: 'Toyota', model: 'Camry', trim: 'SE' };
  assert.equal(vehicleLabel(v), '2020 Toyota Camry SE');
  assert.equal(vehicleLabel({ year: 2020, make: 'Honda', model: 'Civic' }), '2020 Honda Civic');
  assert.equal(auctionLabel('copart'), 'Copart');
});

test('validateBid rejects non-numeric, below-increment and below-current amounts', () => {
  const vehicle = { currentBid: 5000, estRetailValue: 20000 };
  assert.equal(validateBid(vehicle, 'abc'), 'invalid');
  assert.equal(validateBid(vehicle, 0), 'invalid');
  assert.equal(validateBid(vehicle, 5010), 'increment');
  assert.equal(validateBid(vehicle, 5000), 'tooLow');
  assert.equal(validateBid(vehicle, 100000), 'tooHigh');
  assert.equal(validateBid(vehicle, 5025), null);
});

test('placeBid appends a bid and updates the leading price only when it wins', () => {
  const data = {
    vehicles: [{ id: 'V1', currentBid: 5000 }],
    bids: [],
  };
  const outbid = placeBid(data, { vehicleId: 'V1', clientId: 'C1', amount: 5025 });
  assert.equal(outbid.status, 'winning');
  assert.equal(data.vehicles[0].currentBid, 5025);
  assert.equal(data.bids.length, 1);

  const losing = placeBid(data, { vehicleId: 'V1', clientId: 'C2', amount: 5025 });
  assert.equal(losing.status, 'outbid');
  assert.equal(data.vehicles[0].currentBid, 5025, 'a tie must not become the new leader');
});

test('quoteFor runs the shared cost engine for a vehicle', () => {
  const vehicle = { source: 'copart' };
  const result = quoteFor(vehicle, 6000);
  assert.equal(result.hammer, 6000);
  assert.ok(result.total > 6000);
  assert.ok(result.lines.some((l) => l.id === 'buyerFee'));
});

test('performanceSummary counts clients, sold cars and estimated commission', () => {
  const data = {
    clients: [{ id: 'C1' }, { id: 'C2' }],
    vehicles: [{ id: 'V1', source: 'copart' }],
    bids: [
      { id: 'B1', vehicleId: 'V1', amount: 6000, status: 'won' },
      { id: 'B2', vehicleId: 'V1', amount: 7000, status: 'winning' },
      { id: 'B3', vehicleId: 'V1', amount: 4000, status: 'outbid' },
    ],
  };
  const perf = performanceSummary(data);
  assert.equal(perf.clientCount, 2);
  assert.equal(perf.carsSold, 1);
  assert.equal(perf.activeBids, 1);
  assert.ok(perf.estimatedEarnings > 0);
});
