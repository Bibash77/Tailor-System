import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { activityDB, expensesDB, settingsDB } from '../db';
import {
  formatCurrency, formatDate,
  monthKey, monthLabel, prevMonthKey, nextMonthKey, entryMonthKey,
} from '../utils';
import { EmptyState, PageHelp, TableSkeleton } from '../components/UI';

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────

function buildPrintHTML({ businessName, month, entries, totalDebit, totalCredit, net }) {
  const rows = entries.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td>${escHtml(e.description)}</td>
      <td class="num debit">${e.debit > 0 ? 'Rs. ' + e.debit.toLocaleString('en-NP') : ''}</td>
      <td class="num credit">${e.credit > 0 ? 'Rs. ' + e.credit.toLocaleString('en-NP') : ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Financial Report — ${monthLabel(month)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; }
    .header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #333; padding-bottom: 16px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.05em; }
    .header h2 { font-size: 14px; font-weight: 400; margin-top: 4px; color: #555; }
    .header .period { margin-top: 8px; font-size: 13px; font-weight: 600; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    th { background: #1a1a1a; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; }
    th.num { text-align: right; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 12px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    td.num { text-align: right; font-family: 'Courier New', monospace; }
    td.debit { color: #dc2626; }
    td.credit { color: #15803d; }
    .summary { margin-top: 0; border-top: 2px solid #1a1a1a; }
    .summary td { font-weight: 700; font-size: 13px; padding: 10px 10px; }
    .net-row td { font-size: 14px; background: ${net >= 0 ? '#f0fdf4' : '#fef2f2'}; color: ${net >= 0 ? '#15803d' : '#dc2626'}; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
    @media print {
      body { padding: 16px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(businessName || 'Tailor Manager')}</h1>
    <h2>Financial Report</h2>
    <div class="period">${monthLabel(month)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:100px">Date</th>
        <th>Description</th>
        <th class="num" style="width:140px">Debit (Out)</th>
        <th class="num" style="width:140px">Credit (In)</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999">No entries for this month</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="summary">
        <td colspan="2" style="text-align:right;color:#555;text-transform:uppercase;letter-spacing:0.05em;font-size:11px">Total</td>
        <td class="num debit">Rs. ${totalDebit.toLocaleString('en-NP')}</td>
        <td class="num credit">Rs. ${totalCredit.toLocaleString('en-NP')}</td>
      </tr>
      <tr class="net-row">
        <td colspan="2" style="text-align:right;text-transform:uppercase;letter-spacing:0.05em;font-size:11px">
          Net ${net >= 0 ? 'Profit' : 'Loss'}
        </td>
        <td colspan="2" class="num">Rs. ${Math.abs(net).toLocaleString('en-NP')}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Generated on ${new Date().toLocaleDateString('en-NP', { day: '2-digit', month: 'long', year: 'numeric' })}</div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const ACT_SUBTYPE_LABELS = {
  advance:          'Advance Received',
  balance:          'Balance Received',
  makingCost:       'Making Cost',
  dealerPaid:       'Dealer Purchase Paid',
  dealerBalance:    'Dealer Balance Paid',
  kaligadhPayment:  'Kaligadh Payment',
  salaryPayment:    'Salary Paid',
  salaryAdvance:    'Salary Advance Given',
};

export default function Finance({ onNavigate }) {
  const [month, setMonth]     = useState(monthKey());
  const [activity, setActivity] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bizName, setBizName] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // 'all' | 'credit' | 'debit'

  useEffect(() => { load(); }, []);

  async function load() {
    const [act, exps, name] = await Promise.all([
      activityDB.getAll(),
      expensesDB.getAll(),
      settingsDB.get('businessName'),
    ]);
    setActivity(act);
    setExpenses(exps);
    setBizName(name || '');
    setLoading(false);
  }

  // ── Build unified ledger for the selected month ──
  const { entries, totalDebit, totalCredit, net } = useMemo(() => {
    const actMonth = activity.filter(e => entryMonthKey(e.date) === month);
    const expMonth = expenses.filter(e => entryMonthKey(e.date) === month);

    const rows = [];

    // Activity entries
    actMonth.forEach(e => {
      rows.push({
        id:          e.id,
        date:        e.date,
        description: e.description || ACT_SUBTYPE_LABELS[e.subType] || e.subType || '—',
        subLabel:    ACT_SUBTYPE_LABELS[e.subType] || '',
        debit:       e.type === 'expense' ? (e.amount || 0) : 0,
        credit:      e.type === 'revenue' ? (e.amount || 0) : 0,
        source:      'activity',
      });
    });

    // Misc expenses (not already in activity)
    expMonth.forEach(e => {
      rows.push({
        id:          e.id,
        date:        e.date,
        description: e.note ? `${e.category} — ${e.note}` : e.category,
        subLabel:    'Misc Expense',
        debit:       e.amount || 0,
        credit:      0,
        source:      'expense',
      });
    });

    rows.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    const net = totalCredit - totalDebit;

    return { entries: rows, totalDebit, totalCredit, net };
  }, [activity, expenses, month]);

  const filtered = filter === 'all' ? entries
    : filter === 'credit' ? entries.filter(e => e.credit > 0)
    : entries.filter(e => e.debit > 0);

  const isCurrent = month === monthKey();

  function handleExport() {
    const html = buildPrintHTML({ businessName: bizName, month, entries, totalDebit, totalCredit, net });
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Finance</h2>
          <p>Monthly accounting ledger — debits, credits, and net balance</p>
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(prevMonthKey(month))}>
            <ChevronLeft size={15} />
          </button>
          <div style={{
            padding: '7px 20px',
            background: isCurrent ? 'var(--ink)' : 'white',
            color: isCurrent ? 'white' : 'var(--ink)',
            border: '1.5px solid var(--paper-3)', borderRadius: 8,
            fontWeight: 700, fontSize: 14, minWidth: 170, textAlign: 'center',
          }}>
            {monthLabel(month)}
            {isCurrent && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>current</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(nextMonthKey(month))}>
            <ChevronRight size={15} />
          </button>
          {!isCurrent && (
            <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthKey())}>Today</button>
          )}

          <button className="btn btn-primary btn-sm" onClick={handleExport} style={{ marginLeft: 8 }}>
            <Download size={13} /> Export PDF
          </button>
        </div>
      </div>

      <div className="page-body">
        <PageHelp id="finance" title="How Finance Works" items={[
          'This is a month-by-month double-entry ledger showing all income (credit) and expenses (debit).',
          'Credit = money received: order advances + balance payments on completion.',
          'Debit = money paid out: salary, dealer payments, and manual expenses.',
          'Net = Credit − Debit for the selected month. Positive = profit, Negative = loss.',
          'All entries here are auto-generated from actions in Orders, Salary, Dealers, and Expenses pages.',
          'Use the Print/Export button to download a PDF report for any month.',
        ]} />

        {/* ── Summary Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
            <div className="stat-label">Total Credit (Income)</div>
            <div className="stat-value" style={{ color: 'var(--green)', fontSize: 26 }}>{formatCurrency(totalCredit)}</div>
            <div className="stat-sub">{entries.filter(e => e.credit > 0).length} income entries</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
            <div className="stat-label">Total Debit (Expenses)</div>
            <div className="stat-value" style={{ color: 'var(--red)', fontSize: 26 }}>{formatCurrency(totalDebit)}</div>
            <div className="stat-sub">{entries.filter(e => e.debit > 0).length} expense entries</div>
          </div>
          <div className="stat-card" style={{
            borderLeft: `4px solid ${net >= 0 ? 'var(--green)' : 'var(--red)'}`,
            background: net >= 0 ? 'var(--green-light)' : 'var(--red-light)',
          }}>
            <div className="stat-label">Net Balance</div>
            <div className="stat-value" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 26 }}>
              {formatCurrency(Math.abs(net))}
            </div>
            <div className="stat-sub">{net >= 0 ? '▲ Profit' : '▼ Loss'} this month</div>
          </div>
        </div>

        {/* ── Ledger Table ── */}
        <div className="card">
          {/* Toolbar */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--paper-2)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div className="flex gap-2">
              {[
                { key: 'all',    label: 'All Entries' },
                { key: 'credit', label: '+ Credit (Income)' },
                { key: 'debit',  label: '− Debit (Expenses)' },
              ].map(f => (
                <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<span style={{ fontSize: 32 }}>📒</span>}
              title="No entries this month"
              message="Financial activity will appear here as you record orders, payments and expenses"
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Date</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right', width: 150 }}>Debit (Out)</th>
                      <th style={{ textAlign: 'right', width: 150 }}>Credit (In)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                          {formatDate(e.date)}
                        </td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{e.description}</div>
                          {e.subLabel && (
                            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{e.subLabel}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display', fontSize: 15,
                          color: e.debit > 0 ? 'var(--red)' : 'var(--ink-4)' }}>
                          {e.debit > 0 ? `− ${formatCurrency(e.debit)}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display', fontSize: 15,
                          color: e.credit > 0 ? 'var(--green)' : 'var(--ink-4)' }}>
                          {e.credit > 0 ? `+ ${formatCurrency(e.credit)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Summary */}
              <div style={{
                padding: '14px 18px',
                borderTop: '2px solid var(--paper-3)',
                background: 'var(--paper-2)',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 20,
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
                  {entries.length} total entries · {monthLabel(month)}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                    Total Debit
                  </div>
                  <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--red)' }}>
                    − {formatCurrency(totalDebit)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', paddingLeft: 20, borderLeft: '1px solid var(--paper-3)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                    Total Credit
                  </div>
                  <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--green)' }}>
                    + {formatCurrency(totalCredit)}
                  </div>
                </div>
              </div>

              {/* Net Balance Bar */}
              <div style={{
                padding: '14px 18px',
                borderTop: '1px solid var(--paper-3)',
                background: net >= 0 ? 'var(--green-light)' : 'var(--red-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  Net {net >= 0 ? 'Profit' : 'Loss'} — {monthLabel(month)}
                </div>
                <div style={{
                  fontFamily: 'DM Serif Display', fontSize: 24,
                  color: net >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {net >= 0 ? '+' : '−'} {formatCurrency(Math.abs(net))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
