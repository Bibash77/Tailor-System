import { useState, useEffect } from 'react';
import { Plus, CheckCircle, X } from 'lucide-react';
import { dealersDB, activityDB } from '../db';
import { generateUUID, formatCurrency, formatDate, todayISO } from '../utils';
import { Modal, SearchBar, Badge, EmptyState, FormGroup } from '../components/UI';

function AddDealerModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ dealerName: '', totalAmount: '', paidAmount: '', note: '' });
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, (Number(form.totalAmount) || 0) - (Number(form.paidAmount) || 0));

  async function handleSave() {
    if (!form.dealerName.trim()) return alert('Dealer name is required.');
    if (!form.totalAmount || isNaN(Number(form.totalAmount))) return alert('Total amount is required.');
    setSaving(true);
    const paid = Number(form.paidAmount) || 0;
    const dealer = {
      id: generateUUID(),
      dealerName: form.dealerName.trim(),
      totalAmount: Number(form.totalAmount),
      paidAmount: paid,
      remainingAmount: remaining,
      status: remaining > 0 ? 'remaining' : 'paid',
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
      paidAt: remaining === 0 ? new Date().toISOString() : null,
    };
    await dealersDB.save(dealer);

    // Log paid amount as expense immediately
    if (paid > 0) {
      await activityDB.save({
        id: generateUUID(),
        type: 'expense',
        subType: 'dealerPaid',
        amount: paid,
        description: `Purchase paid — ${dealer.dealerName}`,
        referenceId: dealer.id,
        referenceType: 'dealer',
        date: new Date().toISOString(),
      });
    }
    setSaving(false);
    onSaved();
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal title="Add Dealer Purchase" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>Save Purchase</button>
      </>}>

      <FormGroup label="Dealer Name" required>
        <input className="form-input" placeholder="e.g. Shyam Textiles" value={form.dealerName} onChange={e => f('dealerName', e.target.value)} />
      </FormGroup>

      <div className="grid-2">
        <FormGroup label="Total Amount (Rs.)" required>
          <input className="form-input" type="number" placeholder="0" value={form.totalAmount} onChange={e => f('totalAmount', e.target.value)} />
        </FormGroup>
        <FormGroup label="Paid Amount (Rs.)">
          <input className="form-input" type="number" placeholder="0" value={form.paidAmount} onChange={e => f('paidAmount', e.target.value)} />
        </FormGroup>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--paper-2)', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>REMAINING</span>
        <span style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: remaining > 0 ? 'var(--accent)' : 'var(--green)' }}>
          {formatCurrency(remaining)}
        </span>
      </div>

      <FormGroup label="Note (optional)">
        <textarea className="form-textarea" placeholder="Any note about this purchase..." value={form.note} onChange={e => f('note', e.target.value)} style={{ minHeight: 60 }} />
      </FormGroup>
    </Modal>
  );
}

export default function Dealers() {
  const [dealers, setDealers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('remaining');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const ds = await dealersDB.getAll();
    ds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setDealers(ds);
    setLoading(false);
  }

  async function markPaid(dealer) {
    if (!window.confirm(`Mark ${dealer.dealerName} as fully paid? Remaining Rs. ${dealer.remainingAmount} will be recorded as expense.`)) return;
    await dealersDB.save({ ...dealer, status: 'paid', paidAmount: dealer.totalAmount, remainingAmount: 0, paidAt: new Date().toISOString() });
    if (dealer.remainingAmount > 0) {
      await activityDB.save({
        id: generateUUID(),
        type: 'expense',
        subType: 'dealerBalance',
        amount: dealer.remainingAmount,
        description: `Balance paid — ${dealer.dealerName}`,
        referenceId: dealer.id,
        referenceType: 'dealer',
        date: new Date().toISOString(),
      });
    }
    load();
  }

  const filtered = dealers.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (search && !d.dealerName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRemaining = dealers.filter(d => d.status === 'remaining').reduce((s, d) => s + (d.remainingAmount || 0), 0);
  const totalPaid = dealers.filter(d => d.status === 'paid').reduce((s, d) => s + (d.totalAmount || 0), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Dealers</h2>
          <p>Track fabric supplier purchases and payments</p>
        </div>
        <button className="btn btn-accent btn-lg" style={{ marginTop: 4 }} onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Purchase
        </button>
      </div>

      <div className="page-body">

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Purchases</div>
            <div className="stat-value">{dealers.length}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Remaining</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{formatCurrency(totalRemaining)}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--green)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Paid</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCurrency(totalPaid)}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-3 mb-4 items-center">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by dealer name..." />
          <div className="flex gap-2">
            {['remaining', 'paid', 'all'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'remaining' ? 'Remaining' : f === 'paid' ? 'Paid' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>
          : filtered.length === 0
          ? <EmptyState
              icon={<span style={{ fontSize: 32 }}>🏪</span>}
              title="No purchases found"
              message={filter === 'remaining' ? 'No pending dealer payments' : 'Add your first dealer purchase'}
            />
          : <table>
              <thead><tr>
                <th>Dealer Name</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Date</th>
                <th>Note</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.dealerName}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(d.totalAmount)}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(d.paidAmount)}</td>
                    <td style={{ color: d.remainingAmount > 0 ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'DM Serif Display', fontSize: 16 }}>
                      {formatCurrency(d.remainingAmount)}
                    </td>
                    <td><Badge type={d.status === 'paid' ? 'green' : 'amber'}>{d.status === 'paid' ? 'Paid' : 'Remaining'}</Badge></td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(d.createdAt)}</td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12, maxWidth: 140 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{d.note || '—'}</span>
                    </td>
                    <td>
                      {d.status === 'remaining' && (
                        <button className="btn btn-green btn-sm" onClick={() => markPaid(d)}>
                          <CheckCircle size={13} /> Mark Paid
                        </button>
                      )}
                      {d.status === 'paid' && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDate(d.paidAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>

      {showAdd && <AddDealerModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}
