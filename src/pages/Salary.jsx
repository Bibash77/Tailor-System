import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CreditCard, Banknote,
  History, Printer, Check, Trash2, AlertCircle,
} from 'lucide-react';
import { kaligadhsDB, assignmentsDB, salaryPaymentsDB, activityDB } from '../db';
import {
  generateUUID, formatCurrency, formatDate,
  todayISO, monthKey, monthLabel, prevMonthKey, nextMonthKey,
} from '../utils';
import { Modal, Avatar, FormGroup, EmptyState, PageHelp } from '../components/UI';

const WORKERS_PER_PAGE = 8;
const HISTORY_PAGE_SIZE = 10;

// ─── CORE COMPUTATION ─────────────────────────────────────────────────────────

function assignmentMonth(a) {
  const d = new Date(a.completedAt ?? a.assignedAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function sumMaking(list) {
  return list.reduce((s, a) => s + (Number(a.makingCost) || 0), 0);
}

// Returns all data needed for one worker row.
// thisBalance / prevBalance can be negative (overpaid), which correctly offsets dues.
function computeWorkerData(assignments, payments, currentMonth) {
  // ── This month: assignments whose order was completed in currentMonth
  const done = assignments.filter(a => a.completedAt && assignmentMonth(a) === currentMonth);
  const thisEarned = sumMaking(done);
  const avgRate = done.length > 0 ? Math.round(thisEarned / done.length) : 0;
  const thisPaid = payments
    .filter(p => p.month === currentMonth && (p.type === 'payment' || p.type === 'recovery'))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const thisBalance = thisEarned - thisPaid; // may be negative (overpayment)

  // ── In progress: assignments not yet completed
  const wip = assignments.filter(a => !a.completedAt);
  const wipEarned = sumMaking(wip);

  // ── Previous months: all completed months before currentMonth
  const prevMks = [...new Set(
    assignments
      .filter(a => a.completedAt && assignmentMonth(a) < currentMonth)
      .map(assignmentMonth),
  )];
  let prevPieces = 0, prevEarned = 0, prevSettled = 0;
  for (const mk of prevMks) {
    const ma = assignments.filter(a => a.completedAt && assignmentMonth(a) === mk);
    const mp = payments.filter(p => p.month === mk && (p.type === 'payment' || p.type === 'recovery'));
    prevPieces += ma.length;
    prevEarned += sumMaking(ma);
    prevSettled += mp.reduce((s, p) => s + (p.amount || 0), 0);
  }
  const prevBalance = prevEarned - prevSettled; // may be negative
  const prevDue = Math.max(0, prevBalance);

  // ── Advance (global, not month-tied)
  const advGiven = payments.filter(p => p.type === 'advance').reduce((s, p) => s + (p.amount || 0), 0);
  const advRecov = payments.filter(p => p.type === 'recovery').reduce((s, p) => s + (p.amount || 0), 0);
  const advBalance = Math.max(0, advGiven - advRecov);

  // ── Net payable: overpayments in current month offset previous dues
  const totalPayable = Math.max(0, thisBalance + prevBalance - advBalance);

  // ── Total outstanding ignoring advance (for PayModal cap)
  const totalOutstanding = Math.max(0, thisBalance + prevBalance);

  return {
    done: done.length,
    thisEarned,
    avgRate,
    thisPaid,
    thisRemaining: Math.max(0, thisBalance),
    wip: wip.length,
    wipEarned,
    prevPieces,
    prevDue,
    advGiven,
    advRecov,
    advBalance,
    totalPayable,
    totalOutstanding,
  };
}

// ─── PDF / PRINT REPORT ───────────────────────────────────────────────────────

function printWorkerReport(worker, d, payments, month) {
  const ml = monthLabel(month);
  const thisMonthPmts = [...payments]
    .filter(p => p.month === month)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const fc = formatCurrency;
  const row = (label, val, cls = '') =>
    `<div class="pr"><span>${label}</span><span class="${cls}">${val}</span></div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${worker.name} — Salary ${ml}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:28px 32px;max-width:740px}
  h1{font-size:22px;font-weight:700;margin-bottom:2px}
  .sub{color:#666;font-size:12px;margin-bottom:22px}
  h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#555;
     border-bottom:1.5px solid #ddd;padding-bottom:4px;margin:20px 0 10px}
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  th{text-align:left;font-size:11px;text-transform:uppercase;color:#888;padding:7px 8px;background:#f5f5f5}
  td{padding:8px;border-bottom:1px solid #eee}
  .r{text-align:right}.g{color:#16a34a;font-weight:700}.red{color:#dc2626;font-weight:700}
  .am{color:#d97706;font-weight:700}.bold{font-weight:700}
  .box{border:2px solid #111;border-radius:6px;padding:16px 20px;margin-top:22px}
  .pr{display:flex;justify-content:space-between;padding:5px 0;font-size:14px;border-bottom:1px solid #f0f0f0}
  .pr:last-child{border:none}
  .pr.final{font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:6px;padding-top:10px}
  .footer{margin-top:30px;font-size:11px;color:#aaa}
  @media print{body{padding:14px 18px}}
</style></head><body>
<h1>${worker.name}</h1>
<div class="sub">Salary Report &middot; ${ml}</div>

<h2>Earned This Month</h2>
<table>
  <tr><th>Pieces Done</th><th>Avg Rate / Piece</th><th class="r">Total Earned</th><th class="r">Already Paid</th><th class="r">Remaining</th></tr>
  <tr>
    <td class="bold">${d.done}</td>
    <td>${d.avgRate > 0 ? fc(d.avgRate) : '—'}</td>
    <td class="r g">${fc(d.thisEarned)}</td>
    <td class="r">${fc(d.thisPaid)}</td>
    <td class="r ${d.thisRemaining > 0 ? 'red' : 'g'}">${fc(d.thisRemaining)}</td>
  </tr>
</table>

${d.wip > 0 ? `<h2>Work In Progress (Pending Orders)</h2>
<table>
  <tr><th>Pieces Being Worked</th><th class="r">Expected Amount</th></tr>
  <tr><td class="bold">${d.wip} pieces</td><td class="r">${fc(d.wipEarned)}</td></tr>
</table>` : ''}

${d.prevDue > 0 ? `<h2>Previous Month Due</h2>
<table>
  <tr><th>Previous Pieces</th><th class="r">Amount Unpaid</th></tr>
  <tr><td>${d.prevPieces} pieces from earlier months</td><td class="r red">${fc(d.prevDue)}</td></tr>
</table>` : ''}

${d.advGiven > 0 ? `<h2>Advance Details</h2>
<table>
  <tr><th>Total Given</th><th>Recovered</th><th class="r">Balance Remaining</th></tr>
  <tr><td>${fc(d.advGiven)}</td><td>${fc(d.advRecov)}</td><td class="r am">${fc(d.advBalance)}</td></tr>
</table>` : ''}

${thisMonthPmts.length > 0 ? `<h2>Payments This Month</h2>
<table>
  <tr><th>Date</th><th>Type</th><th class="r">Amount</th><th>Note</th></tr>
  ${thisMonthPmts.map(p => `<tr>
    <td>${formatDate(p.date)}</td>
    <td>${p.type === 'payment' ? 'Cash Paid' : p.type === 'advance' ? 'Advance Given' : 'Advance Recovery'}</td>
    <td class="r">${fc(p.amount)}</td>
    <td>${p.note || '—'}</td>
  </tr>`).join('')}
</table>` : ''}

<div class="box">
  ${row('Earned This Month', `+ ${fc(d.thisEarned)}`, 'g')}
  ${d.prevDue > 0 ? row('Previous Month Due', `+ ${fc(d.prevDue)}`, 'red') : ''}
  ${d.advBalance > 0 ? row('Advance Balance', `&minus; ${fc(d.advBalance)}`, 'am') : ''}
  ${d.thisPaid > 0 ? row('Already Paid This Month', `&minus; ${fc(d.thisPaid)}`) : ''}
  <div class="pr final">
    <span>TOTAL TO PAY</span>
    <span class="${d.totalPayable > 0 ? 'red' : 'g'}">${fc(d.totalPayable)}</span>
  </div>
</div>

<div class="footer">Printed on ${formatDate(new Date().toISOString())} &middot; Tailor Management App</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── PAY MODAL ────────────────────────────────────────────────────────────────

function PayModal({ worker, data, month, onClose, onSaved }) {
  const { thisEarned, thisRemaining, prevDue, advBalance, totalPayable, totalOutstanding } = data;

  const maxRecovery = Math.min(advBalance, totalOutstanding);
  const defaultCash = Math.max(0, totalPayable - maxRecovery);

  const [recovery, setRecovery] = useState(maxRecovery);
  const [cash, setCash]         = useState(defaultCash);
  const [date, setDate]         = useState(todayISO());
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  const totalSettling = (Number(cash) || 0) + (Number(recovery) || 0);
  const overLimit     = totalSettling > totalOutstanding + 0.01;
  const overRecovery  = (Number(recovery) || 0) > advBalance + 0.01;
  const isValid       = totalSettling > 0 && !overLimit && !overRecovery;

  function applyPreset(fraction) {
    const target = Math.round(totalPayable * fraction);
    const rec = Math.min(maxRecovery, target);
    setRecovery(rec);
    setCash(Math.max(0, target - rec));
  }

  async function handlePay() {
    if (!isValid) return;
    setSaving(true);
    const isoDate = new Date(date).toISOString();
    const cashAmt = Number(cash) || 0;
    const recAmt  = Number(recovery) || 0;

    if (cashAmt > 0) {
      await salaryPaymentsDB.save({
        id: generateUUID(), kaligadhId: worker.id, month,
        type: 'payment', amount: cashAmt, date: isoDate,
        note: note.trim(), createdAt: new Date().toISOString(),
      });
      await activityDB.save({
        id: generateUUID(), type: 'expense', subType: 'salaryPayment',
        amount: cashAmt,
        description: `Salary paid — ${worker.name} (${monthLabel(month)})`,
        referenceId: worker.id, referenceType: 'kaligadh', date: isoDate,
      });
    }
    if (recAmt > 0) {
      await salaryPaymentsDB.save({
        id: generateUUID(), kaligadhId: worker.id, month,
        type: 'recovery', amount: recAmt, date: isoDate,
        note: 'Advance recovery', createdAt: new Date().toISOString(),
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={`Pay Salary — ${worker.name}`}
      onClose={onClose}
      size="modal-sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-green" disabled={saving || !isValid} onClick={handlePay}>
          <Check size={14} /> {saving ? 'Saving…' : 'Confirm Payment'}
        </button>
      </>}
    >
      {/* Summary boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'This Month Earned', value: thisEarned, color: 'var(--green)' },
          ...(prevDue > 0 ? [{ label: 'Previous Due', value: prevDue, color: 'var(--red)' }] : []),
          ...(advBalance > 0 ? [{ label: 'Advance Balance', value: advBalance, color: 'var(--amber)' }] : []),
          { label: 'Net To Pay', value: totalPayable, color: 'var(--accent)', large: true },
        ].map(({ label, value, color, large }) => (
          <div key={label} style={{ background: 'var(--paper-2)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: large ? 24 : 18, color, lineHeight: 1 }}>
              {formatCurrency(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => applyPreset(1)}>Full Amount</button>
        <button className="btn btn-ghost btn-sm" onClick={() => applyPreset(0.5)}>Half</button>
        {advBalance > 0 && maxRecovery > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setRecovery(maxRecovery); setCash(0); }}>
            Recovery Only
          </button>
        )}
      </div>

      {advBalance > 0 && (
        <FormGroup
          label={`Advance Recovery (max ${formatCurrency(maxRecovery)})`}
          hint="Deducted from worker's advance balance"
        >
          <input
            className="form-input"
            type="number"
            placeholder="0"
            value={recovery}
            min={0}
            max={maxRecovery}
            onChange={e => setRecovery(Math.min(Number(e.target.value) || 0, maxRecovery))}
          />
        </FormGroup>
      )}

      <FormGroup label="Cash to Pay (Rs.)" required>
        <input
          className="form-input"
          type="number"
          placeholder="0"
          value={cash}
          min={0}
          onChange={e => setCash(Number(e.target.value) || 0)}
        />
      </FormGroup>

      {totalSettling > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          background: overLimit ? 'var(--red-light)' : 'var(--green-light)',
          border: `1px solid ${overLimit ? '#FECACA' : 'var(--green-border)'}`,
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Total Settling</div>
            {advBalance > 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                {formatCurrency(Number(cash) || 0)} cash + {formatCurrency(Number(recovery) || 0)} recovery
              </div>
            )}
          </div>
          <span style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: overLimit ? 'var(--red)' : 'var(--green)' }}>
            {formatCurrency(totalSettling)}
          </span>
        </div>
      )}

      {overLimit    && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>Amount exceeds what is owed.</p>}
      {overRecovery && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>Recovery exceeds advance balance.</p>}

      <FormGroup label="Payment Date">
        <input className="form-input" type="date" value={date} max={todayISO()}
          onChange={e => setDate(e.target.value)} />
      </FormGroup>
      <FormGroup label="Note (optional)">
        <input className="form-input" placeholder="e.g. Cash, Esewa…"
          value={note} onChange={e => setNote(e.target.value)} />
      </FormGroup>
    </Modal>
  );
}

// ─── ADVANCE MODAL ────────────────────────────────────────────────────────────

function AdvanceModal({ worker, advBalance, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState(todayISO());
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('Enter a valid amount.');
    setSaving(true);
    const isoDate = new Date(date).toISOString();
    await salaryPaymentsDB.save({
      id: generateUUID(), kaligadhId: worker.id, month: null,
      type: 'advance', amount: amt, date: isoDate,
      note: note.trim(), createdAt: new Date().toISOString(),
    });
    await activityDB.save({
      id: generateUUID(), type: 'expense', subType: 'salaryAdvance',
      amount: amt, description: `Advance given — ${worker.name}`,
      referenceId: worker.id, referenceType: 'kaligadh', date: isoDate,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={`Give Advance — ${worker.name}`}
      onClose={onClose}
      size="modal-sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          <Banknote size={14} /> {saving ? 'Saving…' : 'Give Advance'}
        </button>
      </>}
    >
      {advBalance > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>
          Current advance balance: {formatCurrency(advBalance)}
        </div>
      )}
      <FormGroup label="Amount (Rs.)" required>
        <input className="form-input" type="number" placeholder="0"
          value={amount} autoFocus onChange={e => setAmount(e.target.value)} />
      </FormGroup>
      <FormGroup label="Date">
        <input className="form-input" type="date" value={date} max={todayISO()}
          onChange={e => setDate(e.target.value)} />
      </FormGroup>
      <FormGroup label="Reason (optional)">
        <input className="form-input" placeholder="e.g. Medical, Dashain…"
          value={note} onChange={e => setNote(e.target.value)} />
      </FormGroup>
    </Modal>
  );
}

// ─── PAYMENT HISTORY MODAL ────────────────────────────────────────────────────

function PayHistoryModal({ worker, payments, onClose, onDelete }) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => [...payments].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [payments],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / HISTORY_PAGE_SIZE));
  const pageItems  = sorted.slice(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE);

  const TYPE_CFG = {
    payment:  { label: 'Cash Paid',      color: '#16a34a', sign: '–' },
    advance:  { label: 'Advance Given',  color: '#d97706', sign: '+' },
    recovery: { label: 'Recovery',       color: '#0284C7', sign: '–' },
  };

  return (
    <Modal
      title={`Payment History — ${worker.name}`}
      onClose={onClose}
      size="modal-lg"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            {sorted.length} records{totalPages > 1 ? ` · Page ${page + 1} of ${totalPages}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {totalPages > 1 && (
              <>
                <button className="btn btn-ghost btn-sm" disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 13, minWidth: 60, textAlign: 'center' }}>
                  {page + 1} / {totalPages}
                </span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}>
                  <ChevronRight size={14} />
                </button>
              </>
            )}
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      }
    >
      {sorted.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
          No payment records yet.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Note</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(p => {
                const cfg = TYPE_CFG[p.type] || TYPE_CFG.payment;
                return (
                  <tr key={p.id}>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(p.date)}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10,
                        background: cfg.color + '22', color: cfg.color, whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {p.month ? monthLabel(p.month) : '—'}
                    </td>
                    <td style={{
                      textAlign: 'right', fontFamily: 'DM Serif Display',
                      fontSize: 15, fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap',
                    }}>
                      {cfg.sign}{formatCurrency(p.amount)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.note || '—'}</td>
                    <td>
                      <button
                        onClick={() => onDelete(p)}
                        title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: '2px 4px', display: 'flex' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ─── WORKER ROW ───────────────────────────────────────────────────────────────

function WorkerRow({ worker, assignments, payments, month, onPay, onAdvance, onHistory, onPrint }) {
  const d = useMemo(
    () => computeWorkerData(assignments, payments, month),
    [assignments, payments, month],
  );

  const hasAnyWork = d.done > 0 || d.prevDue > 0;
  const fullySettled = hasAnyWork && d.totalPayable === 0;

  // Highlight row if there is outstanding amount
  const rowBg = d.totalPayable > 0
    ? 'rgba(254,202,202,0.12)'
    : fullySettled
      ? 'rgba(187,247,208,0.15)'
      : undefined;

  return (
    <tr style={{ background: rowBg }}>

      {/* ── Employee ── */}
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={worker.name} size={34} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{worker.name}</div>
            {worker.specialties?.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                {worker.specialties.slice(0, 2).join(', ')}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* ── Earned: Pieces ── */}
      <td style={{ textAlign: 'center', padding: '14px 10px', borderLeft: '1px solid var(--paper-3)' }}>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 26, color: d.done > 0 ? 'var(--ink)' : 'var(--ink-4)', lineHeight: 1 }}>
          {d.done > 0 ? d.done : '—'}
        </div>
        {d.done > 0 && d.avgRate > 0 && (
          <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
            avg {formatCurrency(d.avgRate)}/pc
          </div>
        )}
      </td>

      {/* ── Earned: Amount ── */}
      <td style={{ textAlign: 'right', padding: '14px 12px' }}>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: d.done > 0 ? 'var(--green)' : 'var(--ink-4)', lineHeight: 1 }}>
          {d.done > 0 ? formatCurrency(d.thisEarned) : '—'}
        </div>
        {d.thisPaid > 0 && (
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
            paid {formatCurrency(d.thisPaid)}
          </div>
        )}
      </td>

      {/* ── Working: Pieces ── */}
      <td style={{ textAlign: 'center', padding: '14px 10px', borderLeft: '1px solid var(--paper-3)' }}>
        {d.wip > 0 ? (
          <>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: '#0284C7', lineHeight: 1 }}>{d.wip}</div>
            <div style={{ fontSize: 10, color: '#0284C7', opacity: 0.7, marginTop: 4 }}>in progress</div>
          </>
        ) : (
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>—</span>
        )}
      </td>

      {/* ── Working: Est. Amount ── */}
      <td style={{ textAlign: 'right', padding: '14px 12px' }}>
        {d.wip > 0 ? (
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 16, color: '#0284C7' }}>
            {formatCurrency(d.wipEarned)}
          </div>
        ) : (
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>—</span>
        )}
      </td>

      {/* ── Previous Due ── */}
      <td style={{ textAlign: 'right', padding: '14px 12px', borderLeft: '1px solid var(--paper-3)' }}>
        {d.prevDue > 0 ? (
          <>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--red)', lineHeight: 1 }}>
              {formatCurrency(d.prevDue)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>{d.prevPieces} pcs</div>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Clear ✓</span>
        )}
      </td>

      {/* ── Advance ── */}
      <td style={{ textAlign: 'right', padding: '14px 12px', borderLeft: '1px solid var(--paper-3)' }}>
        {d.advBalance > 0 ? (
          <>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--amber)', lineHeight: 1 }}>
              {formatCurrency(d.advBalance)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
              of {formatCurrency(d.advGiven)} given
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>—</span>
        )}
      </td>

      {/* ── Net Payable ── */}
      <td style={{ textAlign: 'right', padding: '14px 14px', borderLeft: '1px solid var(--paper-3)' }}>
        {d.totalPayable > 0 ? (
          <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end',
            background: 'var(--red-light)', border: '1.5px solid #FECACA',
            borderRadius: 8, padding: '8px 14px',
          }}>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: 'var(--red)', lineHeight: 1 }}>
              {formatCurrency(d.totalPayable)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3, opacity: 0.8 }}>to pay</div>
          </div>
        ) : fullySettled ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--green)' }}>
              {formatCurrency(0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Settled ✓</div>
          </div>
        ) : (
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>—</span>
        )}
      </td>

      {/* ── Actions ── */}
      <td style={{ padding: '10px 14px', borderLeft: '1px solid var(--paper-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', minWidth: 90 }}>
          {d.totalPayable > 0 && (
            <button
              className="btn btn-green btn-sm"
              onClick={onPay}
              style={{ whiteSpace: 'nowrap', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: 'center' }}
            >
              <CreditCard size={12} /> Pay Now
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, width: '100%' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onAdvance}
              title="Give Advance"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Banknote size={12} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onHistory}
              title="Payment History"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <History size={12} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onPrint}
              title="Print Report"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Printer size={12} />
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Salary() {
  const [month, setMonth]   = useState(monthKey());
  const [workers, setWorkers] = useState([]);
  const [allAssignments, setAllAssignments]     = useState([]);
  const [paymentsByWorker, setPaymentsByWorker] = useState({});
  const [loading, setLoading]   = useState(true);
  const [workerPage, setWorkerPage] = useState(0);

  const [payModal,  setPayModal]  = useState(null); // { worker }
  const [advModal,  setAdvModal]  = useState(null); // { worker }
  const [histModal, setHistModal] = useState(null); // { worker }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [ks, assignments, allPayments] = await Promise.all([
      kaligadhsDB.getAll(),
      assignmentsDB.getAll(),
      salaryPaymentsDB.getAll(),
    ]);
    ks.sort((a, b) => a.name.localeCompare(b.name));
    const pm = {};
    for (const p of allPayments) {
      if (!pm[p.kaligadhId]) pm[p.kaligadhId] = [];
      pm[p.kaligadhId].push(p);
    }
    setWorkers(ks);
    setAllAssignments(assignments);
    setPaymentsByWorker(pm);
    setLoading(false);
  }

  async function handleDeletePayment(payment) {
    if (!window.confirm('Delete this payment record? This cannot be undone.')) return;
    await salaryPaymentsDB.delete(payment.id);
    setHistModal(null);
    load();
  }

  function getWorkerData(w) {
    return {
      assignments: allAssignments.filter(a => a.kaligadhId === w.id),
      payments:    paymentsByWorker[w.id] || [],
    };
  }

  // Page-level totals (across all workers)
  const totals = useMemo(() => {
    let earned = 0, wipPcs = 0, wipAmt = 0, prevDue = 0, advBalance = 0, payable = 0;
    for (const w of workers) {
      const { assignments, payments } = getWorkerData(w);
      const d = computeWorkerData(assignments, payments, month);
      earned     += d.thisEarned;
      wipPcs     += d.wip;
      wipAmt     += d.wipEarned;
      prevDue    += d.prevDue;
      advBalance += d.advBalance;
      payable    += d.totalPayable;
    }
    return { earned, wipPcs, wipAmt, prevDue, advBalance, payable };
  }, [workers, allAssignments, paymentsByWorker, month]);

  // Pagination
  const totalWorkerPages = Math.max(1, Math.ceil(workers.length / WORKERS_PER_PAGE));
  const pageWorkers = workers.slice(
    workerPage * WORKERS_PER_PAGE,
    (workerPage + 1) * WORKERS_PER_PAGE,
  );

  // Page totals (visible page only, for the tfoot row)
  const pageTotals = useMemo(() => {
    const pw = workers.slice(workerPage * WORKERS_PER_PAGE, (workerPage + 1) * WORKERS_PER_PAGE);
    let earned = 0, wip = 0, prevDue = 0, advBalance = 0, payable = 0;
    for (const w of pw) {
      const { assignments, payments } = getWorkerData(w);
      const d = computeWorkerData(assignments, payments, month);
      earned     += d.thisEarned;
      wip        += d.wip;
      prevDue    += d.prevDue;
      advBalance += d.advBalance;
      payable    += d.totalPayable;
    }
    return { earned, wip, prevDue, advBalance, payable };
  }, [workers, workerPage, allAssignments, paymentsByWorker, month]);

  const isCurrent = month === monthKey();

  // ─── Header styles helpers
  const thGroup = (extra = {}) => ({
    padding: '10px 12px',
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: 'rgba(255,255,255,0.85)',
    borderBottom: '1px solid rgba(255,255,255,0.15)',
    textAlign: 'center',
    ...extra,
  });
  const thSub = (extra = {}) => ({
    padding: '6px 10px',
    fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    ...extra,
  });

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Salary</h2>
          <p>Monthly salary tracker · earnings from completed orders</p>
        </div>

        {/* Month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setMonth(prevMonthKey(month)); setWorkerPage(0); }}>
            <ChevronLeft size={15} />
          </button>
          <div style={{
            padding: '7px 20px',
            background: isCurrent ? 'var(--ink)' : 'white',
            color: isCurrent ? 'white' : 'var(--ink)',
            border: '1.5px solid var(--paper-3)', borderRadius: 8,
            fontWeight: 700, fontSize: 14, minWidth: 175, textAlign: 'center',
          }}>
            {monthLabel(month)}
            {isCurrent && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, opacity: 0.55 }}>current</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setMonth(nextMonthKey(month)); setWorkerPage(0); }}>
            <ChevronRight size={15} />
          </button>
          {!isCurrent && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setMonth(monthKey()); setWorkerPage(0); }}>
              Today
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        <PageHelp id="salary" title="How Salary Works" items={[
          'Workers earn a making cost per piece when an assigned order is marked Completed — earnings appear in the current month.',
          '"Net Payable" = This month earned + Previous month due − Advance balance already given.',
          'Clicking "Pay Now" records the payment as an Expense in the Activity ledger — unpaid amounts carry forward automatically.',
          '"In Progress" pieces are not yet earned — they count once their order is completed.',
          'Previous Due shows salary owed from earlier months that was not paid.',
          'Advance: cash given to a worker before earning — recovered automatically when settling salary.',
          'Use the Print icon to generate a detailed salary slip for any worker.',
        ]} />

        {/* ── SUMMARY STAT CARDS ── */}
        {workers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              {
                label: 'Earned This Month',
                value: formatCurrency(totals.earned),
                color: 'var(--green)',
                border: 'var(--green)',
                sub: `${workers.filter(w => {
                  const { assignments, payments } = getWorkerData(w);
                  return computeWorkerData(assignments, payments, month).done > 0;
                }).length} workers worked`,
              },
              {
                label: `In Progress`,
                value: formatCurrency(totals.wipAmt),
                color: '#0284C7',
                border: '#0284C7',
                sub: `${totals.wipPcs} pieces pending`,
              },
              {
                label: 'Previous Month Due',
                value: formatCurrency(totals.prevDue),
                color: totals.prevDue > 0 ? 'var(--red)' : 'var(--ink-4)',
                border: totals.prevDue > 0 ? 'var(--red)' : undefined,
                sub: totals.prevDue > 0 ? 'carry-forward' : 'all clear',
              },
              {
                label: 'Advance Balance',
                value: formatCurrency(totals.advBalance),
                color: totals.advBalance > 0 ? 'var(--amber)' : 'var(--ink-4)',
                border: totals.advBalance > 0 ? 'var(--amber)' : undefined,
                sub: totals.advBalance > 0 ? 'to recover' : 'none outstanding',
              },
              {
                label: 'Total to Pay Now',
                value: formatCurrency(totals.payable),
                color: totals.payable > 0 ? 'var(--accent)' : 'var(--green)',
                border: totals.payable > 0 ? 'var(--accent)' : undefined,
                sub: totals.payable > 0 ? 'outstanding' : 'all settled ✓',
              },
            ].map(({ label, value, color, border, sub }) => (
              <div
                key={label}
                className="stat-card"
                style={border ? { borderLeftWidth: 3, borderLeftColor: border } : {}}
              >
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color }}>{value}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── MAIN TABLE ── */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
        ) : workers.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 36 }}>👷</span>}
            title="No workers found"
            message="Add workers in the Kaligadh section to start tracking salary"
          />
        ) : (
          <>
            <div className="table-wrap" style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <table style={{ minWidth: 860 }}>
                <thead>
                  {/* Group header row */}
                  <tr style={{ background: 'var(--ink)' }}>
                    <th rowSpan={2} style={{ ...thGroup(), textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Employee
                    </th>
                    <th colSpan={2} style={{ ...thGroup(), borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Earned This Month
                    </th>
                    <th colSpan={2} style={{ ...thGroup(), borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Working (Pending)
                    </th>
                    <th rowSpan={2} style={{ ...thGroup(), verticalAlign: 'middle', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderBottom: 'none', padding: '14px 12px' }}>
                      Prev Due
                    </th>
                    <th rowSpan={2} style={{ ...thGroup(), verticalAlign: 'middle', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderBottom: 'none', padding: '14px 12px' }}>
                      Advance
                    </th>
                    <th rowSpan={2} style={{ ...thGroup(), verticalAlign: 'middle', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderBottom: 'none', padding: '14px 14px', background: 'rgba(239,68,68,0.25)' }}>
                      Net Payable
                    </th>
                    <th rowSpan={2} style={{ ...thGroup(), verticalAlign: 'middle', borderBottom: 'none', padding: '14px 14px', width: 100 }}>
                    </th>
                  </tr>
                  {/* Sub-header row */}
                  <tr style={{ background: 'rgba(0,0,0,0.35)' }}>
                    <th style={{ ...thSub({ textAlign: 'center' }) }}>Pieces</th>
                    <th style={{ ...thSub({ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.12)' }) }}>Amount</th>
                    <th style={{ ...thSub({ textAlign: 'center' }) }}>Pieces</th>
                    <th style={{ ...thSub({ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.12)' }) }}>Est. Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {pageWorkers.map(w => {
                    const { assignments, payments } = getWorkerData(w);
                    return (
                      <WorkerRow
                        key={w.id}
                        worker={w}
                        assignments={assignments}
                        payments={payments}
                        month={month}
                        onPay={()     => setPayModal({ worker: w })}
                        onAdvance={()  => setAdvModal({ worker: w })}
                        onHistory={()  => setHistModal({ worker: w })}
                        onPrint={()    => printWorkerReport(
                          w,
                          computeWorkerData(assignments, payments, month),
                          payments,
                          month,
                        )}
                      />
                    );
                  })}
                </tbody>

                {/* Totals row */}
                {pageWorkers.length > 1 && (
                  <tfoot>
                    <tr style={{ background: 'var(--paper-2)', borderTop: '2px solid var(--paper-3)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Total · {pageWorkers.length} workers
                      </td>
                      {/* colSpan=2 covers Pieces + Amount */}
                      <td colSpan={2} style={{ textAlign: 'right', padding: '12px 12px', fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--green)', fontWeight: 700, borderLeft: '1px solid var(--paper-3)' }}>
                        {formatCurrency(pageTotals.earned)}
                      </td>
                      {/* colSpan=2 covers WIP Pieces + Est Amount */}
                      <td colSpan={2} style={{ textAlign: 'right', padding: '12px 12px', fontSize: 13, color: '#0284C7', fontWeight: 600, borderLeft: '1px solid var(--paper-3)' }}>
                        {pageTotals.wip > 0 ? `${pageTotals.wip} pcs` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 12px', fontFamily: 'DM Serif Display', fontSize: 16, color: pageTotals.prevDue > 0 ? 'var(--red)' : 'var(--ink-4)', borderLeft: '1px solid var(--paper-3)' }}>
                        {pageTotals.prevDue > 0 ? formatCurrency(pageTotals.prevDue) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 12px', fontFamily: 'DM Serif Display', fontSize: 16, color: pageTotals.advBalance > 0 ? 'var(--amber)' : 'var(--ink-4)', borderLeft: '1px solid var(--paper-3)' }}>
                        {pageTotals.advBalance > 0 ? formatCurrency(pageTotals.advBalance) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 14px', fontFamily: 'DM Serif Display', fontSize: 22, color: pageTotals.payable > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700, borderLeft: '1px solid var(--paper-3)' }}>
                        {formatCurrency(pageTotals.payable)}
                      </td>
                      <td style={{ borderLeft: '1px solid var(--paper-3)' }}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Worker pagination */}
            {totalWorkerPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 18 }}>
                <button className="btn btn-ghost btn-sm" disabled={workerPage === 0}
                  onClick={() => setWorkerPage(p => p - 1)}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
                  Page {workerPage + 1} of {totalWorkerPages}
                </span>
                <button className="btn btn-ghost btn-sm" disabled={workerPage >= totalWorkerPages - 1}
                  onClick={() => setWorkerPage(p => p + 1)}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODALS ── */}

      {payModal && (() => {
        const w = payModal.worker;
        const { assignments, payments } = getWorkerData(w);
        const data = computeWorkerData(assignments, payments, month);
        return (
          <PayModal
            worker={w}
            data={data}
            month={month}
            onClose={() => setPayModal(null)}
            onSaved={() => { setPayModal(null); load(); }}
          />
        );
      })()}

      {advModal && (() => {
        const w = advModal.worker;
        const payments = paymentsByWorker[w.id] || [];
        const advGiven = payments.filter(p => p.type === 'advance').reduce((s, p) => s + (p.amount || 0), 0);
        const advRecov = payments.filter(p => p.type === 'recovery').reduce((s, p) => s + (p.amount || 0), 0);
        return (
          <AdvanceModal
            worker={w}
            advBalance={Math.max(0, advGiven - advRecov)}
            onClose={() => setAdvModal(null)}
            onSaved={() => { setAdvModal(null); load(); }}
          />
        );
      })()}

      {histModal && (
        <PayHistoryModal
          worker={histModal.worker}
          payments={paymentsByWorker[histModal.worker.id] || []}
          onClose={() => setHistModal(null)}
          onDelete={handleDeletePayment}
        />
      )}
    </div>
  );
}
