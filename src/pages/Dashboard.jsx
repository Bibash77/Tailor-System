import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ordersDB, dealersDB, activityDB, expensesDB } from '../db';
import { formatCurrency, formatDate, monthKey, monthLabel, prevMonthKey, nextMonthKey, entryMonthKey } from '../utils';
import { PageHelp } from '../components/UI';

// ─── SPARKLINE ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#15803D', width = 150, height = 38 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pad = 3;
  const iH = height - pad * 2;

  const pts = data.map((v, i) => {
    const x = ((i / (data.length - 1)) * width).toFixed(1);
    const y = (pad + iH - (v / max) * iH).toFixed(1);
    return `${x},${y}`;
  });

  const hasActivity = data.some(v => v > 0);
  if (!hasActivity) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke={color} strokeWidth={1.5} opacity={0.25} strokeDasharray="4,4" />
      </svg>
    );
  }

  const polyline = pts.join(' ');
  const area = `0,${height} ${polyline} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={polyline} fill="none" stroke={color}
        strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getDailyData(entries, month) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const now = new Date();
  const isThisMonth = y === now.getFullYear() && m === now.getMonth() + 1;
  const days = isThisMonth ? now.getDate() : daysInMonth;
  const buckets = new Array(days).fill(0);
  for (const e of entries) {
    const d = new Date(e.date || e.createdAt || 0);
    if (d.getFullYear() === y && d.getMonth() + 1 === m) {
      const idx = d.getDate() - 1;
      if (idx >= 0 && idx < days) buckets[idx] += Number(e.amount) || 0;
    }
  }
  return buckets;
}

function trendIcon(data) {
  const nonZero = data.filter(v => v > 0);
  if (nonZero.length < 2) return null;
  const first = nonZero[0], last = nonZero[nonZero.length - 1];
  if (last > first * 1.05) return <TrendingUp size={13} style={{ color: 'var(--green)' }} />;
  if (last < first * 0.95) return <TrendingDown size={13} style={{ color: 'var(--red)' }} />;
  return <Minus size={13} style={{ color: 'var(--ink-4)' }} />;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── CASH BOOK PDF ────────────────────────────────────────────────────────────

function printCashBook({ month, incomeEntries, expenseEntries, businessName }) {
  // Merge and sort by date ascending
  const all = [
    ...incomeEntries.map(e => ({ date: e.date, description: e.description, income: e.amount, expense: 0, billNo: e.billNo || '—' })),
    ...expenseEntries.map(e => ({ date: e.date, description: e.description, income: 0, expense: e.amount, billNo: '—' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  let balance = 0;
  const totalIncome  = all.reduce((s, e) => s + e.income,  0);
  const totalExpense = all.reduce((s, e) => s + e.expense, 0);
  const netBalance   = totalIncome - totalExpense;

  const fc = n => n > 0 ? `Rs.&nbsp;${Number(n).toLocaleString('en-NP')}` : '';

  const rows = all.map(e => {
    balance += e.income - e.expense;
    const balColor = balance >= 0 ? '#15803d' : '#dc2626';
    return `<tr>
      <td>${formatDate(e.date)}</td>
      <td>${escHtml(e.description)}</td>
      <td class="num g">${fc(e.income)}</td>
      <td class="num r">${fc(e.expense)}</td>
      <td class="num" style="color:${balColor};font-weight:700">Rs.&nbsp;${Math.abs(balance).toLocaleString('en-NP')}${balance < 0 ? ' (-)' : ''}</td>
      <td class="bn">${escHtml(e.billNo)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Cash Book — ${monthLabel(month)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px 32px;max-width:900px}
  .hdr{text-align:center;margin-bottom:22px;border-bottom:2px solid #111;padding-bottom:14px}
  .hdr h1{font-size:20px;font-weight:700}
  .hdr h2{font-size:13px;font-weight:400;color:#555;margin-top:4px}
  .hdr .mn{font-size:14px;font-weight:700;margin-top:6px}
  table{width:100%;border-collapse:collapse}
  th{background:#1a1a1a;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
  th.num,td.num{text-align:right}
  td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
  tr:nth-child(even) td{background:#f9f9f9}
  .g{color:#15803d;font-weight:600}.r{color:#dc2626;font-weight:600}
  .bn{color:#777;font-size:11px}
  tfoot td{font-weight:700;font-size:13px;border-top:2px solid #111;background:#f5f5f5;padding:10px}
  .net{font-size:16px;background:${netBalance>=0?'#f0fdf4':'#fef2f2'};color:${netBalance>=0?'#15803d':'#dc2626'}}
  .footer{margin-top:24px;font-size:10px;color:#aaa;text-align:center}
  @media print{body{padding:14px 18px}button{display:none}}
</style></head><body>
<div class="hdr">
  <h1>${escHtml(businessName || 'Tailor Manager')}</h1>
  <h2>Monthly Cash Book</h2>
  <div class="mn">${monthLabel(month)}</div>
</div>
<table>
<thead><tr>
  <th style="width:90px">Date</th>
  <th>Description</th>
  <th class="num" style="width:130px">Income (Dr)</th>
  <th class="num" style="width:130px">Expense (Cr)</th>
  <th class="num" style="width:130px">Balance</th>
  <th style="width:110px">Bill No</th>
</tr></thead>
<tbody>
${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999">No entries for this month</td></tr>'}
</tbody>
<tfoot>
  <tr>
    <td colspan="2" style="text-align:right;color:#555;text-transform:uppercase;font-size:11px;letter-spacing:.05em">Total</td>
    <td class="num g">Rs.&nbsp;${totalIncome.toLocaleString('en-NP')}</td>
    <td class="num r">Rs.&nbsp;${totalExpense.toLocaleString('en-NP')}</td>
    <td colspan="2"></td>
  </tr>
  <tr class="net">
    <td colspan="4" style="text-align:right;text-transform:uppercase;font-size:12px;letter-spacing:.05em">
      Net ${netBalance >= 0 ? 'Profit' : 'Loss'}
    </td>
    <td class="num" colspan="2">Rs.&nbsp;${Math.abs(netBalance).toLocaleString('en-NP')}</td>
  </tr>
</tfoot>
</table>
<div class="footer">Generated ${formatDate(new Date().toISOString())} · Tailor Manager</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── SECTION PANEL ────────────────────────────────────────────────────────────

function SectionPanel({ title, total, count, countLabel, accentColor, borderColor, sparkData, sparkColor, onViewAll, children, emptyMsg }) {
  const daily = sparkData || [];
  const trend = trendIcon(daily);

  return (
    <div className="card" style={{ marginBottom: 18, borderLeft: `4px solid ${borderColor || accentColor}`, overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--paper-3)',
        background: 'var(--paper-2)',
      }}>
        {/* Left: title + total + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 2 }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'DM Serif Display', fontSize: 26, color: accentColor, lineHeight: 1 }}>
                {formatCurrency(total)}
              </span>
              {trend && <span style={{ display: 'flex', alignItems: 'center' }}>{trend}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
              {count} {countLabel}
            </div>
          </div>

          {/* Sparkline */}
          {daily.length > 1 && (
            <div style={{ opacity: 0.8 }}>
              <Sparkline data={daily} color={sparkColor || accentColor} width={150} height={38} />
            </div>
          )}
        </div>

        {/* Right: view all button */}
        {onViewAll && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onViewAll}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}
          >
            View All <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Table */}
      {children ? (
        <div className="table-wrap">
          {children}
        </div>
      ) : (
        <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {emptyMsg || 'No entries this month'}
        </div>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

const MAX_ROWS = 5;

export default function Dashboard({ onNavigate, onNavigateOrder }) {
  const [month, setMonth]     = useState(monthKey());
  const [orders, setOrders]   = useState([]);
  const [dealers, setDealers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bizName, setBizName] = useState('Tailor Manager');

  useEffect(() => { load(); }, []);

  async function load() {
    const [ords, ds, act, exps] = await Promise.all([
      ordersDB.getAll(),
      dealersDB.getAll(),
      activityDB.getAll(),
      expensesDB.getAll(),
    ]);
    setOrders(ords);
    setDealers(ds);
    setActivity(act);
    setExpenses(exps);
    setLoading(false);
  }

  // ── Build order reference map (for bill numbers on income entries)
  const orderMap = useMemo(() => {
    const m = {};
    orders.forEach(o => { m[o.id] = o; });
    return m;
  }, [orders]);

  // ── Month-filtered data
  const { incomeEntries, salaryEntries, miscExpEntries, allExpEntries } = useMemo(() => {
    const actMonth = activity.filter(e => entryMonthKey(e.date) === month);
    const expMonth = expenses.filter(e => entryMonthKey(e.date) === month);

    const income = actMonth
      .filter(e => e.type === 'revenue')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(e => ({
        ...e,
        billNo: orderMap[e.referenceId]?.billNo || '—',
      }));

    const salary = actMonth
      .filter(e => e.type === 'expense' && ['salaryPayment', 'salaryAdvance'].includes(e.subType))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const miscExp = expMonth
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(e => ({ ...e, description: e.category || 'Expense' }));

    const allExp = [
      ...actMonth.filter(e => e.type === 'expense').map(e => ({ ...e })),
      ...expMonth.map(e => ({ ...e, amount: e.amount, description: e.category || 'Expense' })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      incomeEntries: income,
      salaryEntries: salary,
      miscExpEntries: miscExp,
      allExpEntries: allExp,
    };
  }, [activity, expenses, month, orderMap]);

  // ── Financial totals
  const totals = useMemo(() => {
    const income   = incomeEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const salary   = salaryEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const miscExp  = miscExpEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const totalExp = salary + miscExp;
    const net      = income - totalExp;
    return { income, salary, miscExp, totalExp, net };
  }, [incomeEntries, salaryEntries, miscExpEntries]);

  // ── Pending (all-time, not month-filtered)
  const pending = useMemo(() => {
    const receivable = orders
      .filter(o => o.status === 'inProgress' && (o.remainingAmount || 0) > 0)
      .sort((a, b) => new Date(a.deliveryDate || 0) - new Date(b.deliveryDate || 0));
    const payable = dealers
      .filter(d => (d.remainingAmount || 0) > 0)
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
    const totalReceivable = receivable.reduce((s, o) => s + (o.remainingAmount || 0), 0);
    const totalPayable    = payable.reduce((s, d) => s + (d.remainingAmount || 0), 0);
    return { receivable, payable, totalReceivable, totalPayable };
  }, [orders, dealers]);

  // ── Sparkline daily data
  const incomeDaily  = useMemo(() => getDailyData(incomeEntries, month), [incomeEntries, month]);
  const salaryDaily  = useMemo(() => getDailyData(salaryEntries, month), [salaryEntries, month]);
  const miscExpDaily = useMemo(() => getDailyData(miscExpEntries, month), [miscExpEntries, month]);

  const isCurrent = month === monthKey();

  function handleExport() {
    printCashBook({
      month,
      incomeEntries: incomeEntries.map(e => ({ date: e.date, description: e.description, amount: e.amount, billNo: e.billNo })),
      expenseEntries: allExpEntries.map(e => ({ date: e.date, description: e.description, amount: e.amount })),
      businessName: bizName,
    });
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Dashboard</h2>
          <p>Monthly financial overview · {monthLabel(month)}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {/* Month navigator */}
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(prevMonthKey(month))}>
            <ChevronLeft size={15} />
          </button>
          <div style={{
            padding: '7px 18px',
            background: isCurrent ? 'var(--ink)' : 'white',
            color: isCurrent ? 'white' : 'var(--ink)',
            border: '1.5px solid var(--paper-3)', borderRadius: 8,
            fontWeight: 700, fontSize: 14, minWidth: 170, textAlign: 'center',
          }}>
            {monthLabel(month)}
            {isCurrent && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 5, opacity: 0.55 }}>current</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(nextMonthKey(month))}>
            <ChevronRight size={15} />
          </button>
          {!isCurrent && (
            <button className="btn btn-ghost btn-sm" onClick={() => setMonth(monthKey())}>Today</button>
          )}

          {/* Export */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExport}
            style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
          >
            <Download size={13} /> Cash Book PDF
          </button>
        </div>
      </div>

      <div className="page-body">
        <PageHelp id="dashboard" title="Dashboard Overview" items={[
          'This page shows a snapshot of your shop for the selected month — use the arrows to navigate months.',
          'Revenue = advance + balance payments collected from completed orders.',
          'Expenses = salary paid to workers + dealer payments + manual expenses.',
          'Profit = Revenue − Expenses for the selected month.',
          'Pending Orders shows orders that are In Progress and have remaining balance due.',
          'Navigate to any section using the left sidebar. All financial data flows automatically from your actions.',
        ]} />

        {/* ── QUICK SUMMARY BAR ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Income', value: totals.income, color: 'var(--green)', border: 'var(--green)', sub: `${incomeEntries.length} payments` },
            { label: 'Expenses', value: totals.totalExp, color: 'var(--red)', border: 'var(--red)', sub: `salary + misc` },
            { label: 'Net Balance', value: Math.abs(totals.net), color: totals.net >= 0 ? 'var(--green)' : 'var(--red)', border: totals.net >= 0 ? 'var(--green)' : 'var(--red)', sub: totals.net >= 0 ? 'Profit ▲' : 'Loss ▼', bg: totals.net >= 0 ? 'var(--green-light)' : 'var(--red-light)' },
            { label: 'Outstanding', value: pending.totalReceivable + pending.totalPayable, color: 'var(--amber)', border: 'var(--amber)', sub: `${pending.receivable.length} to collect · ${pending.payable.length} to pay` },
          ].map(({ label, value, color, border, sub, bg }) => (
            <div key={label} className="stat-card" style={{ borderLeftWidth: 3, borderLeftColor: border, background: bg }}>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color, fontSize: 24 }}>{formatCurrency(value)}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── INCOME SECTION ── */}
        <SectionPanel
          title="Income (Credit)"
          total={totals.income}
          count={incomeEntries.length}
          countLabel="payments received"
          accentColor="var(--green)"
          borderColor="#15803D"
          sparkData={incomeDaily}
          sparkColor="#15803D"
          onViewAll={() => onNavigate('orders')}
          emptyMsg="No income recorded this month"
        >
          {incomeEntries.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 130 }}>Bill No</th>
                </tr>
              </thead>
              <tbody>
                {incomeEntries.slice(0, MAX_ROWS).map(e => (
                  <tr
                    key={e.id}
                    onClick={() => e.referenceType === 'order' && onNavigateOrder(e.referenceId)}
                    style={{ cursor: e.referenceType === 'order' ? 'pointer' : 'default' }}
                  >
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(e.date)}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{e.description}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>
                        + {formatCurrency(e.amount)}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'monospace' }}>{e.billNo}</td>
                  </tr>
                ))}
              </tbody>
              {incomeEntries.length > MAX_ROWS && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '10px 14px', fontSize: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('orders')}>
                        +{incomeEntries.length - MAX_ROWS} more entries · View All <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </SectionPanel>

        {/* ── EXPENSES SECTION ── */}
        <SectionPanel
          title="Expenses (Debit)"
          total={totals.miscExp}
          count={miscExpEntries.length}
          countLabel="expense entries"
          accentColor="var(--red)"
          borderColor="#DC2626"
          sparkData={miscExpDaily}
          sparkColor="#DC2626"
          onViewAll={() => onNavigate('expenses')}
          emptyMsg="No expenses recorded this month"
        >
          {miscExpEntries.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Date</th>
                  <th>Category / Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 110 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {miscExpEntries.slice(0, MAX_ROWS).map(e => (
                  <tr key={e.id} onClick={() => onNavigate('expenses')}>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(e.date)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.category}</div>
                      {e.note && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{e.note}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--red)', fontWeight: 700 }}>
                        − {formatCurrency(e.amount)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${e.paymentStatus === 'paid' ? 'badge-green' : e.paymentStatus === 'pending' ? 'badge-amber' : 'badge-gray'}`}>
                        {e.paymentStatus === 'paid' ? 'Paid' : e.paymentStatus === 'pending' ? 'Pending' : e.paymentStatus || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {miscExpEntries.length > MAX_ROWS && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '10px 14px', fontSize: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('expenses')}>
                        +{miscExpEntries.length - MAX_ROWS} more · View All <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </SectionPanel>

        {/* ── SALARY SECTION ── */}
        <SectionPanel
          title="Salary Paid"
          total={totals.salary}
          count={salaryEntries.length}
          countLabel="transactions"
          accentColor="var(--amber)"
          borderColor="#D97706"
          sparkData={salaryDaily}
          sparkColor="#D97706"
          onViewAll={() => onNavigate('salary')}
          emptyMsg="No salary payments this month"
        >
          {salaryEntries.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Date</th>
                  <th>Worker</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 120 }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {salaryEntries.slice(0, MAX_ROWS).map(e => {
                  const isSalary = e.subType === 'salaryPayment';
                  const workerName = (e.description || '').replace(/^(Salary paid|Advance given)\s*[—-]\s*/i, '') || e.description;
                  return (
                    <tr key={e.id} onClick={() => onNavigate('salary')}>
                      <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(e.date)}</td>
                      <td style={{ fontWeight: 600 }}>{workerName}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--amber)', fontWeight: 700 }}>
                          − {formatCurrency(e.amount)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isSalary ? 'badge-amber' : 'badge-blue'}`}>
                          {isSalary ? 'Salary' : 'Advance'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {salaryEntries.length > MAX_ROWS && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '10px 14px', fontSize: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('salary')}>
                        +{salaryEntries.length - MAX_ROWS} more · View All <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </SectionPanel>

        {/* ── PENDING PAYMENTS (Receivable + Payable) ── */}
        <div className="card" style={{ marginBottom: 18, borderLeft: '4px solid var(--accent)', overflow: 'hidden' }}>
          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', background: 'var(--paper-2)',
            borderBottom: '1px solid var(--paper-3)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
              Pending Payments
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>To Collect</div>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--green)' }}>{formatCurrency(pending.totalReceivable)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>To Pay</div>
                <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--accent)' }}>{formatCurrency(pending.totalPayable)}</div>
              </div>
            </div>
          </div>

          {/* Two-column table layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

            {/* ── RECEIVABLE (from customers) ── */}
            <div style={{ borderRight: '1px solid var(--paper-3)' }}>
              <div style={{
                padding: '10px 16px', background: 'var(--green-light)',
                borderBottom: '1px solid var(--green-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                  To Collect · {pending.receivable.length} orders
                </span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onNavigate('orders')}>
                  Orders <ArrowRight size={10} />
                </button>
              </div>

              {pending.receivable.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>
                  ✓ All payments received
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th style={{ width: 100 }}>Bill No</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.receivable.slice(0, MAX_ROWS).map(o => {
                      const isOverdue = o.deliveryDate && new Date(o.deliveryDate) < new Date();
                      return (
                        <tr key={o.id} onClick={() => onNavigateOrder(o.id)}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customerName}</div>
                            {o.deliveryDate && (
                              <div style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--ink-4)' }}>
                                {isOverdue ? '⚠ ' : ''}Due {formatDate(o.deliveryDate)}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{o.billNo || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>
                              {formatCurrency(o.remainingAmount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {pending.receivable.length > MAX_ROWS && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '8px', fontSize: 12 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('orders')}>
                            +{pending.receivable.length - MAX_ROWS} more <ArrowRight size={10} />
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            {/* ── PAYABLE (to dealers) ── */}
            <div>
              <div style={{
                padding: '10px 16px', background: 'var(--accent-light)',
                borderBottom: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                  To Pay Dealers · {pending.payable.length}
                </span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onNavigate('dealers')}>
                  Dealers <ArrowRight size={10} />
                </button>
              </div>

              {pending.payable.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>
                  ✓ No pending dealer payments
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Dealer</th>
                      <th style={{ width: 100 }}>Bill No</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.payable.slice(0, MAX_ROWS).map(d => {
                      const isOverdue = d.dueDate && new Date(d.dueDate) < new Date();
                      return (
                        <tr key={d.id} onClick={() => onNavigate('dealers')}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{d.dealerName}</div>
                            {d.dueDate && (
                              <div style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--ink-4)' }}>
                                {isOverdue ? '⚠ Overdue · ' : 'Due '}
                                {formatDate(d.dueDate)}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{d.billNo || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>
                              {formatCurrency(d.remainingAmount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {pending.payable.length > MAX_ROWS && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '8px', fontSize: 12 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('dealers')}>
                            +{pending.payable.length - MAX_ROWS} more <ArrowRight size={10} />
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
