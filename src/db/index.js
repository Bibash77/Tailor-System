const DB_NAME = 'TailorAppDB';
const DB_VERSION = 5;

const STORES = {
  ORDERS: 'orders',
  KALIGADHS: 'kaligadhs',
  ASSIGNMENTS: 'assignments',
  DEALERS: 'dealers',
  DEALER_PAYMENTS: 'dealerPayments',
  KALIGADH_PAYMENTS: 'kaligadhPayments',
  SALARY_RECORDS: 'salaryRecords',
  SALARY_PAYMENTS: 'salaryPayments',
  ACTIVITY: 'activity',
  SETTINGS: 'settings',
  EXPENSES: 'expenses',
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
        const ds = database.createObjectStore(STORES.DEALERS, { keyPath: 'id' });
        ds.createIndex('category', 'category', { unique: false });
        ds.createIndex('paymentStatus', 'paymentStatus', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.DEALER_PAYMENTS)) {
        const dp = database.createObjectStore(STORES.DEALER_PAYMENTS, { keyPath: 'id' });
        dp.createIndex('dealerId', 'dealerId', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.KALIGADH_PAYMENTS)) {
        const kp = database.createObjectStore(STORES.KALIGADH_PAYMENTS, { keyPath: 'id' });
        kp.createIndex('kaligadhId', 'kaligadhId', { unique: false });
        kp.createIndex('type', 'type', { unique: false });
        kp.createIndex('date', 'date', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.SALARY_RECORDS)) {
        const sr = database.createObjectStore(STORES.SALARY_RECORDS, { keyPath: 'id' });
        sr.createIndex('kaligadhId', 'kaligadhId', { unique: false });
        sr.createIndex('month', 'month', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.SALARY_PAYMENTS)) {
        const sp = database.createObjectStore(STORES.SALARY_PAYMENTS, { keyPath: 'id' });
        sp.createIndex('kaligadhId', 'kaligadhId', { unique: false });
        sp.createIndex('month', 'month', { unique: false });
        sp.createIndex('type', 'type', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.ACTIVITY)) {
        const act = database.createObjectStore(STORES.ACTIVITY, { keyPath: 'id' });
        act.createIndex('date', 'date', { unique: false });
        act.createIndex('referenceId', 'referenceId', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(STORES.EXPENSES)) {
        const exp = database.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        exp.createIndex('date', 'date', { unique: false });
        exp.createIndex('paymentStatus', 'paymentStatus', { unique: false });
        exp.createIndex('category', 'category', { unique: false });
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
  getByCategory: (category) => getAllByIndex(STORES.DEALERS, 'category', category),
};

// ─── DEALER PAYMENTS ───
export const dealerPaymentsDB = {
  getAll: () => getAll(STORES.DEALER_PAYMENTS),
  getById: (id) => getById(STORES.DEALER_PAYMENTS, id),
  save: (p) => put(STORES.DEALER_PAYMENTS, p),
  delete: (id) => remove(STORES.DEALER_PAYMENTS, id),
  getByDealer: (dealerId) => getAllByIndex(STORES.DEALER_PAYMENTS, 'dealerId', dealerId),
};

// ─── KALIGADH PAYMENTS ───
export const kaligadhPaymentsDB = {
  getAll: () => getAll(STORES.KALIGADH_PAYMENTS),
  getById: (id) => getById(STORES.KALIGADH_PAYMENTS, id),
  save: (p) => put(STORES.KALIGADH_PAYMENTS, p),
  delete: (id) => remove(STORES.KALIGADH_PAYMENTS, id),
  getByKaligadh: (kaligadhId) => getAllByIndex(STORES.KALIGADH_PAYMENTS, 'kaligadhId', kaligadhId),
};

// ─── SALARY RECORDS (one per employee per month) ───
export const salaryRecordsDB = {
  getAll: () => getAll(STORES.SALARY_RECORDS),
  getById: (id) => getById(STORES.SALARY_RECORDS, id),
  save: (r) => put(STORES.SALARY_RECORDS, r),
  delete: (id) => remove(STORES.SALARY_RECORDS, id),
  getByKaligadh: (kaligadhId) => getAllByIndex(STORES.SALARY_RECORDS, 'kaligadhId', kaligadhId),
};

// ─── SALARY PAYMENTS (individual cash payments, advances, recoveries) ───
export const salaryPaymentsDB = {
  getAll: () => getAll(STORES.SALARY_PAYMENTS),
  getById: (id) => getById(STORES.SALARY_PAYMENTS, id),
  save: (p) => put(STORES.SALARY_PAYMENTS, p),
  delete: (id) => remove(STORES.SALARY_PAYMENTS, id),
  getByKaligadh: (kaligadhId) => getAllByIndex(STORES.SALARY_PAYMENTS, 'kaligadhId', kaligadhId),
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

// ─── EXPENSES ───
export const expensesDB = {
  getAll: () => getAll(STORES.EXPENSES),
  getById: (id) => getById(STORES.EXPENSES, id),
  save: (e) => put(STORES.EXPENSES, e),
  delete: (id) => remove(STORES.EXPENSES, id),
};

export { STORES };