import { X, Search, CheckCircle } from 'lucide-react';
import { getItemColor, formatDate, FIELD_LABELS } from '../utils';

const AVATAR_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FFF7ED', text: '#C2410C' },
  { bg: '#FDF4FF', text: '#7E22CE' },
  { bg: '#FFF1F2', text: '#BE123C' },
  { bg: '#F0FDFA', text: '#0F766E' },
];

export function Avatar({ name, size = 40 }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const c = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: c.bg, color: c.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: Math.round(size * 0.36),
      fontFamily: 'DM Serif Display',
      border: `2px solid ${c.text}33`,
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size = '' }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function FormGroup({ label, required, hint, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}{required && <span>*</span>}</label>}
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="search-bar">
      <Search size={14} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function ItemTag({ item }) {
  const c = getItemColor(item);
  return (
    <span className="item-tag" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {item}
    </span>
  );
}

export function Badge({ type = 'gray', children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

export function EmptyState({ icon, title, message }) {
  return (
    <div className="empty-state">
      {icon}
      <h4>{title}</h4>
      <p>{message}</p>
    </div>
  );
}

export function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--paper-3)',
        borderTopColor: 'var(--ink)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</h4>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : {}}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ─── HISTORY MODAL ────────────────────────────────────────────────────────────
function formatHistoryValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'number') {
    const amtFields = new Set(['totalAmount','advanceAmount','discount','remainingAmount','amount','makingCost']);
    if (amtFields.has(key)) return `Rs. ${val.toLocaleString('en-NP')}`;
    return String(val);
  }
  if (typeof val === 'string') {
    // ISO date strings
    if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val)) return formatDate(val);
    return val;
  }
  return String(val);
}

export function HistoryModal({ title, history = [], onClose }) {
  const sorted = [...history].reverse(); // newest first
  return (
    <Modal title={`Edit History — ${title}`} onClose={onClose} size="modal-lg"
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>
      {sorted.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          No edits recorded yet.
        </div>
      ) : sorted.map((entry, idx) => (
        <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < sorted.length - 1 ? '1px solid var(--paper-2)' : 'none' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', flexShrink: 0 }} />
            {formatDate(entry.changedAt)}
            {entry.changedAt && (
              <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>
                · {new Date(entry.changedAt).toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(entry.changes || {}).map(([field, { from, to }]) => (
              <div key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, padding: '6px 10px', background: 'var(--paper-2)', borderRadius: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--ink-3)', minWidth: 110, flexShrink: 0 }}>
                  {FIELD_LABELS[field] || field}
                </span>
                <span style={{ color: 'var(--red)', textDecoration: 'line-through', flex: 1, wordBreak: 'break-all' }}>
                  {formatHistoryValue(field, from)}
                </span>
                <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>→</span>
                <span style={{ color: 'var(--green)', fontWeight: 600, flex: 1, wordBreak: 'break-all' }}>
                  {formatHistoryValue(field, to)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

export function CheckboxGroup({ options, selected, onChange }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(o => o !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div className="checkbox-group">
      {options.map(opt => (
        <div key={opt} className={`checkbox-item ${selected.includes(opt) ? 'checked' : ''}`} onClick={() => toggle(opt)}>
          {selected.includes(opt) && <CheckCircle size={14} />}
          {opt}
        </div>
      ))}
    </div>
  );
}
