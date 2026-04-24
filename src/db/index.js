import { authFetch } from '../context/AuthContext';

async function api(url, options = {}) {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

const q = (params) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  ).toString();
  return s ? `?${s}` : '';
};

export const ordersDB = {
  getAll:      ()       => api('/api/orders'),
  getById:     (id)     => api(`/api/orders/${id}`),
  save:        (order)  => api('/api/orders', { method: 'POST', body: order }),
  delete:      (id)     => api(`/api/orders/${id}`, { method: 'DELETE' }),
  getByStatus: (status) => api(`/api/orders${q({ status })}`),
};

export const kaligadhsDB = {
  getAll:  ()   => api('/api/kaligadhs'),
  getById: (id) => api(`/api/kaligadhs/${id}`),
  save:    (k)  => api('/api/kaligadhs', { method: 'POST', body: k }),
  delete:  (id) => api(`/api/kaligadhs/${id}`, { method: 'DELETE' }),
};

export const assignmentsDB = {
  getAll:        ()           => api('/api/assignments'),
  getById:       (id)         => api(`/api/assignments/${id}`),
  save:          (a)          => api('/api/assignments', { method: 'POST', body: a }),
  delete:        (id)         => api(`/api/assignments/${id}`, { method: 'DELETE' }),
  getByOrder:    (orderId)    => api(`/api/assignments${q({ orderId })}`),
  getByKaligadh: (kaligadhId) => api(`/api/assignments${q({ kaligadhId })}`),
};

export const dealersDB = {
  getAll:        ()         => api('/api/dealers'),
  getById:       (id)       => api(`/api/dealers/${id}`),
  save:          (d)        => api('/api/dealers', { method: 'POST', body: d }),
  delete:        (id)       => api(`/api/dealers/${id}`, { method: 'DELETE' }),
  getByCategory: (category) => api(`/api/dealers${q({ category })}`),
};

export const dealerPaymentsDB = {
  getAll:      ()         => api('/api/dealer-payments'),
  getById:     (id)       => api(`/api/dealer-payments/${id}`),
  save:        (p)        => api('/api/dealer-payments', { method: 'POST', body: p }),
  delete:      (id)       => api(`/api/dealer-payments/${id}`, { method: 'DELETE' }),
  getByDealer: (dealerId) => api(`/api/dealer-payments${q({ dealerId })}`),
};

export const kaligadhPaymentsDB = {
  getAll:        ()           => api('/api/kaligadh-payments'),
  getById:       (id)         => api(`/api/kaligadh-payments/${id}`),
  save:          (p)          => api('/api/kaligadh-payments', { method: 'POST', body: p }),
  delete:        (id)         => api(`/api/kaligadh-payments/${id}`, { method: 'DELETE' }),
  getByKaligadh: (kaligadhId) => api(`/api/kaligadh-payments${q({ kaligadhId })}`),
};

export const salaryRecordsDB = {
  getAll:        ()           => api('/api/salary-records'),
  getById:       (id)         => api(`/api/salary-records/${id}`),
  save:          (r)          => api('/api/salary-records', { method: 'POST', body: r }),
  delete:        (id)         => api(`/api/salary-records/${id}`, { method: 'DELETE' }),
  getByKaligadh: (kaligadhId) => api(`/api/salary-records${q({ kaligadhId })}`),
};

export const salaryPaymentsDB = {
  getAll:        ()           => api('/api/salary-payments'),
  getById:       (id)         => api(`/api/salary-payments/${id}`),
  save:          (p)          => api('/api/salary-payments', { method: 'POST', body: p }),
  delete:        (id)         => api(`/api/salary-payments/${id}`, { method: 'DELETE' }),
  getByKaligadh: (kaligadhId) => api(`/api/salary-payments${q({ kaligadhId })}`),
};

export const activityDB = {
  getAll:         ()            => api('/api/activity'),
  save:           (entry)       => api('/api/activity', { method: 'POST', body: entry }),
  getByReference: (referenceId) => api(`/api/activity${q({ referenceId })}`),
};

export const settingsDB = {
  get: async (key) => {
    const data = await api(`/api/settings/${key}`);
    return data.value;
  },
  set: (key, value) => api('/api/settings', { method: 'POST', body: { key, value } }),
};

export const expensesDB = {
  getAll:  ()    => api('/api/expenses'),
  getById: (id)  => api(`/api/expenses/${id}`),
  save:    (e)   => api('/api/expenses', { method: 'POST', body: e }),
  delete:  (id)  => api(`/api/expenses/${id}`, { method: 'DELETE' }),
};
