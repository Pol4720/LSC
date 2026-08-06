import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAdvisorKeyPair, keyFingerprint, seal, open, isEnvelope,
  wrapPrivateKey, unwrapPrivateKey, packPayload, unpackPayload,
  bytesToB64, b64ToBytes, randomBytes, sha256Hex, ALG,
} from '../../assets/js/crypto.js';

const SAMPLE = {
  id: 'LSC-20260806-A1B2C3',
  data: {
    contact: { fullName: 'María Fernández Ñandú', phone: '+1 786 555 0100', email: 'm@example.com' },
    budget: { total: 12500 },
    vehicle: { makes: ['Toyota', 'Honda'], years: { from: 2014, to: 2022 } },
    references: { notes: 'Acentos: áéíóú ñ ¿? ¡! — emojis 🚗🔨' },
  },
};

test('base64 round-trips arbitrary bytes', () => {
  for (const n of [0, 1, 17, 1024, 70000]) {
    const bytes = randomBytes(n);
    assert.deepEqual(Array.from(b64ToBytes(bytesToB64(bytes))), Array.from(bytes));
  }
});

test('a key pair produces a stable fingerprint', async () => {
  const kp = await generateAdvisorKeyPair();
  assert.equal(kp.publicJwk.kty, 'EC');
  assert.equal(kp.publicJwk.crv, 'P-256');
  assert.equal(kp.kid.length, 16);
  assert.equal(await keyFingerprint(kp.publicJwk), kp.kid);
  assert.ok(!('d' in kp.publicJwk), 'public JWK must not carry the private scalar');
  assert.ok('d' in kp.privateJwk);
});

test('seal → open round-trips the payload exactly', async () => {
  const { publicJwk, privateJwk } = await generateAdvisorKeyPair();
  const envelope = await seal(SAMPLE, publicJwk);
  assert.equal(envelope.alg, ALG);
  assert.ok(isEnvelope(envelope));
  assert.deepEqual(await open(envelope, privateJwk), SAMPLE);
});

test('the envelope leaks no plaintext', async () => {
  const { publicJwk } = await generateAdvisorKeyPair();
  const envelope = await seal(SAMPLE, publicJwk);
  const blob = JSON.stringify(envelope);
  for (const secret of ['María', 'Fernández', '786', '12500', 'Toyota', 'example.com']) {
    assert.ok(!blob.includes(secret), `envelope leaked "${secret}"`);
  }
});

test('two seals of the same payload differ (fresh ephemeral key + IV)', async () => {
  const { publicJwk } = await generateAdvisorKeyPair();
  const a = await seal(SAMPLE, publicJwk);
  const b = await seal(SAMPLE, publicJwk);
  assert.notEqual(a.ct, b.ct);
  assert.notEqual(a.iv, b.iv);
  assert.notDeepEqual(a.epk, b.epk);
});

test('the wrong private key cannot open an envelope', async () => {
  const alice = await generateAdvisorKeyPair();
  const mallory = await generateAdvisorKeyPair();
  const envelope = await seal(SAMPLE, alice.publicJwk);
  await assert.rejects(() => open(envelope, mallory.privateJwk));
});

test('tampering with the ciphertext is detected by the GCM tag', async () => {
  const { publicJwk, privateJwk } = await generateAdvisorKeyPair();
  const envelope = await seal(SAMPLE, publicJwk);
  const bytes = b64ToBytes(envelope.ct);
  bytes[Math.floor(bytes.length / 2)] ^= 0xff;
  await assert.rejects(() => open({ ...envelope, ct: bytesToB64(bytes) }, privateJwk));
});

test('an unknown algorithm is rejected rather than guessed', async () => {
  const { privateJwk } = await generateAdvisorKeyPair();
  await assert.rejects(() => open({ alg: 'ROT13', ct: 'x', iv: 'y' }, privateJwk), /Unsupported/);
});

test('the passphrase vault round-trips and rejects the wrong passphrase', async () => {
  const { privateJwk } = await generateAdvisorKeyPair();
  const vault = await wrapPrivateKey(privateJwk, 'una-contraseña-larga-2026');
  assert.ok(!JSON.stringify(vault).includes(privateJwk.d));
  assert.deepEqual(await unwrapPrivateKey(vault, 'una-contraseña-larga-2026'), privateJwk);
  await assert.rejects(() => unwrapPrivateKey(vault, 'otra-contraseña'), /BAD_PASSPHRASE/);
});

test('short passphrases are refused up front', async () => {
  const { privateJwk } = await generateAdvisorKeyPair();
  await assert.rejects(() => wrapPrivateKey(privateJwk, 'corta'), /PASSPHRASE_TOO_SHORT/);
});

test('a vault-wrapped key still decrypts real envelopes', async () => {
  const { publicJwk, privateJwk } = await generateAdvisorKeyPair();
  const vault = await wrapPrivateKey(privateJwk, 'passphrase-de-prueba');
  const envelope = await seal(SAMPLE, publicJwk);
  const recovered = await unwrapPrivateKey(vault, 'passphrase-de-prueba');
  assert.deepEqual(await open(envelope, recovered), SAMPLE);
});

test('pack → unpack round-trips and compresses', async () => {
  const packed = await packPayload(SAMPLE);
  assert.match(packed, /^[zr]/);
  assert.deepEqual(await unpackPayload(packed), SAMPLE);
  const bulky = { rows: Array.from({ length: 400 }, (_, i) => ({ i, text: 'repetición constante' })) };
  const packedBulky = await packPayload(bulky);
  assert.ok(packedBulky.length < JSON.stringify(bulky).length / 2, 'compression did not help');
  assert.deepEqual(await unpackPayload(packedBulky), bulky);
});

test('unpack rejects garbage instead of throwing something cryptic', async () => {
  await assert.rejects(() => unpackPayload(''), /BAD_PAYLOAD/);
  await assert.rejects(() => unpackPayload('q!!!'), /BAD_PAYLOAD/);
});

test('a sealed envelope survives the share-link transport intact', async () => {
  const { publicJwk, privateJwk } = await generateAdvisorKeyPair();
  const envelope = await seal(SAMPLE, publicJwk);
  const link = `https://example.com/console.html#import=${await packPayload(envelope)}`;
  const packed = /#import=(.+)$/.exec(link)[1];
  assert.deepEqual(await open(await unpackPayload(packed), privateJwk), SAMPLE);
});

test('sha256Hex matches the known digest of "abc"', async () => {
  assert.equal(await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
