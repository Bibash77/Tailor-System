import { useState, useEffect } from 'react';
import { CheckCircle, ChevronRight, X, Calendar, Banknote } from 'lucide-react';
import { kaligadhsDB, assignmentsDB, activityDB, ordersDB } from '../db';
import { generateUUID, formatCurrency, formatDate, todayISO, ITEM_COLORS } from '../utils';
import { Modal, Badge, EmptyState, ItemTag } from '../components/UI';

function ClearDueModal({ kaligadh, onClose, onCleared }) {
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  async function handleClear() {
    setSaving(true);
    await kaligadhsDB.save({ ...kaligadh, totalDue: 0, lastPaidDate: date });
    await activityDB.save({
      id: generateUUID(),
      type: 'expense',
      subType: 'kaligadhPayment',
      amount: kaligadh.totalDue,
      description: `Due cleared — ${kaligadh.name}`,
      referenceId: kaligadh.id,
      referenceType: 'kaligadh',
      date: new Date(date).toISOString(),
    });
    setSaving(false);
    onCleared();
  }

  return (
    <Modal title="Clear Due Payment" onClose={onClose} size="modal-sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-accent" disabled={saving} onClick={handleClear}>
          <CheckCircle size={14} /> Confirm Clear
        </button>
      </>}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>Clearing due for</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{kaligadh.name}</div>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: 'var(--accent)', marginTop: 4 }}>
          {formatCurrency(kaligadh.totalDue)}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Payment Date</label>
        <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} max={todayISO()} />
        <div className="form-hint">Defaults to today. Change if payment was received on a different date.</div>
      </div>
    </Modal>
  );
}

function KaligadhDetail({ kaligadh, onClose, onClearDue }) {
  const [assignments, setAssignments] = useState([]);
  const [orders, setOrders] = useState({});

  useEffect(() => {
    async function load() {
      const as = await assignmentsDB.getByKaligadh(kaligadh.id);
      as.sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
      setAssignments(as);
      const orderMap = {};
      for (const a of as) {
        if (!orderMap[a.orderId]) {
          const o = await ordersDB.getById(a.orderId);
          if (o) orderMap[a.orderId] = o;
        }
      }
      setOrders(orderMap);
    }
    load();
  }, [kaligadh.id]);

  const totalPcs = assignments.length;
  const pcsPerCycle = Math.floor(totalPcs / 5);

  return (
    <Modal title={kaligadh.name} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        {kaligadh.totalDue > 0 && (
          <button className="btn btn-accent" onClick={() => onClearDue(kaligadh)}>
            <CheckCircle size={14} /> Clear Due ({formatCurrency(kaligadh.totalDue)})
          </button>
        )}
      </>}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Due', value: formatCurrency(kaligadh.totalDue), color: kaligadh.totalDue > 0 ? 'var(--accent)' : 'var(--green)' },
          { label: 'Last Paid', value: formatDate(kaligadh.lastPaidDate) },
          { label: 'Total Pieces', value: `${totalPcs} pcs` },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '12px 14px', background: 'var(--paper-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: color || 'var(--ink)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Assignment History</div>

      {assignments.length === 0
        ? <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-3)' }}>No assignments yet</div>
        : assignments.map(a => {
            const o = orders[a.orderId];
            return (
              <div key={a.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                <div>
                  <div className="flex items-center gap-2">
                    <ItemTag item={a.itemCategory} />
                    <span style={{ fontFamily: 'DM Serif Display', color: 'var(--accent)', fontSize: 14 }}>{a.orderId}</span>
                    {o && <span style={{ color: 'var(--ink-3)' }}>{o.customerName}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>
                    {formatDate(a.assignedAt)}
                    {a.note && ` · ${a.note}`}
                  </div>
                </div>
                <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)' }}>Rs. {a.makingCost}</span>
              </div>
            );
          })
      }
    </Modal>
  );
}

export default function Kaligadh() {
  const [kaligadhs, setKaligadhs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clearing, setClearing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const ks = await kaligadhsDB.getAll();
    // Enrich with piece counts
    const enriched = await Promise.all(ks.map(async k => {
      const as = await assignmentsDB.getByKaligadh(k.id);
      return { ...k, totalPcs: as.length };
    }));
    enriched.sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));
    setKaligadhs(enriched);
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h2>Kaligadh</h2>
        <p>Track worker assignments and payment dues</p>
      </div>
      <div className="page-body">

        {/* Summary */}
        {kaligadhs.length > 0 && (
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 24 }}>
            {[
              { label: 'Total Workers', value: kaligadhs.length },
              { label: 'Total Due', value: formatCurrency(kaligadhs.reduce((s, k) => s + (k.totalDue || 0), 0)), accent: 'var(--accent)' },
              { label: 'Total Pieces', value: `${kaligadhs.reduce((s, k) => s + (k.totalPcs || 0), 0)} pcs` },
            ].map(({ label, value, accent }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={accent ? { color: accent } : {}}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>
          : kaligadhs.length === 0
          ? <EmptyState
              icon={<span style={{ fontSize: 32 }}>🧵</span>}
              title="No workers added"
              message="Go to Settings to add Kaligadh workers"
            />
          : <table>
              <thead><tr>
                <th>Name</th>
                <th>Specialties</th>
                <th>Total Pieces</th>
                <th>Pieces (per 5)</th>
                <th>Remaining Due</th>
                <th>Last Paid</th>
                <th></th>
              </tr></thead>
              <tbody>
                {kaligadhs.map(k => (
                  <tr key={k.id} onClick={() => setSelected(k)}>
                    <td style={{ fontWeight: 600 }}>{k.name}</td>
                    <td>{k.specialties?.map(s => <span key={s} className="badge badge-blue" style={{ marginRight: 4 }}>{s}</span>)}</td>
                    <td>{k.totalPcs || 0} pcs</td>
                    <td>
                      <span style={{ fontFamily: 'DM Serif Display', fontSize: 15 }}>
                        {Math.floor((k.totalPcs || 0) / 5)} sets of 5
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'DM Serif Display', fontSize: 16, color: (k.totalDue || 0) > 0 ? 'var(--accent)' : 'var(--green)' }}>
                        {formatCurrency(k.totalDue || 0)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{formatDate(k.lastPaidDate)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(k)}><ChevronRight size={13} /></button>
                        {(k.totalDue || 0) > 0 && (
                          <button className="btn btn-accent btn-sm" onClick={() => setClearing(k)}>
                            <CheckCircle size={13} /> Clear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>

      {selected && (
        <KaligadhDetail
          kaligadh={selected}
          onClose={() => setSelected(null)}
          onClearDue={(k) => { setSelected(null); setClearing(k); }}
        />
      )}

      {clearing && (
        <ClearDueModal
          kaligadh={clearing}
          onClose={() => setClearing(null)}
          onCleared={() => { setClearing(null); load(); }}
        />
      )}
    </div>
  );
}
