export function generateId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '#';
  for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
}

export function generateBillNo() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `BL-${year}-${suffix}`;
}

export const DEALER_CATEGORIES = ['Premium', 'Regular'];

export function computeDealerStatus(dealer) {
  if ((dealer.remainingAmount || 0) <= 0) return 'paid';
  if (dealer.dueDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dealer.dueDate); due.setHours(0, 0, 0, 0);
    if (due < today) return 'overdue';
  }
  if ((dealer.paidAmount || 0) > 0) return 'partialPending';
  return 'allPending';
}

export function getDaysUntilDue(dueDate) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rs. 0';
  return `Rs. ${Number(amount).toLocaleString('en-NP')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-NP', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-NP', { day: '2-digit', month: 'short' });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── EDIT HISTORY ─────────────────────────────────────────────────────────────
// Fields to skip when comparing for changes
const EDIT_SKIP = new Set(['history', 'updatedAt', 'createdAt', 'id', '_status']);

/**
 * Merges `updates` into `oldRecord`, recording a diff entry in `record.history`.
 * Returns the updated record ready to be saved to DB.
 */
export function applyEdit(oldRecord, updates) {
  const changes = {};
  for (const key of Object.keys(updates)) {
    if (EDIT_SKIP.has(key)) continue;
    if (JSON.stringify(updates[key]) !== JSON.stringify(oldRecord[key])) {
      changes[key] = { from: oldRecord[key], to: updates[key] };
    }
  }
  const history = [...(oldRecord.history || [])];
  if (Object.keys(changes).length > 0) {
    history.push({ changedAt: new Date().toISOString(), changes });
  }
  return { ...oldRecord, ...updates, history, updatedAt: new Date().toISOString() };
}

// Human-readable field labels for the history viewer
export const FIELD_LABELS = {
  customerName:  'Customer Name',
  customerPhone: 'Phone',
  totalAmount:   'Total Amount',
  advanceAmount: 'Advance',
  discount:      'Discount',
  remainingAmount: 'Remaining',
  deliveryDate:  'Delivery Date',
  billNo:        'Bill No',
  note:          'Note',
  status:        'Status',
  dealerName:    'Dealer Name',
  category:      'Category',
  dueDate:       'Due Date',
  amount:        'Amount',
  paymentStatus: 'Payment Status',
  name:          'Name',
  specialties:   'Specialties',
  makingCost:    'Making Cost',
  items:         'Items',
};

// ─── MONTH HELPERS ────────────────────────────────────────────────────────────
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('en-NP', { month: 'long', year: 'numeric' });
}

export function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 2, 1));
}

export function nextMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m, 1));
}

export function entryMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return monthKey(d);
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ITEM_CATEGORIES = ['Shirt', 'Pant', 'Coat', 'Inner Coat', 'Daura Suruwal'];

export const DEFAULT_MAKING_COSTS = {
  Shirt: 200,
  Pant: 250,
  Coat: 500,
  'Inner Coat': 150,
  'Daura Suruwal': 400,
};

export const ITEM_COLORS = {
  Shirt: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Pant: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  Coat: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'Inner Coat': { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  'Daura Suruwal': { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
};

// Palette for dynamically added items not in ITEM_COLORS
const COLOR_PALETTE = [
  { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { bg: '#F7FEE7', text: '#3F6212', border: '#D9F99D' },
  { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  { bg: '#F0FDFB', text: '#134E4A', border: '#99F6E4' },
];

export function getItemColor(name) {
  if (ITEM_COLORS[name]) return ITEM_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}
