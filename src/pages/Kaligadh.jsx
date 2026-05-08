import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, History } from 'lucide-react';
import {
  kaligadhsDB, assignmentsDB, ordersDB, salaryPaymentsDB,
} from '../db';
import { generateUUID, formatCurrency, formatDate, applyEdit } from '../utils';
import { Modal, Avatar, EmptyState, ItemTag, FormGroup, HistoryModal, PageHelp, TableSkeleton } from '../components/UI';

// ─── ADVANCE BALANCE HELPER ───────────────────────────────────────────────────
function computeAdvanceBalance(payments) {
  const given     = payments.filter(p => p.type === 'advance').reduce((s, p) => s + (p.amount || 0), 0);
  const recovered = payments.filter(p => p.type === 'recovery').reduce((s, p) => s + (p.amount || 0), 0);
  return Math.max(0, given - recovered);
}

// ─── WORKER PROFILE VIEW ──────────────────────────────────────────────────────
function WorkerProfile({ worker, assignments, payments, onBack, onEdit, onHistory }) {
  const [ordersMap, setOrdersMap] = useState({});

  useEffect(() => {
    async function loadOrders() {
      const map = {};
      const ids = [...new Set(assignments.map(a => a.orderId))];
      await Promise.all(ids.map(async id => {
        const o = await ordersDB.getById(id);
        if (o) map[id] = o;
      }));
      setOrdersMap(map);
    }
    loadOrders();
  }, [assignments]);

  const sorted = [...assignments].sort((a, b) => {
    const da = new Date(a.completedAt ?? a.assignedAt);
    const db = new Date(b.completedAt ?? b.assignedAt);
    return db - da;
  });
  const totalPcs    = sorted.length;
  const totalEarned = sorted.reduce((s, a) => s + (Number(a.makingCost) || 0), 0);
  const advanceBalance = computeAdvanceBalance(payments);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              <ChevronLeft size={16} /> Back
            </button>
            <Avatar name={worker.name} size={48} />
            <div>
              <h2 style={{ margin: 0 }}>{worker.name}</h2>
              <p style={{ margin: 0 }}>
                {worker.specialties?.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {worker.history?.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={onHistory} title="Edit history">
                <History size={14} /> History
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>
              <Edit2 size={14} /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Pieces Made</div>
            <div className="stat-value" style={{ fontFamily: 'DM Serif Display', fontSize: 28 }}>{totalPcs}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
            <div className="stat-label">Total Earned (All Time)</div>
            <div className="stat-value" style={{ color: 'var(--green)', fontFamily: 'DM Serif Display', fontSize: 24 }}>
              {formatCurrency(totalEarned)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Advance</div>
            <div className="stat-value" style={{ color: advanceBalance > 0 ? 'var(--amber)' : 'var(--ink-4)' }}>
              {advanceBalance > 0 ? formatCurrency(advanceBalance) : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Work Date</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {sorted[0] ? formatDate(sorted[0].assignedAt) : '—'}
            </div>
          </div>
        </div>

        {/* Work History */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--paper-2)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Work History · {totalPcs} piece{totalPcs !== 1 ? 's' : ''}
          </div>
          {sorted.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No work assigned yet
            </div>
          ) : sorted.map(a => {
            const o = ordersMap[a.orderId];
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ItemTag item={a.itemCategory} />
                    <span style={{ fontFamily: 'DM Serif Display', color: 'var(--accent)', fontSize: 14 }}>{a.orderId}</span>
                    {o && <span style={{ color: 'var(--ink-3)' }}>{o.customerName}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>
                    {a.completedAt ? formatDate(a.completedAt) : (
                      <span style={{ color: 'var(--amber)', fontWeight: 600 }}>In Progress</span>
                    )}
                    {a.note ? ` · ${a.note}` : ''}
                  </div>
                </div>
                <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {formatCurrency(a.makingCost)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Kaligadh({ itemCategories = [] }) {
  const [kaligadhs, setKaligadhs]   = useState([]);
  const [assignmentsByWorker, setAssignmentsByWorker] = useState({});
  const [paymentsByWorker, setPaymentsByWorker] = useState({});
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null); // worker being viewed
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);  // worker being edited
  const [form, setForm]             = useState({ name: '', specialties: [] });
  const [histWorker, setHistWorker] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [ks, allAssignments, allPayments] = await Promise.all([
      kaligadhsDB.getAll(),
      assignmentsDB.getAll(),
      salaryPaymentsDB.getAll(),
    ]);
    ks.sort((a, b) => a.name.localeCompare(b.name));

    const aMap = {}, pMap = {};
    for (const a of allAssignments) {
      if (!aMap[a.kaligadhId]) aMap[a.kaligadhId] = [];
      aMap[a.kaligadhId].push(a);
    }
    for (const p of allPayments) {
      if (!pMap[p.kaligadhId]) pMap[p.kaligadhId] = [];
      pMap[p.kaligadhId].push(p);
    }

    setKaligadhs(ks);
    setAssignmentsByWorker(aMap);
    setPaymentsByWorker(pMap);
    setLoading(false);
  }

  // ── Worker form ──
  function openAdd() {
    setEditing(null);
    setForm({ name: '', specialties: [] });
    setShowForm(true);
  }

  function openEdit(k) {
    setEditing(k);
    setForm({ name: k.name, specialties: [...(k.specialties || [])] });
    setShowForm(true);
  }

  function toggleSpecialty(name) {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(name)
        ? prev.specialties.filter(x => x !== name)
        : [...prev.specialties, name],
    }));
  }

  async function saveWorker() {
    if (!form.name.trim()) return alert('Name is required.');
    if (form.specialties.length === 0) return alert('Select at least one specialty.');
    let k;
    if (editing) {
      k = applyEdit(editing, { name: form.name.trim(), specialties: form.specialties });
    } else {
      k = { id: generateUUID(), name: form.name.trim(), specialties: form.specialties, totalDue: 0, createdAt: new Date().toISOString() };
    }
    await kaligadhsDB.save(k);
    setShowForm(false);
    setEditing(null);
    if (selected?.id === k.id) setSelected(k); // refresh selected
    load();
  }

  async function deleteWorker(id) {
    if (!window.confirm('Delete this worker? All assignments linked to them will remain but the worker record will be removed.')) return;
    await kaligadhsDB.delete(id);
    if (selected?.id === id) setSelected(null);
    setShowForm(false);
    load();
  }

  // ── Enriched worker list ──
  const enriched = useMemo(() => kaligadhs.map(k => {
    const assignments = assignmentsByWorker[k.id] || [];
    const payments    = paymentsByWorker[k.id] || [];
    const totalPcs    = assignments.length;
    const totalEarned = assignments.reduce((s, a) => s + (Number(a.makingCost) || 0), 0);
    const advance     = computeAdvanceBalance(payments);
    return { ...k, totalPcs, totalEarned, advance };
  }), [kaligadhs, assignmentsByWorker, paymentsByWorker]);

  // ── Profile view ──
  if (selected) {
    const w = enriched.find(e => e.id === selected.id) || selected;
    return (
      <>
        <WorkerProfile
          worker={w}
          assignments={assignmentsByWorker[w.id] || []}
          payments={paymentsByWorker[w.id] || []}
          onBack={() => setSelected(null)}
          onEdit={() => openEdit(w)}
          onHistory={() => setHistWorker(w)}
        />
        {showForm && (
          <WorkerFormModal
            form={form} editing={editing} itemCategories={itemCategories}
            onChange={setForm} onToggleSpecialty={toggleSpecialty}
            onSave={saveWorker} onDelete={deleteWorker}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {histWorker && (
          <HistoryModal
            title={histWorker.name}
            history={histWorker.history || []}
            onClose={() => setHistWorker(null)}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Kaligadh</h2>
          <p>Worker profiles, specialties, and work history</p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={openAdd}>
          <Plus size={14} /> Add Worker
        </button>
      </div>

      <div className="page-body">
        <PageHelp id="kaligadh" title="How Kaligadh (Workers) Work" items={[
          'Add all your tailors and workers here. Each worker has specialties — the items they can stitch.',
          'Assign orders to workers from the Orders page (Eye icon → Assign Kaligadh) or during order creation.',
          'Salary is auto-calculated from making costs on completed assignments — track it on the Salary page.',
          'Advance given to a worker here is tracked and recovered when paying their salary.',
          'Active Orders = orders currently assigned to this worker that are not yet completed.',
          'Click a worker row to see their full profile, assignment history, and advance records.',
        ]} />

        {/* ── SUMMARY STATS ── */}
        {enriched.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total Workers</div>
              <div className="stat-value">{enriched.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Pieces Made</div>
              <div className="stat-value">{enriched.reduce((s, w) => s + w.totalPcs, 0)}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
              <div className="stat-label">Total Earned (All Time)</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>
                {formatCurrency(enriched.reduce((s, w) => s + w.totalEarned, 0))}
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--amber)' }}>
              <div className="stat-label">Outstanding Advances</div>
              <div className="stat-value" style={{ color: 'var(--amber)' }}>
                {formatCurrency(enriched.reduce((s, w) => s + w.advance, 0))}
              </div>
            </div>
          </div>
        )}

        {/* ── WORKER LIST ── */}
        <div className="card">
          {loading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : enriched.length === 0 ? (
            <EmptyState
              icon={<span style={{ fontSize: 32 }}>🧵</span>}
              title="No workers added yet"
              message="Add Kaligadh workers to assign them to orders"
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Specialties</th>
                    <th style={{ textAlign: 'center' }}>Pieces</th>
                    <th style={{ textAlign: 'right' }}>Total Earned</th>
                    <th style={{ textAlign: 'right' }}>Advance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(w => (
                    <tr key={w.id} onClick={() => setSelected(w)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={w.name} size={34} />
                          <span style={{ fontWeight: 700 }}>{w.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {w.specialties?.map(s => (
                            <span key={s} className="badge badge-blue">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>{w.totalPcs}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 3 }}>pcs</span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--green)' }}>
                        {formatCurrency(w.totalEarned)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {w.advance > 0 ? (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid #FDE68A', whiteSpace: 'nowrap' }}>
                            {formatCurrency(w.advance)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>—</span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)} title="Edit">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(w)} title="View profile">
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {enriched.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-3)', border: '1px solid var(--paper-3)' }}>
            Salary payments and advances are managed in the <strong style={{ color: 'var(--ink-2)' }}>Salary</strong> section.
            Advances are automatically recovered as work is assigned.
          </div>
        )}

      </div>

      {/* ── WORKER FORM MODAL ── */}
      {showForm && (
        <WorkerFormModal
          form={form} editing={editing} itemCategories={itemCategories}
          onChange={setForm} onToggleSpecialty={toggleSpecialty}
          onSave={saveWorker} onDelete={deleteWorker}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ─── WORKER FORM MODAL ────────────────────────────────────────────────────────
function WorkerFormModal({ form, editing, itemCategories, onChange, onToggleSpecialty, onSave, onDelete, onClose }) {
  return (
    <Modal
      title={editing ? 'Edit Worker' : 'Add Worker'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave}>Save</button>
      </>}
    >
      <FormGroup label="Full Name" required>
        <input
          className="form-input"
          placeholder="e.g. Ramesh Thapa"
          value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          autoFocus
        />
      </FormGroup>
      <FormGroup label="Specialties" required hint="Select all item types this worker can handle">
        {itemCategories.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Add item categories in Settings first</div>
        ) : (
          <div className="checkbox-group">
            {itemCategories.map(cat => (
              <div
                key={cat.name}
                className={`checkbox-item ${form.specialties.includes(cat.name) ? 'checked' : ''}`}
                onClick={() => onToggleSpecialty(cat.name)}
              >
                {cat.name}
              </div>
            ))}
          </div>
        )}
      </FormGroup>
      {editing && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--paper-3)', textAlign: 'right' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--red)' }}
            onClick={() => onDelete(editing.id)}
          >
            <Trash2 size={13} /> Delete Worker
          </button>
        </div>
      )}
    </Modal>
  );
}
