import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShoppingBag, Users, Truck, ArrowRight } from 'lucide-react';
import { ordersDB, kaligadhsDB, dealersDB, activityDB } from '../db';
import { formatCurrency, formatDate } from '../utils';

const SUB_TYPE_LABELS = {
  advance: 'Advance',
  balance: 'Balance',
  makingCost: 'Making Cost',
  dealerPaid: 'Dealer Paid',
  dealerBalance: 'Dealer Balance',
  kaligadhPayment: 'Kaligadh Due',
};

export default function Dashboard({ onNavigate, onNavigateOrder }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [orders, kaligadhs, dealers, activity] = await Promise.all([
      ordersDB.getAll(),
      kaligadhsDB.getAll(),
      dealersDB.getAll(),
      activityDB.getAll(),
    ]);

    const revenue = activity.filter(e => e.type === 'revenue').reduce((s, e) => s + e.amount, 0);
    const expense = activity.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const net = revenue - expense;

    const pending = orders.filter(o => o.status === 'inProgress');
    const pendingReceivables = pending.reduce((s, o) => s + (o.remainingAmount || 0), 0);
    const kaligadhDues = kaligadhs.reduce((s, k) => s + (k.totalDue || 0), 0);
    const dealerDues = dealers.filter(d => d.status === 'remaining').reduce((s, d) => s + (d.remainingAmount || 0), 0);

    const recentActivity = [...activity].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

    setData({ revenue, expense, net, orders, pending, pendingReceivables, kaligadhDues, dealerDues, kaligadhs, dealers, recentActivity });
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>;

  const { revenue, expense, net, orders, pending, pendingReceivables, kaligadhDues, dealerDues, kaligadhs, dealers, recentActivity } = data;

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Business summary and financial overview</p>
      </div>
      <div className="page-body">

        {/* Primary Financial Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--green)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value" style={{ color: 'var(--green)', fontSize: 28 }}>{formatCurrency(revenue)}</div>
            <div className="stat-sub">All customer payments received</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--red)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value" style={{ color: 'var(--red)', fontSize: 28 }}>{formatCurrency(expense)}</div>
            <div className="stat-sub">Kaligadh + Dealer payments</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: net >= 0 ? 'var(--green)' : 'var(--red)', borderLeftWidth: 4, background: net >= 0 ? 'var(--green-light)' : 'var(--red-light)' }}>
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 28 }}>{formatCurrency(Math.abs(net))}</div>
            <div className="stat-sub">{net >= 0 ? '▲ In profit' : '▼ Running at loss'}</div>
          </div>
        </div>

        {/* Pending / Dues Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('orders')}>
            <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Pending Receivables <ArrowRight size={12} />
            </div>
            <div className="stat-value" style={{ color: 'var(--amber)', fontSize: 22 }}>{formatCurrency(pendingReceivables)}</div>
            <div className="stat-sub">{pending.length} orders in progress</div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('kaligadh')}>
            <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Kaligadh Dues <ArrowRight size={12} />
            </div>
            <div className="stat-value" style={{ color: kaligadhDues > 0 ? 'var(--accent)' : 'var(--ink-3)', fontSize: 22 }}>{formatCurrency(kaligadhDues)}</div>
            <div className="stat-sub">{kaligadhs.filter(k => k.totalDue > 0).length} workers with pending due</div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('dealers')}>
            <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Dealer Dues <ArrowRight size={12} />
            </div>
            <div className="stat-value" style={{ color: dealerDues > 0 ? 'var(--accent)' : 'var(--ink-3)', fontSize: 22 }}>{formatCurrency(dealerDues)}</div>
            <div className="stat-sub">{dealers.filter(d => d.status === 'remaining').length} pending payments</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Orders Summary */}
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 17 }}>Orders</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('orders')}>View all <ArrowRight size={12} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'In Progress', value: orders.filter(o => o.status === 'inProgress').length, color: 'var(--amber)' },
                { label: 'Completed', value: orders.filter(o => o.status === 'completed').length, color: 'var(--green)' },
                { label: 'Total Orders', value: orders.length, color: 'var(--ink)' },
                { label: 'Total Pieces', value: orders.reduce((s, o) => s + (o.items?.length || 0), 0), color: 'var(--blue)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--paper-3)' }}>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 17 }}>Recent Activity</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('activity')}>View all <ArrowRight size={12} /></button>
            </div>
            {recentActivity.length === 0
              ? <div style={{ padding: '30px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No activity yet</div>
              : recentActivity.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => entry.referenceType === 'order' && onNavigateOrder(entry.referenceId)}
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid var(--paper-2)', cursor: entry.referenceType === 'order' ? 'pointer' : 'default', gap: 10 }}
                    onMouseEnter={e => { if (entry.referenceType === 'order') e.currentTarget.style.background = 'var(--paper)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: entry.type === 'revenue' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>
                      {entry.description}
                      {entry.referenceType === 'order' && <span style={{ marginLeft: 6, fontFamily: 'DM Serif Display', color: 'var(--accent)', fontSize: 12 }}>{entry.referenceId}</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: entry.type === 'revenue' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                      {entry.type === 'revenue' ? '+' : '−'} Rs. {entry.amount.toLocaleString()}
                    </div>
                  </div>
                ))
            }
          </div>

          {/* Kaligadh Summary */}
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 17 }}>Top Kaligadh by Due</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('kaligadh')}>View all <ArrowRight size={12} /></button>
            </div>
            {kaligadhs.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No workers added yet</div>
              : kaligadhs.filter(k => k.totalDue > 0).slice(0, 4).map(k => (
                  <div key={k.id} className="flex items-center justify-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{k.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{k.specialties?.join(', ')}</div>
                    </div>
                    <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)' }}>{formatCurrency(k.totalDue)}</span>
                  </div>
                ))
            }
            {kaligadhs.every(k => !k.totalDue) && kaligadhs.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--green)' }}>✓ All dues cleared</div>
            )}
          </div>

          {/* Dealer Summary */}
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 17 }}>Pending Dealer Payments</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('dealers')}>View all <ArrowRight size={12} /></button>
            </div>
            {dealers.filter(d => d.status === 'remaining').length === 0
              ? <div style={{ fontSize: 13, color: 'var(--green)' }}>✓ No pending payments</div>
              : dealers.filter(d => d.status === 'remaining').slice(0, 4).map(d => (
                  <div key={d.id} className="flex items-center justify-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{d.dealerName}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDate(d.createdAt)}</div>
                    </div>
                    <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)' }}>{formatCurrency(d.remainingAmount)}</span>
                  </div>
                ))
            }
          </div>

        </div>
      </div>
    </div>
  );
}
