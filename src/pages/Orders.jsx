import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, CheckCircle, Eye, UserCheck, Image, ArrowUpDown, Edit2, History, Trash2, ScanLine, Camera, Loader } from 'lucide-react';
import { ordersDB, activityDB, assignmentsDB, kaligadhsDB } from '../db';
import { generateUUID, formatCurrency, formatDate, todayISO, applyEdit, fileToBase64 } from '../utils';
import { SearchBar, Badge, ItemTag, EmptyState, Modal, FormGroup, HistoryModal, PageHelp } from '../components/UI';
import { authFetch } from '../context/AuthContext';

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function DeliveryLabel({ deliveryDate, status }) {
  if (!deliveryDate) return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>;
  if (status === 'completed') {
    return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>{formatDate(deliveryDate)}</span>;
  }
  const days = daysRemaining(deliveryDate);
  if (days < 0) return <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Due Today</span>;
  if (days <= 2) return <div><div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDate(deliveryDate)}</div><span style={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>{days}d left</span></div>;
  return <div><div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDate(deliveryDate)}</div><span style={{ fontSize: 12, color: 'var(--green)' }}>{days}d left</span></div>;
}

// ─── EDIT ORDER MODAL ─────────────────────────────────────────────────────────
function EditOrderModal({ order, itemCategories, onClose, onSaved }) {
  const [form, setForm] = useState({
    customerName:  order.customerName || '',
    customerPhone: order.customerPhone || '',
    billNo:        order.billNo || '',
    totalAmount:   order.totalAmount ?? '',
    advanceAmount: order.advanceAmount ?? '',
    discount:      order.discount ?? '',
    deliveryDate:  order.deliveryDate ? order.deliveryDate.split('T')[0] : '',
    note:          order.note || '',
  });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const total    = Number(form.totalAmount)   || 0;
  const advance  = Number(form.advanceAmount) || 0;
  const discount = Number(form.discount)      || 0;
  const remaining = Math.max(0, total - discount - advance);

  async function handleSave() {
    if (!form.customerName.trim()) return alert('Customer name is required.');
    setSaving(true);
    const updates = {
      customerName:   form.customerName.trim(),
      customerPhone:  form.customerPhone.trim(),
      billNo:         form.billNo.trim(),
      totalAmount:    total,
      advanceAmount:  advance,
      discount,
      remainingAmount: remaining,
      deliveryDate:   form.deliveryDate || null,
      note:           form.note.trim(),
    };
    const updated = applyEdit(order, updates);
    await ordersDB.save(updated);
    setSaving(false);
    onSaved(updated);
  }

  return (
    <Modal title={`Edit Order ${order.id}`} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </>}>

      <div className="grid-2">
        <FormGroup label="Customer Name" required>
          <input className="form-input" value={form.customerName}
            onChange={e => f('customerName', e.target.value)} />
        </FormGroup>
        <FormGroup label="Phone">
          <input className="form-input" value={form.customerPhone}
            onChange={e => f('customerPhone', e.target.value)} />
        </FormGroup>
      </div>

      <div className="grid-2">
        <FormGroup label="Bill No">
          <input className="form-input" value={form.billNo}
            onChange={e => f('billNo', e.target.value)} />
        </FormGroup>
        <FormGroup label="Delivery Date">
          <input className="form-input" type="date" value={form.deliveryDate}
            onChange={e => f('deliveryDate', e.target.value)} />
        </FormGroup>
      </div>

      <div className="grid-2">
        <FormGroup label="Total Amount (Rs.)" required>
          <input className="form-input" type="number" value={form.totalAmount}
            onChange={e => f('totalAmount', e.target.value)} />
        </FormGroup>
        <FormGroup label="Advance Paid (Rs.)">
          <input className="form-input" type="number" value={form.advanceAmount}
            onChange={e => f('advanceAmount', e.target.value)} />
        </FormGroup>
      </div>

      <div className="grid-2">
        <FormGroup label="Discount (Rs.)">
          <input className="form-input" type="number" value={form.discount}
            onChange={e => f('discount', e.target.value)} />
        </FormGroup>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
          <div style={{ padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 8, flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 2 }}>Remaining</div>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: remaining > 0 ? 'var(--accent)' : 'var(--green)' }}>
              {formatCurrency(remaining)}
            </div>
          </div>
        </div>
      </div>

      <FormGroup label="Note">
        <textarea className="form-textarea" value={form.note}
          onChange={e => f('note', e.target.value)} style={{ minHeight: 56 }} />
      </FormGroup>
    </Modal>
  );
}

// ─── EDIT ASSIGNMENT MODAL ────────────────────────────────────────────────────
function EditAssignmentModal({ assignment, kaligadhName, onClose, onSaved }) {
  const [makingCost, setMakingCost] = useState(String(assignment.makingCost ?? ''));
  const [note, setNote] = useState(assignment.note || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated = applyEdit(assignment, {
      makingCost: Number(makingCost) || 0,
      note: note.trim(),
    });
    await assignmentsDB.save(updated);
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={`Edit Assignment — ${assignment.itemCategory}`} onClose={onClose} size="modal-sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </>}>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--ink-3)' }}>
        Worker: <strong style={{ color: 'var(--ink)' }}>{kaligadhName}</strong>
      </div>
      <FormGroup label="Making Cost (Rs.)" required>
        <input className="form-input" type="number" value={makingCost}
          onChange={e => setMakingCost(e.target.value)} autoFocus />
      </FormGroup>
      <FormGroup label="Note">
        <input className="form-input" value={note}
          onChange={e => setNote(e.target.value)} placeholder="Any note..." />
      </FormGroup>
    </Modal>
  );
}

// ─── ORDER DETAIL MODAL ───────────────────────────────────────────────────────
function OrderDetail({ order, onClose, onAssign, onComplete, onEdit, onShowHistory }) {
  const [assignments, setAssignments]   = useState([]);
  const [kaligadhs, setKaligadhs]       = useState([]);
  const [showBill, setShowBill]         = useState(false);
  const [editAssign, setEditAssign]     = useState(null);
  const [histAssign, setHistAssign]     = useState(null);

  useEffect(() => {
    async function load() {
      const [as, ks] = await Promise.all([
        assignmentsDB.getByOrder(order.id),
        kaligadhsDB.getAll(),
      ]);
      setAssignments(as);
      setKaligadhs(ks);
    }
    load();
  }, [order.id]);

  function reloadAssignments() {
    assignmentsDB.getByOrder(order.id).then(as => setAssignments(as));
  }

  const getKaligadh = (id) => kaligadhs.find(k => k.id === id);

  return (
    <>
      <Modal title={`Order ${order.id}`} onClose={onClose} size="modal-lg"
        footer={<>
          <button className="btn btn-ghost btn-sm" onClick={onShowHistory} title="Edit history">
            <History size={13} /> History
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {order.status === 'inProgress' && <>
            <button className="btn btn-primary" onClick={() => onEdit(order)}>
              <Edit2 size={14} /> Edit
            </button>
            <button className="btn btn-primary" onClick={() => onAssign(order)}>
              <UserCheck size={14} /> Assign Kaligadh
            </button>
            <button className="btn btn-green" onClick={() => onComplete(order)}>
              <CheckCircle size={14} /> Mark Completed
            </button>
          </>}
        </>}>

        {/* Status */}
        <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          <Badge type={order.status === 'completed' ? 'green' : 'amber'}>
            {order.status === 'inProgress' ? 'In Progress' : 'Completed'}
          </Badge>
          {order.billNo && <Badge type="gray">Bill #{order.billNo}</Badge>}
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Ordered {formatDate(order.createdAt)}</span>
          {order.updatedAt && (
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>· Edited {formatDate(order.updatedAt)}</span>
          )}
          {order.deliveryDate && (
            <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--ink-4)' }}>Delivery:</span>
              <DeliveryLabel deliveryDate={order.deliveryDate} status={order.status} />
            </span>
          )}
        </div>

        <div className="grid-2 mb-4">
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Customer</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{order.customerName}</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{order.customerPhone}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Items</div>
            <div>{order.items?.map(i => <ItemTag key={i} item={i} />)}</div>
          </div>
        </div>

        {/* Financials */}
        <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total',     value: formatCurrency(order.totalAmount) },
              { label: 'Discount',  value: formatCurrency(order.discount), color: 'var(--green)' },
              { label: 'Advance',   value: formatCurrency(order.advanceAmount), color: 'var(--green)' },
              { label: 'Remaining', value: formatCurrency(order.remainingAmount), color: order.remainingAmount > 0 ? 'var(--accent)' : 'var(--green)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 16, color: color || 'var(--ink)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Assignments */}
        {assignments.length > 0 && (
          <div className="mb-4">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Kaligadh Assignments
            </div>
            {assignments.map(a => {
              const k = getKaligadh(a.kaligadhId);
              return (
                <div key={a.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                  <div className="flex items-center gap-3">
                    <ItemTag item={a.itemCategory} />
                    <span style={{ fontWeight: 600 }}>{k?.name || 'Unknown'}</span>
                    {a.note && <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>· {a.note}</span>}
                    {a.updatedAt && <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>(edited)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: 'DM Serif Display', color: 'var(--accent)' }}>Rs. {a.makingCost}</span>
                    {order.status === 'inProgress' && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}
                        onClick={() => setEditAssign(a)} title="Edit">
                        <Edit2 size={11} />
                      </button>
                    )}
                    {(a.history?.length > 0) && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', color: 'var(--blue)' }}
                        onClick={() => setHistAssign(a)} title="Edit history">
                        <History size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Note */}
        {order.note && (
          <div style={{ padding: '10px 14px', background: 'var(--amber-light)', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>
            <strong>Note:</strong> {order.note}
          </div>
        )}

        {/* Bill Photo */}
        {order.billPhoto && (
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowBill(!showBill)}>
              <Image size={13} /> {showBill ? 'Hide' : 'View'} Bill Photo
            </button>
            {showBill && <img src={order.billPhoto} alt="Bill" style={{ marginTop: 10, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--paper-3)' }} />}
          </div>
        )}
      </Modal>

      {editAssign && (
        <EditAssignmentModal
          assignment={editAssign}
          kaligadhName={getKaligadh(editAssign.kaligadhId)?.name || 'Unknown'}
          onClose={() => setEditAssign(null)}
          onSaved={() => { setEditAssign(null); reloadAssignments(); }}
        />
      )}

      {histAssign && (
        <HistoryModal
          title={`${histAssign.itemCategory} assignment`}
          history={histAssign.history || []}
          onClose={() => setHistAssign(null)}
        />
      )}
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Orders({ onNewOrder, onNewOrderFromScan, onAssignOrder, highlightOrderId, onHighlightClear, itemCategories = [] }) {
  const [orders, setOrders]       = useState([]);
  const [filter, setFilter]       = useState('inProgress');
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected]   = useState(null);
  const [editing, setEditing]     = useState(null);
  const [histOrder, setHistOrder] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [sortBy, setSortBy]       = useState('date');
  const [page, setPage]           = useState(1);
  const [scanning, setScanning]   = useState(false);
  const scanInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  const PAGE_SIZE = 25;

  useEffect(() => { load(); }, []);

  // Debounce search 250ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filter/search/sort changes
  useEffect(() => { setPage(1); }, [filter, debouncedSearch, sortBy]);

  useEffect(() => {
    if (highlightOrderId && orders.length > 0) {
      const o = orders.find(x => x.id === highlightOrderId);
      if (o) { setSelected(o); setFilter('all'); }
      if (onHighlightClear) onHighlightClear();
    }
  }, [highlightOrderId, orders]);

  async function load() {
    setLoading(true);
    const all = await ordersDB.getAll();
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setOrders(all);
    setLoading(false);
  }

  async function markCompleted(order) {
    if (!window.confirm(`Mark order ${order.id} as completed and record remaining balance of Rs. ${order.remainingAmount}?`)) return;
    const now = new Date().toISOString();
    const updated = applyEdit(order, { status: 'completed', completedAt: now });
    await ordersDB.save(updated);

    // Stamp completedAt on every assignment for this order so salary month
    // is based on completion date, not assignment date.
    const assignments = await assignmentsDB.getByOrder(order.id);
    await Promise.all(
      assignments.map(a => assignmentsDB.save({ ...a, completedAt: now }))
    );

    if (order.remainingAmount > 0) {
      await activityDB.save({
        id: generateUUID(),
        type: 'revenue',
        subType: 'balance',
        amount: order.remainingAmount,
        description: `Balance received — ${order.customerName}`,
        referenceId: order.id,
        referenceType: 'order',
        date: now,
      });
    }
    setSelected(null);
    load();
  }

  function handleEditSaved(updatedOrder) {
    setEditing(null);
    setSelected(updatedOrder);
    load();
  }

  async function deleteOrder(order) {
    if (!window.confirm(`Delete order ${order.id}? This cannot be undone and will not affect financial records.`)) return;
    const assignments = await assignmentsDB.getByOrder(order.id);
    await Promise.all(assignments.map(a => assignmentsDB.delete(a.id)));
    await ordersDB.delete(order.id);
    setSelected(null);
    load();
  }

  async function handleScanFile(file) {
    if (!file) return;
    setScanning(true);
    try {
      const image = await fileToBase64(file);
      const r = await authFetch('/api/scan', {
        method: 'POST',
        body: { image, itemCategories: itemCategories.map(i => i.name) },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Scan failed');
      onNewOrderFromScan({ ...d.extracted, billPhoto: image });
    } catch (err) {
      alert('Scan failed: ' + err.message);
    } finally {
      setScanning(false);
      if (scanInputRef.current)  scanInputRef.current.value  = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  const filtered = useMemo(() => orders
    .filter(o => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        return o.customerName.toLowerCase().includes(s) ||
          o.id.toLowerCase().includes(s) ||
          (o.billNo || '').toLowerCase().includes(s);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'amount')   return (b.totalAmount || 0) - (a.totalAmount || 0);
      if (sortBy === 'pcs')      return (b.items?.length || 0) - (a.items?.length || 0);
      if (sortBy === 'delivery') return new Date(a.deliveryDate || '9999-12-31') - new Date(b.deliveryDate || '9999-12-31');
      return new Date(b.createdAt) - new Date(a.createdAt);
    }), [orders, filter, debouncedSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const { pending, pendingAmt, pendingPcs } = useMemo(() => {
    const pending = orders.filter(o => o.status === 'inProgress');
    return {
      pending,
      pendingAmt: pending.reduce((s, o) => s + (o.remainingAmount || 0), 0),
      pendingPcs: pending.reduce((s, o) => s + (o.items?.length || 0), 0),
    };
  }, [orders]);

  return (
    <div>
      {/* Hidden scan inputs */}
      <input ref={scanInputRef}   type="file" accept="image/*"                    style={{ display: 'none' }} onChange={e => handleScanFile(e.target.files[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleScanFile(e.target.files[0])} />

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Orders</h2>
          <p>Manage all customer orders</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost btn-lg" disabled={scanning} onClick={() => scanInputRef.current?.click()} title="Scan bill from gallery">
            {scanning ? <Loader size={15} className="spin" /> : <ScanLine size={15} />}
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
          <button className="btn btn-ghost btn-lg" disabled={scanning} onClick={() => cameraInputRef.current?.click()} title="Take photo to scan">
            <Camera size={15} />
          </button>
          <button className="btn btn-accent btn-lg" onClick={onNewOrder}>
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      <div className="page-body">
        <PageHelp id="orders" title="How Orders Work" items={[
          'Create an order when a customer brings in clothes. Set the total amount, advance paid, and delivery date.',
          'Advance payments are recorded as income immediately in the Activity ledger.',
          'Assign orders to Kaligadh workers from the order detail view or the Assign Kaligadh page.',
          'Mark an order Completed when the customer picks up — remaining balance is recorded as income at that point.',
          'Deleting an order removes it completely without any financial impact (no income recorded).',
          'Use Scan Bill to extract order details from a photo automatically using AI.',
        ]} />
        {/* Summary */}
        {loading ? (
          <div style={{ padding: '12px 20px', background: 'var(--paper-2)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 32, alignItems: 'center' }}>
            {[120, 160, 130].map((w, i) => (
              <div key={i}>
                <div className="skeleton" style={{ width: w * 0.6, height: 10, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: w, height: 22 }} />
              </div>
            ))}
          </div>
        ) : pending.length > 0 && (
          <div style={{ padding: '12px 20px', background: 'var(--amber-light)', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 32, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pending Orders</div>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: '#92400E' }}>{pending.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pending Amount</div>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: '#92400E' }}>Rs. {pendingAmt.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pending Pieces</div>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: '#92400E' }}>{pendingPcs}</div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name, order ID or bill no..." />
          </div>
          <div className="flex gap-2">
            {['inProgress', 'completed', 'all'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'inProgress' ? 'In Progress' : f === 'completed' ? 'Completed' : 'All'}
              </button>
            ))}
          </div>
          <div className="flex gap-1" style={{ borderLeft: '1px solid var(--paper-3)', paddingLeft: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center', marginRight: 2 }}><ArrowUpDown size={12} /></span>
            {[
              { key: 'date', label: 'Date' },
              { key: 'delivery', label: 'Delivery' },
              { key: 'amount', label: 'Amount' },
              { key: 'pcs', label: 'Pcs' },
            ].map(s => (
              <button key={s.key} className={`btn btn-sm ${sortBy === s.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSortBy(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: '8px 0' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--paper-2)', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 60,  height: 16 }} />
                  <div className="skeleton" style={{ width: 100, height: 16 }} />
                  <div className="skeleton" style={{ width: 70,  height: 16 }} />
                  <div className="skeleton" style={{ width: 70,  height: 16, marginLeft: 'auto' }} />
                  <div className="skeleton" style={{ width: 60,  height: 16 }} />
                  <div className="skeleton" style={{ width: 50,  height: 22, borderRadius: 99 }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0
          ? <EmptyState
              icon={<Plus size={32} style={{ marginBottom: 0 }} />}
              title="No orders found"
              message={search ? 'Try a different search term' : 'Create your first order to get started'}
            />
          : <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Advance</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Delivery</th>
                  <th>Date</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {paginated.map(o => (
                    <tr key={o.id} onClick={() => setSelected(o)}>
                      <td>
                        <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)' }}>{o.id}</span>
                        {o.billNo && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Bill #{o.billNo}</div>}
                        {o.history?.length > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--blue)', marginTop: 1 }}>
                            {o.history.length} edit{o.history.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{o.customerPhone}</div>
                      </td>
                      <td>{o.items?.map(i => <ItemTag key={i} item={i} />)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(o.totalAmount)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(o.advanceAmount)}</td>
                      <td style={{ color: o.remainingAmount > 0 ? 'var(--accent)' : 'var(--green)', fontWeight: 600 }}>{formatCurrency(o.remainingAmount)}</td>
                      <td><Badge type={o.status === 'completed' ? 'green' : 'amber'}>{o.status === 'inProgress' ? 'In Progress' : 'Completed'}</Badge></td>
                      <td><DeliveryLabel deliveryDate={o.deliveryDate} status={o.status} /></td>
                      <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(o.createdAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm" title="View" onClick={() => setSelected(o)}>
                            <Eye size={13} />
                          </button>
                          {o.status === 'inProgress' && (
                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => { setSelected(null); setEditing(o); }}>
                              <Edit2 size={13} />
                            </button>
                          )}
                          {o.history?.length > 0 && (
                            <button className="btn btn-ghost btn-sm" title="Edit history" style={{ color: 'var(--blue)' }}
                              onClick={() => setHistOrder(o)}>
                              <History size={13} />
                            </button>
                          )}
                          {o.status === 'inProgress' && (
                            <button className="btn btn-green btn-sm" onClick={() => markCompleted(o)}>
                              <CheckCircle size={13} /> Done
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" title="Delete order" style={{ color: 'var(--red)' }}
                            onClick={() => deleteOrder(o)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--paper-3)', fontSize: 13, color: 'var(--ink-3)' }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span>{page} / {totalPages} <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>({filtered.length} orders)</span></span>
                  <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </div>
          }
        </div>
      </div>

      {selected && !editing && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onAssign={o => { setSelected(null); onAssignOrder(o); }}
          onComplete={o => { setSelected(null); markCompleted(o); }}
          onEdit={o => { setSelected(null); setEditing(o); }}
          onShowHistory={() => setHistOrder(selected)}
        />
      )}

      {editing && (
        <EditOrderModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={handleEditSaved}
        />
      )}

      {histOrder && (
        <HistoryModal
          title={`Order ${histOrder.id}`}
          history={histOrder.history || []}
          onClose={() => setHistOrder(null)}
        />
      )}
    </div>
  );
}
