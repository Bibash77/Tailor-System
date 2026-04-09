export function generateId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '#';
  for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
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

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ITEM_CATEGORIES = ['Shirt', 'Pant', 'Coat', 'Inner Coat'];

export const DEFAULT_MAKING_COSTS = {
  Shirt: 200,
  Pant: 250,
  Coat: 500,
  'Inner Coat': 150,
};

export const ITEM_COLORS = {
  Shirt: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Pant: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  Coat: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'Inner Coat': { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
};
