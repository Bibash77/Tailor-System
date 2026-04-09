import { useState, useEffect } from 'react';
import { Plus, Search, Filter, CheckCircle, Eye, UserCheck, X, ChevronDown, Image } from 'lucide-react';
import { ordersDB, activityDB, assignmentsDB, kaligadhsDB } from '../db';
import { generateUUID, formatCurrency, formatDate, ITEM_COLORS } from '../utils';
import { SearchBar, Badge, ItemTag, EmptyState, Modal } from '../components/UI';

function OrderDetail({ order, onClose, onAssign, onComplete }) {
  const [assignments, setAssignments] = useState([]);
  const [kaligadhs, setKaligadhs] = useState([]);
  const [showBill, setShowBill] = useState(false);

  useEffect(() => {
    async function load() {
      const as = await assignmentsDB.getByOrder(order.id);
      const ks = await kaligadhsDB.getAll();
      setAssignments(as);
      setKaligadhs(ks);
    }
    load();
  }, [order.id]);

  const getKaligadh = (id) => kaligadhs.find(k => k.id === id);

  return (
    <Modal title={`Order ${order.id}`} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        {order.status === 'inProgress' && <>
          <button className="btn btn-primary" onClick={() => onAssign(order)}><UserCheck size={14} /> Assign Kaligadh</button>
          <button className="btn btn-green" onClick={() => onComplete(order)}><CheckCircle size={14} /> Mark Completed</button>
        </>}
      </>}>

      {/* Status */}
      <div className="flex items-center gap-3 mb-4">
        <Badge type={order.status === 'completed' ? 'green' : 'amber'}>
          {order.status === 'inProgress' ? 'In Progress' : 'Completed'}
        </Badge>
        {order.billNo && <Badge type="gray">Bill #{order.billNo}</Badge>}
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{formatDate(order.createdAt)}</span>
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
            { label: 'Total', value: formatCurrency(order.totalAmount) },
            { label: 'Discount', value: formatCurrency(order.discount), color: 'var(--green)' },
            { label: 'Advance', value: formatCurrency(order.advanceAmount), color: 'var(--green)' },
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Kaligadh Assignments</div>
          {assignments.map(a => {
            const k = getKaligadh(a.kaligadhId);
            return (
              <div key={a.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                <div className="flex items-center gap-3">
                  <ItemTag item={a.itemCategory} />
                  <span style={{ fontWeight: 600 }}>{k?.name || 'Unknown'}</span>
                  {a.note && <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>· {a.note}</span>}
                </div>
                <span style={{ fontFamily: 'DM Serif Display', color: 'var(--accent)' }}>Rs. {a.makingCost}</span>
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
  );
}

export default function Orders({ onNewOrder, onAssignOrder, highlightOrderId, onHighlightClear }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('inProgress');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

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
    await ordersDB.save({ ...order, status: 'completed', completedAt: new Date().toISOString() });
    if (order.remainingAmount > 0) {
      await activityDB.save({
        id: generateUUID(),
        type: 'revenue',
        subType: 'balance',
        amount: order.remainingAmount,
        description: `Balance received — ${order.customerName}`,
        referenceId: order.id,
        referenceType: 'order',
        date: new Date().toISOString(),
      });
    }
    setSelected(null);
    load();
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return o.customerName.toLowerCase().includes(s) ||
        o.id.toLowerCase().includes(s) ||
        (o.billNo || '').toLowerCase().includes(s);
    }
    return true;
  });

  const pending = orders.filter(o => o.status === 'inProgress');
  const pendingAmt = pending.reduce((s, o) => s + (o.remainingAmount || 0), 0);
  const pendingPcs = pending.reduce((s, o) => s + (o.items?.length || 0), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Orders</h2>
          <p>Manage all customer orders</p>
        </div>
        <button className="btn btn-accent btn-lg" style={{ marginTop: 4 }} onClick={onNewOrder}>
          <Plus size={16} /> New Order
        </button>
      </div>

      <div className="page-body">
        {/* Summary */}
        {pending.length > 0 && (
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
        <div className="flex gap-3 mb-4 items-center">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name, order ID or bill no..." />
          <div className="flex gap-2">
            {['inProgress', 'completed', 'all'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'inProgress' ? 'In Progress' : f === 'completed' ? 'Completed' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>
          : filtered.length === 0
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
                  <th>Date</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id} onClick={() => setSelected(o)}>
                      <td>
                        <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)' }}>{o.id}</span>
                        {o.billNo && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Bill #{o.billNo}</div>}
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
                      <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(o.createdAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)}><Eye size={13} /></button>
                          {o.status === 'inProgress' && (
                            <button className="btn btn-green btn-sm" onClick={() => markCompleted(o)}>
                              <CheckCircle size={13} /> Done
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onAssign={(o) => { setSelected(null); onAssignOrder(o); }}
          onComplete={(o) => { setSelected(null); markCompleted(o); }}
        />
      )}
    </div>
  );
}
