const DB_NAME = 'TailorAppDB';
const DB_VERSION = 1;

const STORES = {
  ORDERS: 'orders',
  KALIGADHS: 'kaligadhs',
  ASSIGNMENTS: 'assignments',
  DEALERS: 'dealers',
  ACTIVITY: 'activity',
  SETTINGS: 'settings',
};

let db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORES.ORDERS)) {
        const os = database.createObjectStore(STORES.ORDERS, { keyPath: 'id' });
        os.createIndex('status', 'status', { unique: false });
        os.createIndex('customerName', 'customerName', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.KALIGADHS)) {
        database.createObjectStore(STORES.KALIGADHS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.ASSIGNMENTS)) {
        const as = database.createObjectStore(STORES.ASSIGNMENTS, { keyPath: 'id' });
        as.createIndex('orderId', 'orderId', { unique: false });
        as.createIndex('kaligadhId', 'kaligadhId', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.DEALERS)) {
        database.createObjectStore(STORES.DEALERS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.ACTIVITY)) {
        const act = database.createObjectStore(STORES.ACTIVITY, { keyPath: 'id' });
        act.createIndex('date', 'date', { unique: false });
        act.createIndex('referenceId', 'referenceId', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getStore(storeName, mode = 'readonly') {
  const database = await openDB();
  return database.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(storeName) {
  const store = await getStore(storeName);
  return promisify(store.getAll());
}

async function getById(storeName, id) {
  const store = await getStore(storeName);
  return promisify(store.get(id));
}

async function put(storeName, item) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.put(item));
}

async function remove(storeName, id) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.delete(id));
}

async function getAllByIndex(storeName, indexName, value) {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return promisify(index.getAll(value));
}

// ─── ORDERS ───
export const ordersDB = {
  getAll: () => getAll(STORES.ORDERS),
  getById: (id) => getById(STORES.ORDERS, id),
  save: (order) => put(STORES.ORDERS, order),
  delete: (id) => remove(STORES.ORDERS, id),
  getByStatus: (status) => getAllByIndex(STORES.ORDERS, 'status', status),
};

// ─── KALIGADHS ───
export const kaligadhsDB = {
  getAll: () => getAll(STORES.KALIGADHS),
  getById: (id) => getById(STORES.KALIGADHS, id),
  save: (k) => put(STORES.KALIGADHS, k),
  delete: (id) => remove(STORES.KALIGADHS, id),
};

// ─── ASSIGNMENTS ───
export const assignmentsDB = {
  getAll: () => getAll(STORES.ASSIGNMENTS),
  getById: (id) => getById(STORES.ASSIGNMENTS, id),
  save: (a) => put(STORES.ASSIGNMENTS, a),
  getByOrder: (orderId) => getAllByIndex(STORES.ASSIGNMENTS, 'orderId', orderId),
  getByKaligadh: (kaligadhId) => getAllByIndex(STORES.ASSIGNMENTS, 'kaligadhId', kaligadhId),
};

// ─── DEALERS ───
export const dealersDB = {
  getAll: () => getAll(STORES.DEALERS),
  getById: (id) => getById(STORES.DEALERS, id),
  save: (d) => put(STORES.DEALERS, d),
  delete: (id) => remove(STORES.DEALERS, id),
};

// ─── ACTIVITY ───
export const activityDB = {
  getAll: () => getAll(STORES.ACTIVITY),
  save: (entry) => put(STORES.ACTIVITY, entry),
  getByReference: (refId) => getAllByIndex(STORES.ACTIVITY, 'referenceId', refId),
};

// ─── SETTINGS ───
export const settingsDB = {
  get: async (key) => {
    const row = await getById(STORES.SETTINGS, key);
    return row ? row.value : null;
  },
  set: (key, value) => put(STORES.SETTINGS, { key, value }),
};

export { STORES };
