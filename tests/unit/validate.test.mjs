import test from 'node:test';
import assert from 'node:assert/strict';
import { validateField, validateStep, validateAll, completeness, isValidPhone, RE } from '../../assets/js/validate.js';
import { STEPS, findField, makeDefaults, visibleSteps, visibleFields } from '../../assets/js/schema.js';

const field = (over) => ({ id: 'x.y', type: 'text', label: { es: 'x', en: 'x' }, ...over });

test('required fields reject empty values of every shape', () => {
  const f = field({ required: true });
  for (const empty of ['', '   ', null, undefined, [], {}]) {
    assert.equal(validateField(f, empty, {})?.key, 'err.required', `accepted ${JSON.stringify(empty)}`);
  }
  assert.equal(validateField(f, 'algo', {}), null);
});

test('optional empty fields pass, and skip type validation', () => {
  assert.equal(validateField(field({ type: 'email' }), '', {}), null);
  assert.equal(validateField(field({ type: 'tel' }), null, {}), null);
});

test('email validation', () => {
  const f = field({ type: 'email' });
  for (const ok of ['a@b.co', 'maria.perez+lsc@sub.dominio.com']) assert.equal(validateField(f, ok, {}), null, ok);
  for (const bad of ['a@b', 'sin-arroba.com', 'a b@c.com', '@b.com']) {
    assert.equal(validateField(f, bad, {})?.key, 'err.email', bad);
  }
});

test('phone validation accepts real-world formats', () => {
  for (const ok of ['+1 786 555 0100', '(786) 555-0100', '7865550100', '+53 5 234 5678']) {
    assert.ok(isValidPhone(ok), ok);
  }
  for (const bad of ['', '123', 'no soy un teléfono', '+1234567890123456789']) {
    assert.ok(!isValidPhone(bad), bad);
  }
});

test('url validation', () => {
  const f = field({ type: 'url' });
  assert.equal(validateField(f, 'https://www.copart.com/lot/12345', {}), null);
  assert.equal(validateField(f, 'copart.com', {})?.key, 'err.url');
  assert.ok(RE.url.test('http://bid.cars/x'));
});

test('numeric bounds are enforced with the right message', () => {
  const f = field({ type: 'money', min: 500, max: 1000 });
  assert.equal(validateField(f, 499, {})?.key, 'err.min');
  assert.equal(validateField(f, 499, {})?.vars.min, 500);
  assert.equal(validateField(f, 1001, {})?.vars.max, 1000);
  assert.equal(validateField(f, 750, {}), null);
  assert.equal(validateField(f, 'abc', {})?.key, 'err.number');
});

test('year ranges must be ordered', () => {
  const f = field({ type: 'yearrange' });
  assert.equal(validateField(f, { from: 2010, to: 2020 }, {}), null);
  assert.equal(validateField(f, { from: 2020, to: 2010 }, {})?.key, 'err.year');
});

test('multi-select honours minSelect and max', () => {
  const f = field({ type: 'multi', minSelect: 2, max: 3, options: [] });
  assert.equal(validateField(f, ['a'], {})?.key, 'err.minSelect');
  assert.equal(validateField(f, ['a', 'b'], {}), null);
  assert.equal(validateField(f, ['a', 'b', 'c', 'd'], {})?.key, 'err.maxSelect');
});

test('switch fields only pass when explicitly true', () => {
  const f = field({ type: 'switch', required: true, validate: (v) => (v === true ? null : 'err.required') });
  assert.equal(validateField(f, false, {})?.key, 'err.required');
  assert.equal(validateField(f, true, {}), null);
});

test('custom "err.key:param" shorthand parses into vars', () => {
  const f = field({ validate: () => 'err.minLen:3' });
  const e = validateField(f, 'ab', {});
  assert.equal(e.key, 'err.minLen');
  assert.equal(e.vars.min, '3');
});

test('info fields are never validated', () => {
  assert.equal(validateField(field({ type: 'info', required: true }), undefined, {}), null);
});

/* ---- schema-level ------------------------------------------------------- */

test('an empty answer set fails exactly the required, visible fields', () => {
  const data = makeDefaults();
  const errors = validateAll(data, 'full');
  const required = [];
  for (const step of visibleSteps('full')) {
    for (const f of visibleFields(step, data, 'full')) {
      if (f.type === 'info') continue;
      const req = typeof f.required === 'function' ? f.required(data) : f.required;
      if (req) required.push(f.id);
    }
  }
  assert.deepEqual(Object.keys(errors).sort(), required.sort());
  assert.ok(required.length > 4, 'the schema should demand a handful of answers');
});

test('a complete answer set validates clean', () => {
  const data = fullAnswers();
  assert.deepEqual(validateAll(data, 'full'), {});
  assert.deepEqual(validateAll(data, 'express'), {});
});

test('conditional fields are not validated while hidden', () => {
  const data = fullAnswers();
  data.logistics.finalDestination = 'usa';
  const step = STEPS.find((s) => s.id === 'logistics');
  const errs = validateStep(step, data, 'full');
  assert.ok(!('logistics.exportCountry' in errs));
});

test('completeness climbs from empty to ready', () => {
  const empty = completeness(makeDefaults(), 'full');
  assert.equal(empty.ready, false);
  assert.ok(empty.percent < 30);

  const full = completeness(fullAnswers(), 'full');
  assert.equal(full.ready, true);
  assert.equal(full.requiredPercent, 100);
  assert.ok(full.percent > empty.percent);
});

test('express mode asks for strictly fewer fields than full mode', () => {
  const data = fullAnswers();
  assert.ok(completeness(data, 'express').total < completeness(data, 'full').total);
});

test('every field referenced by findField exists', () => {
  assert.ok(findField('contact.fullName'));
  assert.equal(findField('no.such.field'), null);
});

/* ------------------------------------------------------------------------ */
export function fullAnswers() {
  return {
    ...makeDefaults(),
    contact: {
      fullName: 'María Fernández', phone: '+1 786 555 0100', email: 'maria@example.com',
      city: 'Hialeah', state: 'FL', channel: ['whatsapp'], bestTime: 'evening',
      language: 'es', heardFrom: 'facebook',
    },
    goal: { useCases: ['daily', 'family'], experience: 'none', passengers: '3-4', monthlyMiles: 'mid' },
    budget: {
      total: 12000, includesEverything: 'all', flexibility: 10, payment: ['zelle'],
      depositReady: 'ready', urgency: 'month',
    },
    vehicle: {
      bodyTypes: ['suv'], makes: ['Toyota'], models: ['RAV4'], years: { from: 2015, to: 2021 },
      maxMileage: 120000, transmission: 'auto', drivetrain: 'any', fuel: ['gas'],
      priority: 50, features: ['camera', 'carplay'], mustHave: ['camera'], colors: ['any'],
    },
    condition: {
      titles: ['clean', 'rebuilt'], damageTolerance: 'cosmetic', dealBreakers: ['water', 'burn'],
      runDrive: 'required', keys: 'yes', airbags: 'no', odometer: 'yes',
      repairBudget: 1500, hasShop: 'shop', sightUnseen: 'yes', history: 'yes',
    },
    sourcing: { platforms: ['copart', 'iaai'], geoFlexible: 'anywhere', alerts: 'yes' },
    logistics: {
      transport: 'managed', destinationCity: 'Miami', destinationZip: '33012',
      carrierType: 'open', finalDestination: 'usa', titleHelp: 'yes',
      registrationState: 'FL', hasLicense: 'yes',
    },
    references: { lots: [], previousCars: ['Honda Civic 2012'], notes: 'Prefiero color claro.' },
    consent: { dataUse: true, contact: true, signature: 'María Fernández' },
  };
}
