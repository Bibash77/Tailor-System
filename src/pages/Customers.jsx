import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, ArrowUpDown, Calendar } from 'lucide-react';
import { ordersDB } from '../db';
import { formatCurrency, formatDate } from '../utils';
import { SearchBar, Badge, EmptyState, ItemTag, Avatar, PageHelp, TableSkeleton } from '../components/UI';

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function DeliveryChip({ dateStr }) {
  if (!dateStr) return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>;
  const days = daysRemaining(dateStr);
  if (days < 0) return <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Due today</span>;
  if (days <= 3) return <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>{days}d left</span>;
  return <span style={{ fontSize: 12, color: 'var(--green)' }}>{days}d · {formatDate(dateStr)}</span>;
}

function deriveCustomers(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.customerPhone?.trim() || o.customerName?.trim();
    if (!key) continue;
    if (!map[key]) {
      map[key] = { key, name: o.customerName, phone: o.customerPhone || '—', orders: [] };
    }
    map[key].orders.push(o);
  }

  return Object.values(map).map(c => {
    const sorted = c.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalSpent = sorted.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
    const totalPaid = sorted.reduce((s, o) => s + (Number(o.advanceAmount) || 0), 0);
    const totalRemaining = sorted.reduce((s, o) => s + (Number(o.remainingAmount) || 0), 0);
    const active = sorted.filter(o => o.status === 'inProgress');
    const completed = sorted.filter(o => o.status === 'completed').length;
    const nearestDelivery = active.map(o => o.deliveryDate).filter(Boolean).sort()[0] || null;
    const totalPcs = sorted.reduce((s, o) => s + (o.items?.length || 0), 0);
    return {
      ...c,
      orders: sorted,
      totalSpent,
      totalPaid,
      totalRemaining,
      inProgress: active.length,
      completed,
      nearestDelivery,
      totalPcs,
      lastOrderDate: sorted[0]?.createdAt,
    };
  });
}

function CustomerDetail({ customer, onBack, onNewOrder }) {
  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              <ChevronLeft size={16} /> Back
            </button>
            <Avatar name={customer.name} size={48} />
            <div>
              <h2 style={{ margin: 0 }}>{customer.name}</h2>
              <p style={{ margin: 0 }}>{customer.phone}</p>
            </div>
          </div>
          <button className="btn btn-accent btn-lg" onClick={() => onNewOrder(customer)}>
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <div className="stat-label">Total Business</div>
            <div className="stat-value" style={{ fontFamily: 'DM Serif Display', fontSize: 32, color: 'var(--green)' }}>
              {formatCurrency(customer.totalSpent)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Already Paid</div>
            <div className="stat-value">{formatCurrency(customer.totalPaid)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Remaining Due</div>
            <div className="stat-value" style={{ color: customer.totalRemaining > 0 ? 'var(--accent)' : 'var(--green)' }}>
              {formatCurrency(customer.totalRemaining)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{customer.orders.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Pieces</div>
            <div className="stat-value">{customer.totalPcs} pcs</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active / Done</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{customer.inProgress} / {customer.completed}</div>
          </div>
          {customer.nearestDelivery && (
            <div className="stat-card" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calendar size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
              <div>
                <div className="stat-label">Nearest Active Delivery</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                  <DeliveryChip dateStr={customer.nearestDelivery} />
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(customer.nearestDelivery)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order History */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Order History · {customer.orders.length} orders
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => onNewOrder(customer)}>
              <Plus size={13} /> New Order
            </button>
          </div>
          {customer.orders.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--paper-2)', fontSize: 13, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'DM Serif Display', color: 'var(--accent)', fontSize: 15 }}>{o.id}</span>
                  <Badge type={o.status === 'completed' ? 'green' : 'amber'}>
                    {o.status === 'completed' ? 'Completed' : 'In Progress'}
                  </Badge>
                  {o.status === 'inProgress' && o.deliveryDate && (
                    <DeliveryChip dateStr={o.deliveryDate} />
                  )}
                  {o.billNo && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Bill #{o.billNo}</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                  {o.items?.map(item => <ItemTag key={item} item={item} />)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDate(o.createdAt)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 15 }}>{formatCurrency(o.totalAmount)}</div>
                {(o.remainingAmount || 0) > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{formatCurrency(o.remainingAmount)} due</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage({ onNewOrderForCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [filterBy, setFilterBy] = useState('all');

  useEffect(() => {
    ordersDB.getAll().then(orders => {
      setCustomers(deriveCustomers(orders));
      setLoading(false);
    });
  }, []);

  if (selected) {
    return (
      <CustomerDetail
        customer={selected}
        onBack={() => setSelected(null)}
        onNewOrder={onNewOrderForCustomer}
      />
    );
  }

  let filtered = customers.filter(c => {
    if (filterBy === 'active' && c.inProgress === 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'orders') return b.orders.length - a.orders.length;
    if (sortBy === 'value') return b.totalSpent - a.totalSpent;
    if (sortBy === 'delivery') {
      if (!a.nearestDelivery && !b.nearestDelivery) return 0;
      if (!a.nearestDelivery) return 1;
      if (!b.nearestDelivery) return -1;
      return new Date(a.nearestDelivery) - new Date(b.nearestDelivery);
    }
    return new Date(b.lastOrderDate) - new Date(a.lastOrderDate);
  });

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalRemaining = customers.reduce((s, c) => s + c.totalRemaining, 0);
  const activeCount = customers.filter(c => c.inProgress > 0).length;

  return (
    <div>
      <div className="page-header">
        <h2>Customers</h2>
        <p>Browse customers, order history, and quick actions</p>
      </div>
      <div className="page-body">
        <PageHelp id="customers" title="How Customers Work" items={[
          'Customers are automatically derived from your order history — no manual entry needed.',
          'Each customer groups all orders by their phone number (or name if no phone).',
          'Total Spent = sum of all order amounts for that customer. Repeat = 2+ orders.',
          'Click "New Order" on a customer card to pre-fill their name and phone in a new order.',
          'Customers with no orders will not appear here — create an order first.',
        ]} />

        {customers.length > 0 && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            {[
              { label: 'Total Customers', value: customers.length },
              { label: 'Active (Pending Orders)', value: activeCount, accent: activeCount > 0 ? 'var(--accent)' : undefined },
              { label: 'Total Revenue', value: formatCurrency(totalRevenue), accent: 'var(--green)' },
              { label: 'Outstanding Balance', value: formatCurrency(totalRemaining), accent: totalRemaining > 0 ? 'var(--accent)' : undefined },
            ].map(({ label, value, accent }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={accent ? { color: accent } : {}}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          {/* Toolbar */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--paper-2)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name or phone..." />
            </div>
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
              ].map(f => (
                <button key={f.key} className={`btn btn-sm ${filterBy === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterBy(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1" style={{ borderLeft: '1px solid var(--paper-3)', paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center', marginRight: 2 }}><ArrowUpDown size={12} /></span>
              {[
                { key: 'recent', label: 'Recent' },
                { key: 'orders', label: 'Orders' },
                { key: 'value', label: 'Value' },
                { key: 'delivery', label: 'Delivery' },
              ].map(s => (
                <button key={s.key} className={`btn btn-sm ${sortBy === s.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSortBy(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {loading
            ? <TableSkeleton rows={5} cols={4} />
            : filtered.length === 0
            ? <EmptyState
                icon={<span style={{ fontSize: 32 }}>👥</span>}
                title={search ? 'No customers found' : filterBy === 'active' ? 'No active customers' : 'No customers yet'}
                message={search ? 'Try a different name or phone number' : 'Customers appear here once orders are created'}
              />
            : <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Customer</th>
                    <th>Orders</th>
                    <th>Total Value</th>
                    <th>Remaining</th>
                    <th>Nearest Delivery</th>
                    <th>Last Order</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.key} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={c.name} size={32} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{c.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'DM Serif Display', fontSize: 15 }}>{c.orders.length}</span>
                          {c.inProgress > 0 && (
                            <span className="badge badge-amber" style={{ marginLeft: 6 }}>{c.inProgress} active</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'DM Serif Display', fontSize: 15 }}>{formatCurrency(c.totalSpent)}</td>
                        <td>
                          <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: c.totalRemaining > 0 ? 'var(--accent)' : 'var(--green)' }}>
                            {formatCurrency(c.totalRemaining)}
                          </span>
                        </td>
                        <td><DeliveryChip dateStr={c.nearestDelivery} /></td>
                        <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(c.lastOrderDate)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-accent btn-sm"
                            onClick={() => onNewOrderForCustomer(c)}
                          >
                            <Plus size={13} /> Order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
