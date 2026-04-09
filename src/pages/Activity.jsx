import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { activityDB, ordersDB, dealersDB } from '../db';
import { formatCurrency, formatDate } from '../utils';

const SUB_TYPE_LABELS = {
  advance: 'Advance Received',
  balance: 'Balance Received',
  makingCost: 'Making Cost',
  dealerPaid: 'Dealer Purchase Paid',
  dealerBalance: 'Dealer Balance Paid',
  kaligadhPayment: 'Kaligadh Due Cleared',
};

export default function Activity({ onNavigateOrder }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const all = await activityDB.getAll();
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    setEntries(all);
    setLoading(false);
  }

  function handleClick(entry) {
    if (entry.referenceType === 'order' && onNavigateOrder) {
      onNavigateOrder(entry.referenceId);
    }
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);

  const totalRevenue = entries.filter(e => e.type === 'revenue').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const net = totalRevenue - totalExpense;

  return (
    <div>
      <div className="page-header">
        <h2>Activity</h2>
        <p>Bookkeeping ledger of all financial events</p>
      </div>
      <div className="page-body">

        {/* Summary */}
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 24 }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--green)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--red)', borderLeftWidth: 3 }}>
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{formatCurrency(totalExpense)}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: net >= 0 ? 'var(--green)' : 'var(--red)', borderLeftWidth: 3 }}>
            <div className="stat-label">Net</div>
            <div className="stat-value" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(Math.abs(net))}</div>
            <div className="stat-sub">{net >= 0 ? '▲ Profit' : '▼ Loss'}</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['all', 'revenue', 'expense'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All Entries' : f === 'revenue' ? '+ Revenue' : '− Expenses'}
            </button>
          ))}
        </div>

        <div className="card">
          {loading
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>
            : filtered.length === 0
            ? <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📒</div>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 17, color: 'var(--ink-2)' }}>No entries yet</div>
                <div style={{ fontSize: 13 }}>Activity will appear here as you create orders and assign workers</div>
              </div>
            : <>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px 80px', gap: 12, padding: '10px 16px', borderBottom: '2px solid var(--paper-3)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  <div></div>
                  <div>Description</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                  <div style={{ textAlign: 'right' }}>Date</div>
                </div>
                {filtered.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => handleClick(entry)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr 100px 80px',
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--paper-2)',
                      cursor: entry.referenceType === 'order' ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    {/* Dot */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: entry.type === 'revenue' ? 'var(--green)' : 'var(--red)',
                        flexShrink: 0
                      }} />
                    </div>

                    {/* Description */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                        {entry.description}
                        {entry.referenceType === 'order' && (
                          <span style={{ marginLeft: 8, fontFamily: 'DM Serif Display', color: 'var(--accent)', fontSize: 13 }}>
                            {entry.referenceId}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                        {SUB_TYPE_LABELS[entry.subType] || entry.subType}
                        {entry.referenceType === 'order' && <span style={{ marginLeft: 4, color: 'var(--blue)' }}>· tap to view order</span>}
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right', fontFamily: 'DM Serif Display', fontSize: 16, fontWeight: 700, color: entry.type === 'revenue' ? 'var(--green)' : 'var(--red)' }}>
                      {entry.type === 'revenue' ? '+' : '−'} Rs. {entry.amount.toLocaleString()}
                    </div>

                    {/* Date */}
                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-4)' }}>
                      {formatDate(entry.date)}
                    </div>
                  </div>
                ))}
              </>
          }
        </div>
      </div>
    </div>
  );
}
