import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, ArrowUpDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { expensesDB } from '../db';
import { generateUUID, formatCurrency, formatDate, todayISO, monthKey, monthLabel, prevMonthKey, nextMonthKey, entryMonthKey, applyEdit } from '../utils';
import { Badge, EmptyState, FormGroup, HistoryModal, PageHelp, TableSkeleton } from '../components/UI';

export const EXPENSE_CATEGORIES = [
  'Transport', 'Materials', 'Rent', 'Utilities', 'Salaries', 'Food & Meals', 'Other',
];

const CAT_BADGE = {
  Transport:     'blue',
  Materials:     'amber',
  Rent:          'amber',
  Utilities:     'gray',
  Salaries:      'green',
  'Food & Meals': 'blue',
  Other:         'gray',
};

function blankForm() {
  return { category: '', customCategory: '', amount: '', paymentStatus: 'paid', date: todayISO(), note: '' };
}

function resolveCategory(form) {
  return form.category === '_custom' ? form.customCategory.trim() : form.category;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthKey());
  const [form, setForm] = useState(blankForm());
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [histExpense, setHistExpense] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const all = await expensesDB.getAll();
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    setExpenses(all);
    setLoading(false);
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleAdd() {
    const cat = resolveCategory(form);
    if (!cat) return alert('Select or enter a category.');
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) return alert('Enter a valid amount.');
    await expensesDB.save({
      id: generateUUID(),
      category: cat,
      amount: Number(form.amount),
      paymentStatus: form.paymentStatus,
      date: form.date || todayISO(),
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
    });
    setForm(blankForm());
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense?')) return;
    await expensesDB.delete(id);
    load();
  }

  function startEdit(exp) {
    setEditingId(exp.id);
    // Detect if category is custom (not in preset list)
    const isCustom = !EXPENSE_CATEGORIES.includes(exp.category);
    setEditForm({
      ...exp,
      category: isCustom ? '_custom' : exp.category,
      customCategory: isCustom ? exp.category : '',
      date: exp.date?.slice(0, 10) || todayISO(),
    });
  }

  async function saveEdit() {
    const cat = editForm.category === '_custom' ? editForm.customCategory.trim() : editForm.category;
    if (!cat || !editForm.amount) return;
    const original = expenses.find(e => e.id === editingId);
    const updates = { category: cat, amount: Number(editForm.amount), paymentStatus: editForm.paymentStatus, date: editForm.date, note: editForm.note };
    const updated = original ? applyEdit(original, updates) : { ...editForm, category: cat, amount: Number(editForm.amount) };
    await expensesDB.save(updated);
    setEditingId(null);
    setEditForm(null);
    load();
  }

  // Filter by selected month first, then apply status/category filters
  const monthExpenses = expenses.filter(e => entryMonthKey(e.date) === month);
  const usedCategories = [...new Set(monthExpenses.map(e => e.category))].sort();

  let filtered = monthExpenses.filter(e => {
    if (filterStatus !== 'all' && e.paymentStatus !== filterStatus) return false;
    if (filterCat !== 'all' && e.category !== filterCat) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'amount') return b.amount - a.amount;
    if (sortBy === 'category') return a.category.localeCompare(b.category);
    return new Date(b.date) - new Date(a.date);
  });

  const totalPaid = monthExpenses.filter(e => e.paymentStatus === 'paid').reduce((s, e) => s + e.amount, 0);
  const totalRemaining = monthExpenses.filter(e => e.paymentStatus === 'remaining').reduce((s, e) => s + e.amount, 0);
  const totalAll = totalPaid + totalRemaining;
  const isCurrent = month === monthKey();

  return (
    <>
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Expenses</h2>
          <p>Track and manage miscellaneous business expenses</p>
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
        </div>
      </div>
      <div className="page-body">
        <PageHelp id="expenses" title="How Expenses Work" items={[
          'Record any business cost here — rent, materials, transport, utilities, etc.',
          'Salary payments made from the Salary page are automatically added as expenses (category: Salaries). No need to add them manually.',
          'Dealer purchases marked as paid also flow into the Activity ledger automatically.',
          'Set Payment Status to Pending for costs you owe but haven\'t paid yet — they won\'t count as cash out until paid.',
          'Expenses are filtered by month. Use the arrows to browse past months.',
        ]} />

        {/* Summary */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Entries</div>
            <div className="stat-value">{expenses.length}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{formatCurrency(totalAll)}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
            <div className="stat-label">Paid</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCurrency(totalPaid)}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="stat-label">Outstanding</div>
            <div className="stat-value" style={{ color: totalRemaining > 0 ? 'var(--accent)' : 'var(--ink-3)' }}>
              {formatCurrency(totalRemaining)}
            </div>
          </div>
        </div>

        {/* ── Add Expense Form ── */}
        <div className="card card-pad mb-6">
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 17, marginBottom: 16 }}>Add Expense</div>

          {/* Category quick-select */}
          <div style={{ marginBottom: 14 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>Category</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {EXPENSE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`btn btn-sm ${form.category === cat ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => f('category', cat)}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                className={`btn btn-sm ${form.category === '_custom' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => f('category', '_custom')}
              >
                + Custom
              </button>
            </div>
            {form.category === '_custom' && (
              <input
                className="form-input"
                placeholder="Enter category name…"
                value={form.customCategory}
                onChange={e => f('customCategory', e.target.value)}
                style={{ marginTop: 10, maxWidth: 280 }}
                autoFocus
              />
            )}
          </div>

          {/* Main fields row */}
          <div className="grid-3 mb-3">
            <FormGroup label="Amount (Rs.)" required>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="0"
                value={form.amount}
                onChange={e => f('amount', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </FormGroup>

            <FormGroup label="Payment Status">
              <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${form.paymentStatus === 'paid' ? 'btn-green' : 'btn-ghost'}`}
                  onClick={() => f('paymentStatus', 'paid')}
                >
                  <Check size={12} /> Paid
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${form.paymentStatus === 'remaining' ? 'btn-accent' : 'btn-ghost'}`}
                  onClick={() => f('paymentStatus', 'remaining')}
                >
                  Remaining
                </button>
              </div>
            </FormGroup>

            <FormGroup label="Date">
              <input
                className="form-input"
                type="date"
                value={form.date}
                max={todayISO()}
                onChange={e => f('date', e.target.value)}
              />
            </FormGroup>
          </div>

          {/* Note + submit */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Note (optional)</label>
              <input
                className="form-input"
                placeholder="e.g. Bought thread and buttons from market"
                value={form.note}
                onChange={e => f('note', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button className="btn btn-primary btn-lg" onClick={handleAdd} style={{ flexShrink: 0 }}>
              <Plus size={16} /> Add Expense
            </button>
          </div>
        </div>

        {/* ── Expense List ── */}
        <div className="card">
          {/* Toolbar */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--paper-2)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status filter */}
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'paid', label: 'Paid' },
                { key: 'remaining', label: 'Remaining' },
              ].map(btn => (
                <button
                  key={btn.key}
                  className={`btn btn-sm ${filterStatus === btn.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setFilterStatus(btn.key)}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            {usedCategories.length > 0 && (
              <div style={{ borderLeft: '1px solid var(--paper-3)', paddingLeft: 10 }}>
                <select
                  className="form-select"
                  style={{ fontSize: 13, padding: '5px 10px', height: 'auto' }}
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Sort */}
            <div className="flex gap-1" style={{ borderLeft: '1px solid var(--paper-3)', paddingLeft: 10, marginLeft: 'auto' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center', marginRight: 2 }}>
                <ArrowUpDown size={12} />
              </span>
              {[
                { key: 'date', label: 'Date' },
                { key: 'amount', label: 'Amount' },
                { key: 'category', label: 'Category' },
              ].map(s => (
                <button
                  key={s.key}
                  className={`btn btn-sm ${sortBy === s.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSortBy(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<span style={{ fontSize: 32 }}>🧾</span>}
              title="No expenses found"
              message={filterStatus !== 'all' || filterCat !== 'all' ? 'Try changing the filters' : 'Add your first expense above'}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => (
                    editingId === exp.id ? (
                      <tr key={exp.id} style={{ background: 'var(--paper)' }}>
                        <td>
                          <input
                            className="form-input"
                            type="date"
                            value={editForm.date}
                            max={todayISO()}
                            onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                            style={{ width: 140 }}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={editForm.category}
                            onChange={e => setEditForm(p => ({ ...p, category: e.target.value, customCategory: '' }))}
                          >
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            <option value="_custom">Custom…</option>
                          </select>
                          {editForm.category === '_custom' && (
                            <input
                              className="form-input"
                              placeholder="Category name"
                              value={editForm.customCategory}
                              onChange={e => setEditForm(p => ({ ...p, customCategory: e.target.value }))}
                              style={{ marginTop: 6 }}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            className="form-input"
                            value={editForm.note}
                            onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            value={editForm.amount}
                            onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                            style={{ width: 110, textAlign: 'right' }}
                          />
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className={`btn btn-sm ${editForm.paymentStatus === 'paid' ? 'btn-green' : 'btn-ghost'}`}
                              onClick={() => setEditForm(p => ({ ...p, paymentStatus: 'paid' }))}
                            >Paid</button>
                            <button
                              className={`btn btn-sm ${editForm.paymentStatus === 'remaining' ? 'btn-accent' : 'btn-ghost'}`}
                              onClick={() => setEditForm(p => ({ ...p, paymentStatus: 'remaining' }))}
                            >Remaining</button>
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={saveEdit}><Check size={13} /></button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditForm(null); }}><X size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={exp.id}>
                        <td style={{ color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {formatDate(exp.date)}
                        </td>
                        <td>
                          <span className={`badge badge-${CAT_BADGE[exp.category] || 'gray'}`}>
                            {exp.category}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 260 }}>
                          {exp.note || <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td style={{ fontFamily: 'DM Serif Display', fontSize: 16, color: 'var(--red)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          − {formatCurrency(exp.amount)}
                        </td>
                        <td>
                          <span className={`badge ${exp.paymentStatus === 'paid' ? 'badge-green' : 'badge-amber'}`}>
                            {exp.paymentStatus === 'paid' ? 'Paid' : 'Remaining'}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                            {exp.history?.length > 0 && (
                              <button className="btn btn-ghost btn-sm" title="Edit history"
                                onClick={() => setHistExpense(exp)}>
                                <History size={13} />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(exp)}>
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red)' }}
                              onClick={() => handleDelete(exp.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer total for filtered view */}
          {filtered.length > 0 && (
            <div style={{ padding: '12px 18px', borderTop: '2px solid var(--paper-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                {(filterStatus !== 'all' || filterCat !== 'all') && ' (filtered)'}
              </span>
              <span style={{ fontFamily: 'DM Serif Display', fontSize: 17, color: 'var(--red)' }}>
                − {formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
    {histExpense && (
      <HistoryModal
        title={`${histExpense.category} · ${formatCurrency(histExpense.amount)}`}
        history={histExpense.history || []}
        onClose={() => setHistExpense(null)}
      />
    )}
    </>
  );
}
