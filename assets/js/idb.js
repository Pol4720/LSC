/* =========================================================================
   LSC · Minimal IndexedDB wrapper
   ---------------------------------------------------------------------------
   The console keeps decrypted records in IndexedDB so search stays instant and
   the tool works offline. Everything here is generic key/value over one store.
   ========================================================================= */

const DB_NAME = 'lsc';
const DB_VERSION = 1;
const STORES = ['records', 'crm', 'meta'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const os = transaction.objectStore(store);
    let result;
    try { result = fn(os); } catch (e) { reject(e); return; }
    transaction.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

const wrap = (req) => ({ __req: req });

export const idb = {
  async get(store, key) { return tx(store, 'readonly', (os) => wrap(os.get(key))); },
  async set(store, key, value) { return tx(store, 'readwrite', (os) => wrap(os.put(value, key))); },
  async del(store, key) { return tx(store, 'readwrite', (os) => wrap(os.delete(key))); },
  async clear(store) { return tx(store, 'readwrite', (os) => wrap(os.clear())); },
  async keys(store) { return tx(store, 'readonly', (os) => wrap(os.getAllKeys())); },
  async all(store) { return tx(store, 'readonly', (os) => wrap(os.getAll())); },
  async setMany(store, entries) {
    return tx(store, 'readwrite', (os) => { for (const [k, v] of entries) os.put(v, k); return true; });
  },
  available: Boolean(globalThis.indexedDB),
};

/** localStorage-backed fallback with the same surface, for hostile environments. */
export function memoryFallback() {
  const mem = new Map(STORES.map((s) => [s, new Map()]));
  return {
    available: false,
    async get(store, key) { return mem.get(store).get(key); },
    async set(store, key, value) { mem.get(store).set(key, value); },
    async del(store, key) { mem.get(store).delete(key); },
    async clear(store) { mem.get(store).clear(); },
    async keys(store) { return Array.from(mem.get(store).keys()); },
    async all(store) { return Array.from(mem.get(store).values()); },
    async setMany(store, entries) { for (const [k, v] of entries) mem.get(store).set(k, v); },
  };
}

export const db = idb.available ? idb : memoryFallback();
