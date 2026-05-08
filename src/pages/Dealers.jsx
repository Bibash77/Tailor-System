import { useState, useEffect, useMemo } from 'react';
import {
  Plus, CheckCircle, X, Star, AlertTriangle, Clock,
  History, CreditCard, ArrowUpDown, ChevronDown, Bell,
  TrendingDown, Trash2, RefreshCw, Edit2
} from 'lucide-react';
import { dealersDB, dealerPaymentsDB, activityDB } from '../db';
import {
  generateUUID, generateBillNo, formatCurrency, formatDate, todayISO,
  computeDealerStatus, getDaysUntilDue, DEALER_CATEGORIES, applyEdit
} from '../utils';
import { Modal, SearchBar, Badge, EmptyState, FormGroup, HistoryModal, PageHelp, TableSkeleton, LoadingSpinner } from '../components/UI';

// ─── STATUS CONFIG ────────────────────────────────────────────────
const STATUS_CONFIG = {
  paid:           { label: 'Paid',            badgeType: 'green',  chipClass: 'active-green' },
  partialPending: { label: 'Partial Pending', badgeType: 'amber',  chipClass: 'active-amber' },
  allPending:     { label: 'All Pending',     badgeType: 'gray',   chipClass: 'active' },
  overdue:        { label: 'Overdue',         badgeType: 'red',    chipClass: 'active-red' },
};

// ─── PRIORITY SCORE (lower = higher priority) ─────────────────────
function priorityScore(dealer) {
  const s = computeDealerStatus(dealer);
  const isPremium = dealer.category === 'Premium';
  if (s === 'overdue')        return isPremium ? 1 : 3;
  if (s === 'allPending')     return isPremium ? 2 : 5;
  if (s === 'partialPending') return isPremium ? 2 : 5;
  return 10; // paid
}

// ─── DUE DATE CELL ───────────────────────────────────────────────
function DueDateCell({ dueDate, status }) {
  if (!dueDate) return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>;
  const days = getDaysUntilDue(dueDate);
  const isOverdue = status === 'overdue';
  const isUrgent = !isOverdue && days !== null && days <= 3 && status !== 'paid';
  let cls = 'due-date-normal';
  if (isOverdue) cls = 'due-date-overdue';
  else if (isUrgent) cls = 'due-date-urgent';

  return (
    <div className="due-date-cell">
      <div className={cls}>{formatDate(dueDate)}</div>
      {days !== null && status !== 'paid' && (
        <div className={`due-date-sub ${cls}`}>
          {isOverdue
            ? `${Math.abs(days)}d overdue`
            : days === 0
            ? 'Due today!'
            : `${days}d left`}
        </div>
      )}
    </div>
  );
}

// ─── PAYMENT PROGRESS BAR ────────────────────────────────────────
function PaymentProgress({ paidAmount, totalAmount }) {
  const pct = totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;
  const color = pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--amber)' : 'var(--paper-3)';
  return (
    <div style={{ minWidth: 80 }}>
      <div className="payment-progress-bar">
        <div className="payment-progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2, textAlign: 'center' }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

// ─── ADD DEALER MODAL ────────────────────────────────────────────
function AddDealerModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    dealerName: '',
    category: 'Regular',
    billNo: generateBillNo(),
    totalAmount: '',
    paidAmount: '',
    dueDate: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, (Number(form.totalAmount) || 0) - (Number(form.paidAmount) || 0));
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.dealerName.trim()) return alert('Dealer name is required.');
    if (!form.billNo.trim()) return alert('Bill number is required.');
    if (!form.totalAmount || isNaN(Number(form.totalAmount))) return alert('Total amount is required.');
    setSaving(true);

    const paid = Number(form.paidAmount) || 0;
    const dealer = {
      id: generateUUID(),
      dealerName: form.dealerName.trim(),
      category: form.category,
      billNo: form.billNo.trim(),
      totalAmount: Number(form.totalAmount),
      paidAmount: paid,
      remainingAmount: remaining,
      dueDate: form.dueDate || null,
      clearanceDate: remaining === 0 ? new Date().toISOString() : null,
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
      paidAt: remaining === 0 ? new Date().toISOString() : null,
      // legacy status field kept for backward compatibility
      status: remaining > 0 ? 'remaining' : 'paid',
    };

    await dealersDB.save(dealer);

    // Log initial paid amount as expense
    if (paid > 0) {
      await activityDB.save({
        id: generateUUID(),
        type: 'expense',
        subType: 'dealerPaid',
        amount: paid,
        description: `Purchase paid — ${dealer.dealerName} (${dealer.billNo})`,
        referenceId: dealer.id,
        referenceType: 'dealer',
        date: new Date().toISOString(),
      });
      // Also record as a dealer payment entry
      await dealerPaymentsDB.save({
        id: generateUUID(),
        dealerId: dealer.id,
        amount: paid,
        note: 'Initial payment',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Add Dealer Purchase" onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Purchase'}
        </button>
      </>}>

      <div className="grid-2">
        <FormGroup label="Dealer Name" required>
          <input className="form-input" placeholder="e.g. Shyam Textiles" value={form.dealerName}
            onChange={e => f('dealerName', e.target.value)} />
        </FormGroup>
        <FormGroup label="Dealer Category" required>
          <select className="form-select" value={form.category} onChange={e => f('category', e.target.value)}>
            {DEALER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormGroup>
      </div>

      <div className="grid-2">
        <FormGroup label="Bill Number" required hint="Auto-generated; you may edit it">
          <input className="form-input" placeholder="BL-2026-XXXX" value={form.billNo}
            onChange={e => f('billNo', e.target.value)} />
        </FormGroup>
        <FormGroup label="Due Date" hint="When the full payment is expected">
          <input className="form-input" type="date" value={form.dueDate}
            onChange={e => f('dueDate', e.target.value)} />
        </FormGroup>
      </div>

      <div className="grid-2">
        <FormGroup label="Total Amount (Rs.)" required>
          <input className="form-input" type="number" placeholder="0" value={form.totalAmount}
            onChange={e => f('totalAmount', e.target.value)} />
        </FormGroup>
        <FormGroup label="Initial Paid Amount (Rs.)" hint="Leave 0 if unpaid">
          <input className="form-input" type="number" placeholder="0" value={form.paidAmount}
            onChange={e => f('paidAmount', e.target.value)} />
        </FormGroup>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--paper-2)', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>REMAINING</span>
        <span style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: remaining > 0 ? 'var(--accent)' : 'var(--green)' }}>
          {formatCurrency(remaining)}
        </span>
      </div>

      <FormGroup label="Note (optional)">
        <textarea className="form-textarea" placeholder="Fabric type, purchase details..." value={form.note}
          onChange={e => f('note', e.target.value)} style={{ minHeight: 56 }} />
      </FormGroup>
    </Modal>
  );
}

// ─── PARTIAL PAYMENT MODAL ───────────────────────────────────────
function PaymentModal({ dealer, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const maxPay = dealer.remainingAmount;

  async function handlePay() {
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) return alert('Enter a valid payment amount.');
    if (amt > maxPay) return alert(`Amount exceeds remaining balance of ${formatCurrency(maxPay)}.`);

    setSaving(true);
    const newPaid = dealer.paidAmount + amt;
    const newRemaining = dealer.remainingAmount - amt;
    const fullyPaid = newRemaining <= 0;

    // Save payment record
    await dealerPaymentsDB.save({
      id: generateUUID(),
      dealerId: dealer.id,
      amount: amt,
      note: note.trim(),
      date: new Date(date).toISOString(),
      createdAt: new Date().toISOString(),
    });

    // Update dealer record
    await dealersDB.save({
      ...dealer,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: fullyPaid ? 'paid' : 'remaining',
      clearanceDate: fullyPaid ? new Date().toISOString() : dealer.clearanceDate,
      paidAt: fullyPaid ? new Date().toISOString() : dealer.paidAt,
    });

    // Log to activity
    await activityDB.save({
      id: generateUUID(),
      type: 'expense',
      subType: fullyPaid ? 'dealerBalance' : 'dealerPaid',
      amount: amt,
      description: `${fullyPaid ? 'Final payment' : 'Partial payment'} — ${dealer.dealerName} (${dealer.billNo || 'N/A'})`,
      referenceId: dealer.id,
      referenceType: 'dealer',
      date: new Date(date).toISOString(),
    });

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={`Record Payment — ${dealer.dealerName}`} onClose={onClose} size="modal-sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-green" disabled={saving} onClick={handlePay}>
          <CreditCard size={14} /> {saving ? 'Saving...' : 'Record Payment'}
        </button>
      </>}>

      {/* Dealer summary */}
      <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
        <div className="flex justify-between mb-2">
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>BILL NO</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{dealer.billNo || '—'}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>TOTAL AMOUNT</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(dealer.totalAmount)}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>ALREADY PAID</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(dealer.paidAmount)}</span>
        </div>
        <div className="flex justify-between" style={{ paddingTop: 10, borderTop: '1px solid var(--paper-3)' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>REMAINING</span>
          <span style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: 'var(--accent)' }}>{formatCurrency(maxPay)}</span>
        </div>
      </div>

      <FormGroup label="Payment Amount (Rs.)" required>
        <input className="form-input" type="number" placeholder={`Max: ${maxPay}`}
          value={amount} onChange={e => setAmount(e.target.value)} />
      </FormGroup>

      <div className="flex gap-3 mb-2">
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(String(maxPay))}>
          Full amount
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(String(Math.round(maxPay / 2)))}>
          Half
        </button>
      </div>

      <FormGroup label="Payment Date">
        <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </FormGroup>

      <FormGroup label="Note (optional)">
        <input className="form-input" placeholder="e.g. Cash payment, Bank transfer..." value={note}
          onChange={e => setNote(e.target.value)} />
      </FormGroup>
    </Modal>
  );
}

// ─── EDIT DEALER MODAL ───────────────────────────────────────────
function EditDealerModal({ dealer, onClose, onSaved }) {
  const [form, setForm] = useState({
    dealerName: dealer.dealerName || '',
    category: dealer.category || 'Regular',
    billNo: dealer.billNo || '',
    totalAmount: String(dealer.totalAmount || ''),
    dueDate: dealer.dueDate?.slice(0, 10) || '',
    note: dealer.note || '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.dealerName.trim()) return alert('Dealer name is required.');
    if (!form.billNo.trim()) return alert('Bill number is required.');
    if (!form.totalAmount || isNaN(Number(form.totalAmount))) return alert('Total amount is required.');
    setSaving(true);
    const newTotal = Number(form.totalAmount);
    const updates = {
      dealerName: form.dealerName.trim(),
      category: form.category,
      billNo: form.billNo.trim(),
      totalAmount: newTotal,
      remainingAmount: Math.max(0, newTotal - (dealer.paidAmount || 0)),
      dueDate: form.dueDate || null,
      note: form.note.trim(),
    };
    const updated = applyEdit(dealer, updates);
    await dealersDB.save(updated);
    setSaving(false);
    onSaved(updated);
  }

  return (
    <Modal title={`Edit — ${dealer.dealerName}`} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </>}>
      <div className="grid-2">
        <FormGroup label="Dealer Name" required>
          <input className="form-input" value={form.dealerName}
            onChange={e => f('dealerName', e.target.value)} />
        </FormGroup>
        <FormGroup label="Category" required>
          <select className="form-select" value={form.category} onChange={e => f('category', e.target.value)}>
            {DEALER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormGroup>
      </div>
      <div className="grid-2">
        <FormGroup label="Bill Number" required>
          <input className="form-input" value={form.billNo}
            onChange={e => f('billNo', e.target.value)} />
        </FormGroup>
        <FormGroup label="Due Date">
          <input className="form-input" type="date" value={form.dueDate}
            onChange={e => f('dueDate', e.target.value)} />
        </FormGroup>
      </div>
      <FormGroup label="Total Amount (Rs.)" required hint="Changing this recalculates the remaining balance">
        <input className="form-input" type="number" value={form.totalAmount}
          onChange={e => f('totalAmount', e.target.value)} />
      </FormGroup>
      <FormGroup label="Note (optional)">
        <textarea className="form-textarea" value={form.note}
          onChange={e => f('note', e.target.value)} style={{ minHeight: 56 }} />
      </FormGroup>
    </Modal>
  );
}

// ─── DETAIL / HISTORY MODAL ──────────────────────────────────────
function DetailModal({ dealer, onClose, onPayment, onEdit, onHistory, onDelete }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const status = computeDealerStatus(dealer);

  useEffect(() => {
    dealerPaymentsDB.getByDealer(dealer.id).then(ps => {
      ps.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(ps);
      setLoading(false);
    });
  }, [dealer.id]);

  async function handleDeletePayment(payment) {
    if (!window.confirm('Delete this payment record? This will reverse the paid amount.')) return;
    // Reverse the dealer amounts
    const newPaid = Math.max(0, dealer.paidAmount - payment.amount);
    const newRemaining = dealer.totalAmount - newPaid;
    await dealerPaymentsDB.delete(payment.id);
    await dealersDB.save({
      ...dealer,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: newRemaining > 0 ? 'remaining' : 'paid',
      clearanceDate: newRemaining > 0 ? null : dealer.clearanceDate,
    });
    onDelete();
  }

  const daysUntilDue = getDaysUntilDue(dealer.dueDate);

  return (
    <Modal title={`${dealer.dealerName} — Details`} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={onHistory}>
          <History size={14} /> History{dealer.history?.length > 0 ? ` (${dealer.history.length})` : ''}
        </button>
        <button className="btn btn-ghost" onClick={onEdit}>
          <Edit2 size={14} /> Edit
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        {status !== 'paid' && (
          <button className="btn btn-green" onClick={onPayment}>
            <CreditCard size={14} /> Record Payment
          </button>
        )}
      </>}>

      {/* Header info */}
      <div className="grid-2 mb-4">
        <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: '14px 16px' }}>
          <div className="flex justify-between mb-2">
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Bill No</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{dealer.billNo || '—'}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Category</span>
            <span className={`priority-badge ${dealer.category === 'Premium' ? 'priority-premium' : 'priority-regular'}`}>
              {dealer.category === 'Premium' && <Star size={9} />} {dealer.category}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Added</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(dealer.createdAt)}</span>
          </div>
        </div>

        <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: '14px 16px' }}>
          <div className="flex justify-between mb-2">
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(dealer.totalAmount)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Paid</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(dealer.paidAmount)}</span>
          </div>
          <div className="flex justify-between" style={{ paddingTop: 8, borderTop: '1px solid var(--paper-3)' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Remaining</span>
            <span style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: status === 'paid' ? 'var(--green)' : 'var(--accent)' }}>
              {formatCurrency(dealer.remainingAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Due date / Status */}
      <div className="flex items-center gap-3 mb-4">
        <Badge type={STATUS_CONFIG[status].badgeType}>{STATUS_CONFIG[status].label}</Badge>
        {dealer.dueDate && (
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Due: <strong style={{ color: status === 'overdue' ? 'var(--red)' : 'var(--ink-2)' }}>
              {formatDate(dealer.dueDate)}
              {status !== 'paid' && daysUntilDue !== null && (
                <span style={{ marginLeft: 6, fontWeight: 400, color: status === 'overdue' ? 'var(--red)' : 'var(--ink-4)' }}>
                  ({status === 'overdue' ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'today' : `${daysUntilDue}d left`})
                </span>
              )}
            </strong>
          </span>
        )}
        {dealer.clearanceDate && (
          <span style={{ fontSize: 12, color: 'var(--green)' }}>
            Cleared: {formatDate(dealer.clearanceDate)}
          </span>
        )}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Payment Progress</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {dealer.totalAmount > 0 ? Math.round((dealer.paidAmount / dealer.totalAmount) * 100) : 0}%
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--paper-2)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${dealer.totalAmount > 0 ? Math.min(100, (dealer.paidAmount / dealer.totalAmount) * 100) : 0}%`,
            background: status === 'paid' ? 'var(--green)' : status === 'overdue' ? 'var(--red)' : 'var(--amber)',
            borderRadius: 8,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Note */}
      {dealer.note && (
        <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--ink-3)' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Note: </span>{dealer.note}
        </div>
      )}

      {/* Payment history */}
      <div style={{ borderTop: '1px solid var(--paper-3)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Payment History
        </div>
        {loading ? (
          <LoadingSpinner size={24} padding={20} />
        ) : payments.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No payments recorded yet.</div>
        ) : (
          payments.map((p, i) => (
            <div key={p.id} className="payment-history-item">
              <div className="flex items-center gap-3">
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={14} color="var(--green)" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>+ {formatCurrency(p.amount)}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDate(p.date)}{p.note ? ` · ${p.note}` : ''}</div>
                </div>
              </div>
              <button className="btn btn-sm" style={{ background: 'none', border: 'none', color: 'var(--ink-4)', padding: '4px', cursor: 'pointer' }}
                onClick={() => handleDeletePayment(p)} title="Delete this payment">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────
export default function Dealers() {
  const [dealers, setDealers] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('priority');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [payingDealer, setPayingDealer] = useState(null);
  const [detailDealer, setDetailDealer] = useState(null);
  const [editDealer, setEditDealer] = useState(null);
  const [histDealer, setHistDealer] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const ds = await dealersDB.getAll();
    ds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setDealers(ds);
    setLoading(false);
  }

  async function markFullyPaid(dealer) {
    if (!window.confirm(`Mark ${dealer.dealerName} as fully paid? Remaining ${formatCurrency(dealer.remainingAmount)} will be recorded.`)) return;
    const now = new Date().toISOString();
    await dealersDB.save({
      ...dealer,
      paidAmount: dealer.totalAmount,
      remainingAmount: 0,
      status: 'paid',
      clearanceDate: now,
      paidAt: now,
    });
    if (dealer.remainingAmount > 0) {
      await dealerPaymentsDB.save({
        id: generateUUID(),
        dealerId: dealer.id,
        amount: dealer.remainingAmount,
        note: 'Final payment (marked fully paid)',
        date: now,
        createdAt: now,
      });
      await activityDB.save({
        id: generateUUID(),
        type: 'expense',
        subType: 'dealerBalance',
        amount: dealer.remainingAmount,
        description: `Final balance paid — ${dealer.dealerName} (${dealer.billNo || 'N/A'})`,
        referenceId: dealer.id,
        referenceType: 'dealer',
        date: now,
      });
    }
    load();
  }

  // Enrich dealers with computed status
  const enriched = useMemo(() =>
    dealers.map(d => ({ ...d, _status: computeDealerStatus(d) })),
  [dealers]);

  // Stats
  const stats = useMemo(() => {
    const unpaid = enriched.filter(d => d._status !== 'paid');
    return {
      totalOutstanding: unpaid.reduce((s, d) => s + (d.remainingAmount || 0), 0),
      overdueCount:     enriched.filter(d => d._status === 'overdue').length,
      overdueAmount:    enriched.filter(d => d._status === 'overdue').reduce((s, d) => s + (d.remainingAmount || 0), 0),
      premiumPending:   enriched.filter(d => d.category === 'Premium' && d._status !== 'paid').reduce((s, d) => s + (d.remainingAmount || 0), 0),
      premiumOverdue:   enriched.filter(d => d.category === 'Premium' && d._status === 'overdue').length,
      totalPaid:        enriched.filter(d => d._status === 'paid').reduce((s, d) => s + (d.totalAmount || 0), 0),
      upcomingIn7:      enriched.filter(d => {
        if (d._status === 'paid') return false;
        const days = getDaysUntilDue(d.dueDate);
        return days !== null && days >= 0 && days <= 7;
      }).length,
    };
  }, [enriched]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = enriched.filter(d => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && d._status !== statusFilter) return false;
      if (search && !d.dealerName.toLowerCase().includes(search.toLowerCase()) &&
          !(d.billNo || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === 'priority') {
        const pa = priorityScore(a), pb = priorityScore(b);
        if (pa !== pb) return pa - pb;
        return (a.remainingAmount || 0) > (b.remainingAmount || 0) ? -1 : 1;
      }
      if (sort === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (sort === 'remaining') {
        return (b.remainingAmount || 0) - (a.remainingAmount || 0);
      }
      if (sort === 'recent') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return 0;
    });

    return list;
  }, [enriched, categoryFilter, statusFilter, search, sort]);

  const statusCounts = useMemo(() => {
    const counts = { all: enriched.length, paid: 0, partialPending: 0, allPending: 0, overdue: 0 };
    enriched.forEach(d => { counts[d._status] = (counts[d._status] || 0) + 1; });
    return counts;
  }, [enriched]);

  function openDetail(dealer) {
    setDetailDealer(dealer);
  }

  return (
    <div>
      {/* ─── PAGE HEADER ─── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Dealers &amp; Payments</h2>
          <p>Manage supplier purchases, track payment schedules and dues</p>
        </div>
        <button className="btn btn-accent btn-lg" style={{ marginTop: 4 }} onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Purchase
        </button>
      </div>

      <div className="page-body">
        <PageHelp id="dealers" title="How Dealers Work" items={[
          'Add material suppliers (dealers) here. Each dealer has a category, credit limit, and due date.',
          'Record each purchase from a dealer — set the amount and whether it\'s paid or pending.',
          'Outstanding Balance = Total Purchases − Total Paid. Overdue = past the due date and still unpaid.',
          'Paying a dealer records the payment in the Activity ledger as an expense automatically.',
          'Premium dealers get priority in alert banners — configure the category when adding a dealer.',
          'Use the alert banners at the top to quickly see overdue and due-soon payments.',
        ]} />

        {/* ─── ALERT BANNERS ─── */}
        {stats.premiumOverdue > 0 && (
          <div className="alert-banner alert-banner-overdue">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>{stats.premiumOverdue} Premium dealer{stats.premiumOverdue > 1 ? 's' : ''}</strong> with overdue payments totalling{' '}
              <strong>{formatCurrency(stats.overdueAmount)}</strong>. Immediate attention required.
            </span>
          </div>
        )}
        {stats.overdueCount > stats.premiumOverdue && (
          <div className="alert-banner alert-banner-overdue">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>{stats.overdueCount} dealer{stats.overdueCount > 1 ? 's' : ''}</strong> with overdue payments.{' '}
              Total outstanding overdue: <strong>{formatCurrency(stats.overdueAmount)}</strong>.
            </span>
          </div>
        )}
        {stats.upcomingIn7 > 0 && stats.overdueCount === 0 && (
          <div className="alert-banner alert-banner-premium">
            <Bell size={15} style={{ flexShrink: 0 }} />
            <span>
              <strong>{stats.upcomingIn7} payment{stats.upcomingIn7 > 1 ? 's' : ''}</strong> due within the next 7 days. Plan accordingly.
            </span>
          </div>
        )}
        {stats.premiumPending > 0 && stats.premiumOverdue === 0 && (
          <div className="alert-banner alert-banner-premium">
            <Star size={14} style={{ flexShrink: 0 }} />
            <span>
              Premium dealers have <strong>{formatCurrency(stats.premiumPending)}</strong> in pending payments.
            </span>
          </div>
        )}

        {/* ─── STATS DASHBOARD ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Outstanding</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{formatCurrency(stats.totalOutstanding)}</div>
            <div className="stat-sub">{enriched.filter(d => d._status !== 'paid').length} unpaid bills</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--red)', borderLeftWidth: 3 }}>
            <div className="stat-label">Overdue</div>
            <div className="stat-value" style={{ color: stats.overdueCount > 0 ? 'var(--red)' : 'var(--ink-4)' }}>
              {formatCurrency(stats.overdueAmount)}
            </div>
            <div className="stat-sub">{stats.overdueCount} dealer{stats.overdueCount !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#D97706', borderLeftWidth: 3 }}>
            <div className="stat-label">Premium Pending</div>
            <div className="stat-value" style={{ color: stats.premiumPending > 0 ? '#92400E' : 'var(--ink-4)' }}>
              {formatCurrency(stats.premiumPending)}
            </div>
            <div className="stat-sub">{enriched.filter(d => d.category === 'Premium' && d._status !== 'paid').length} premium bills</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--green)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Paid</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCurrency(stats.totalPaid)}</div>
            <div className="stat-sub">{enriched.filter(d => d._status === 'paid').length} cleared bills</div>
          </div>
        </div>

        {/* ─── FILTER TOOLBAR ─── */}
        <div className="flex gap-3 mb-4 items-center" style={{ flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search dealer or bill no..." />

          {/* Category filter */}
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            {['all', 'Premium', 'Regular'].map(cat => (
              <button key={cat}
                className={`filter-chip ${categoryFilter === cat ? (cat === 'Premium' ? 'active-premium' : 'active') : ''}`}
                onClick={() => setCategoryFilter(cat)}>
                {cat === 'Premium' && <Star size={11} />}
                {cat === 'all' ? 'All Types' : cat}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)} style={{ flexShrink: 0 }}>
            <option value="priority">Sort: Priority</option>
            <option value="dueDate">Sort: Due Date</option>
            <option value="remaining">Sort: Remaining</option>
            <option value="recent">Sort: Recent</option>
          </select>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All (${statusCounts.all})` },
            { key: 'overdue', label: `Overdue (${statusCounts.overdue || 0})` },
            { key: 'allPending', label: `All Pending (${statusCounts.allPending || 0})` },
            { key: 'partialPending', label: `Partial Pending (${statusCounts.partialPending || 0})` },
            { key: 'paid', label: `Paid (${statusCounts.paid || 0})` },
          ].map(({ key, label }) => (
            <button key={key}
              className={`filter-chip ${statusFilter === key ? STATUS_CONFIG[key]?.chipClass || 'active' : ''}`}
              onClick={() => setStatusFilter(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── TABLE ─── */}
        <div className="card">
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<span style={{ fontSize: 32 }}>🏪</span>}
              title="No purchases found"
              message="Try adjusting your filters or add a new dealer purchase"
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bill No</th>
                    <th>Dealer</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const status = d._status;
                    const isPremium = d.category === 'Premium';
                    const isOverdue = status === 'overdue';
                    return (
                      <tr key={d.id}
                        className={`${isPremium ? 'dealer-row-premium' : ''} ${isOverdue ? 'dealer-row-overdue' : ''}`}
                        onClick={() => openDetail(d)}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--paper-2)', padding: '2px 7px', borderRadius: 4 }}>
                            {d.billNo || '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{d.dealerName}</div>
                          <span className={`priority-badge ${isPremium ? 'priority-premium' : 'priority-regular'}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                            {isPremium && <Star size={9} />} {d.category}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(d.totalAmount)}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(d.paidAmount)}</td>
                        <td>
                          <span style={{
                            fontFamily: 'DM Serif Display',
                            fontSize: 16,
                            color: d.remainingAmount > 0 ? (isOverdue ? 'var(--red)' : 'var(--accent)') : 'var(--green)',
                            fontWeight: isOverdue ? 700 : 400,
                          }}>
                            {formatCurrency(d.remainingAmount)}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <PaymentProgress paidAmount={d.paidAmount} totalAmount={d.totalAmount} />
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <Badge type={STATUS_CONFIG[status].badgeType}>{STATUS_CONFIG[status].label}</Badge>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <DueDateCell dueDate={d.dueDate} status={status} />
                        </td>
                        <td style={{ color: 'var(--ink-3)', fontSize: 12, maxWidth: 120 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {d.note || '—'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2" style={{ flexWrap: 'nowrap' }}>
                            {status !== 'paid' && (
                              <>
                                <button className="btn btn-sm btn-green" title="Record partial/full payment"
                                  onClick={() => setPayingDealer(d)}>
                                  <CreditCard size={12} /> Pay
                                </button>
                                <button className="btn btn-sm btn-ghost" title="Mark fully paid"
                                  onClick={() => markFullyPaid(d)}>
                                  <CheckCircle size={12} />
                                </button>
                              </>
                            )}
                            {status === 'paid' && (
                              <span style={{ fontSize: 11, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                                ✓ {formatDate(d.clearanceDate || d.paidAt)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── FOOTER SUMMARY ─── */}
        {filtered.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'white', borderRadius: 8, border: '1px solid var(--paper-3)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Showing <strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong> of {dealers.length} records
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Total remaining: <strong style={{ color: 'var(--accent)' }}>
                {formatCurrency(filtered.filter(d => d._status !== 'paid').reduce((s, d) => s + (d.remainingAmount || 0), 0))}
              </strong>
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Total paid: <strong style={{ color: 'var(--green)' }}>
                {formatCurrency(filtered.reduce((s, d) => s + (d.paidAmount || 0), 0))}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* ─── MODALS ─── */}
      {showAdd && (
        <AddDealerModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
      {payingDealer && (
        <PaymentModal dealer={payingDealer} onClose={() => setPayingDealer(null)}
          onSaved={() => { setPayingDealer(null); load(); }} />
      )}
      {detailDealer && (
        <DetailModal
          dealer={detailDealer}
          onClose={() => setDetailDealer(null)}
          onPayment={() => { setPayingDealer(detailDealer); setDetailDealer(null); }}
          onEdit={() => { setEditDealer(detailDealer); setDetailDealer(null); }}
          onHistory={() => setHistDealer(detailDealer)}
          onDelete={() => { setDetailDealer(null); load(); }}
        />
      )}
      {editDealer && (
        <EditDealerModal
          dealer={editDealer}
          onClose={() => setEditDealer(null)}
          onSaved={() => { setEditDealer(null); load(); }}
        />
      )}
      {histDealer && (
        <HistoryModal
          title={histDealer.dealerName}
          history={histDealer.history || []}
          onClose={() => setHistDealer(null)}
        />
      )}
    </div>
  );
}
