/* =========================================================================
   LSC · End-to-end encryption
   ---------------------------------------------------------------------------
   The data repository is PUBLIC (GitHub Pages on a free account requires it),
   so every client submission is sealed before it ever leaves the browser.

   Scheme (ECIES-style, all via WebCrypto, no dependencies):
     · Advisor holds an ECDH P-256 key pair. The PUBLIC key is committed to the
       repo; the PRIVATE key never leaves the advisor's browser (wrapped with a
       passphrase-derived AES-GCM key, PBKDF2-SHA256).
     · Each submission generates an EPHEMERAL P-256 key pair, derives a shared
       secret with the advisor's public key (ECDH), stretches it through
       HKDF-SHA256, and encrypts the payload with AES-256-GCM.
     · The ephemeral public key travels with the ciphertext; the ephemeral
       private key is discarded. Forward secrecy per record.

   Envelope format (JSON, safe to publish):
     { v:1, alg:'ECDH-P256-HKDF-A256GCM', kid, epk, iv, ct, ts }
   ========================================================================= */

const subtle = () => {
  const c = globalThis.crypto?.subtle;
  if (!c) throw new Error('WebCrypto (crypto.subtle) is unavailable. Use HTTPS or localhost.');
  return c;
};

export const ALG = 'ECDH-P256-HKDF-A256GCM';
export const ENVELOPE_VERSION = 1;
const CURVE = 'P-256';
const PBKDF2_ITERATIONS = 310_000;
const HKDF_INFO = 'LSC/submission/v1';

/* ------------------------------------------------------------ encoding --- */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

export function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const b64url = (bytes) => bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** getRandomValues caps at 65 536 bytes per call, so fill in chunks. */
export function randomBytes(n) {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) globalThis.crypto.getRandomValues(b.subarray(i, Math.min(n, i + 65536)));
  return b;
}

/* ------------------------------------------------------------ key mgmt --- */
/** Generate the advisor's long-term ECDH key pair. */
export async function generateAdvisorKeyPair() {
  const kp = await subtle().generateKey({ name: 'ECDH', namedCurve: CURVE }, true, ['deriveBits']);
  const publicJwk = await subtle().exportKey('jwk', kp.publicKey);
  const privateJwk = await subtle().exportKey('jwk', kp.privateKey);
  delete publicJwk.key_ops; delete publicJwk.ext;
  const kid = await keyFingerprint(publicJwk);
  return { publicJwk: { ...publicJwk, kid }, privateJwk: { ...privateJwk, kid }, kid };
}

/** Stable short fingerprint (SHA-256 of the raw curve point, base64url, 16 chars). */
export async function keyFingerprint(jwk) {
  const material = enc.encode(`${jwk.crv}|${jwk.x}|${jwk.y}`);
  const hash = await subtle().digest('SHA-256', material);
  return b64url(new Uint8Array(hash)).slice(0, 16);
}

export const importPublicKey = (jwk) =>
  subtle().importKey('jwk', stripJwk(jwk, ['kid']), { name: 'ECDH', namedCurve: CURVE }, true, []);

export const importPrivateKey = (jwk) =>
  subtle().importKey('jwk', stripJwk(jwk, ['kid']), { name: 'ECDH', namedCurve: CURVE }, true, ['deriveBits']);

function stripJwk(jwk, keys) {
  const out = { ...jwk };
  for (const k of keys) delete out[k];
  delete out.ext;
  return out;
}

/* --------------------------------------------------------- derivation --- */
async function deriveAesKey(privateKey, publicKey, salt) {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdfKey = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(HKDF_INFO) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ------------------------------------------------------------- sealing --- */
/**
 * Seal an arbitrary JSON payload for the advisor's public key.
 * @returns {Promise<object>} publishable envelope
 */
export async function seal(payload, advisorPublicJwk) {
  const pub = await importPublicKey(advisorPublicJwk);
  const eph = await subtle().generateKey({ name: 'ECDH', namedCurve: CURVE }, true, ['deriveBits']);
  const iv = randomBytes(12);
  const salt = randomBytes(16);
  const key = await deriveAesKey(eph.privateKey, pub, salt);
  const plaintext = enc.encode(JSON.stringify(payload));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext);
  const epk = await subtle().exportKey('jwk', eph.publicKey);
  return {
    v: ENVELOPE_VERSION,
    alg: ALG,
    kid: advisorPublicJwk.kid || (await keyFingerprint(advisorPublicJwk)),
    epk: { kty: epk.kty, crv: epk.crv, x: epk.x, y: epk.y },
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ct: bytesToB64(new Uint8Array(ct)),
    ts: new Date().toISOString(),
  };
}

/** Open a sealed envelope with the advisor's private key. */
export async function open(envelope, advisorPrivateJwk) {
  if (!envelope || envelope.alg !== ALG) throw new Error(`Unsupported envelope algorithm: ${envelope?.alg}`);
  const priv = await importPrivateKey(advisorPrivateJwk);
  const epk = await importPublicKey(envelope.epk);
  const key = await deriveAesKey(priv, epk, b64ToBytes(envelope.salt));
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.iv), tagLength: 128 }, key, b64ToBytes(envelope.ct),
  );
  return JSON.parse(dec.decode(plain));
}

export const isEnvelope = (o) =>
  !!o && typeof o === 'object' && o.alg === ALG && typeof o.ct === 'string' && typeof o.iv === 'string';

/* ------------------------------------- passphrase wrapping (key vault) --- */
async function passphraseKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Wrap the advisor's private JWK with a passphrase — safe to store/back up. */
export async function wrapPrivateKey(privateJwk, passphrase) {
  if (!passphrase || passphrase.length < 8) throw new Error('PASSPHRASE_TOO_SHORT');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passphraseKey(passphrase, salt);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(privateJwk)));
  return {
    v: ENVELOPE_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ct: bytesToB64(new Uint8Array(ct)),
    kid: privateJwk.kid || null,
  };
}

/** Unwrap a passphrase-protected private JWK. Throws 'BAD_PASSPHRASE' on failure. */
export async function unwrapPrivateKey(vault, passphrase) {
  const key = await passphraseKey(passphrase, b64ToBytes(vault.salt), vault.iterations || PBKDF2_ITERATIONS);
  try {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: b64ToBytes(vault.iv) }, key, b64ToBytes(vault.ct));
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('BAD_PASSPHRASE');
  }
}

/* ---------------------------------------------- compact share transport --- */
/**
 * Compress + base64url-encode any JSON so it can ride inside a URL fragment.
 * Uses native DEFLATE when available and falls back to plain base64url.
 */
export async function packPayload(obj) {
  const json = enc.encode(JSON.stringify(obj));
  if (typeof globalThis.CompressionStream === 'function') {
    try {
      const cs = new globalThis.CompressionStream('deflate-raw');
      const stream = new Blob([json]).stream().pipeThrough(cs);
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return 'z' + b64url(buf);
    } catch { /* fall through */ }
  }
  return 'r' + b64url(json);
}

export async function unpackPayload(packed) {
  if (typeof packed !== 'string' || packed.length < 2) throw new Error('BAD_PAYLOAD');
  const mode = packed[0];
  if (mode !== 'r' && mode !== 'z') throw new Error('BAD_PAYLOAD');

  let bytes;
  try { bytes = b64ToBytes(packed.slice(1)); }
  catch { throw new Error('BAD_PAYLOAD'); }

  try {
    if (mode === 'r') return JSON.parse(dec.decode(bytes));
    if (typeof globalThis.DecompressionStream !== 'function') throw new Error('DECOMPRESSION_UNSUPPORTED');
    const ds = new globalThis.DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return JSON.parse(dec.decode(out));
  } catch (e) {
    if (e.message === 'DECOMPRESSION_UNSUPPORTED') throw e;
    throw new Error('BAD_PAYLOAD');
  }
}

/* -------------------------------------------------------------- digest --- */
export async function sha256Hex(text) {
  const h = await subtle().digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
