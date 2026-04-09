import { X, Search, CheckCircle } from 'lucide-react';
import { ITEM_COLORS } from '../utils';

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
  const c = ITEM_COLORS[item] || { bg: '#F5F5F4', text: '#44403C', border: '#E7E5E4' };
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
