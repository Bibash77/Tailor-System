import { useState, useEffect } from 'react';
import { Check, UserCheck } from 'lucide-react';
import { kaligadhsDB, assignmentsDB, activityDB, settingsDB } from '../db';
import { generateUUID, DEFAULT_MAKING_COSTS, ITEM_COLORS, formatCurrency } from '../utils';
import { ItemTag } from '../components/UI';

export default function AssignKaligadh({ order, onDone }) {
  const [kaligadhs, setKaligadhs] = useState([]);
  const [costs, setCosts] = useState(DEFAULT_MAKING_COSTS);
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const ks = await kaligadhsDB.getAll();
    setKaligadhs(ks);
    const savedCosts = await settingsDB.get('makingCosts');
    const c = savedCosts || DEFAULT_MAKING_COSTS;
    setCosts(c);
    // Pre-fill assignments with defaults
    const init = {};
    order.items.forEach(item => {
      init[item] = { kaligadhId: '', makingCost: c[item] || 0, note: '' };
    });
    setAssignments(init);
  }

  function updateAssignment(item, field, value) {
    setAssignments(prev => ({ ...prev, [item]: { ...prev[item], [field]: value } }));
  }

  async function handleConfirm() {
    const toAssign = order.items.filter(item => assignments[item]?.kaligadhId);
    if (toAssign.length === 0) return onDone(); // skip if nothing assigned

    setSaving(true);
    for (const item of toAssign) {
      const { kaligadhId, makingCost, note } = assignments[item];
      const cost = Number(makingCost) || 0;

      // Save assignment
      const assignId = generateUUID();
      await assignmentsDB.save({
        id: assignId,
        orderId: order.id,
        kaligadhId,
        itemCategory: item,
        makingCost: cost,
        note: note.trim(),
        assignedAt: new Date().toISOString(),
      });

      // Update kaligadh due
      const k = await kaligadhsDB.getById(kaligadhId);
      if (k) {
        await kaligadhsDB.save({ ...k, totalDue: (k.totalDue || 0) + cost });
      }

      // Log expense in activity
      const kName = kaligadhs.find(x => x.id === kaligadhId)?.name || 'Unknown';
      await activityDB.save({
        id: generateUUID(),
        type: 'expense',
        subType: 'makingCost',
        amount: cost,
        description: `Making cost — ${kName} (${item})`,
        referenceId: order.id,
        referenceType: 'order',
        date: new Date().toISOString(),
      });
    }
    setSaving(false);
    onDone();
  }

  return (
    <div>
      <div className="page-header">
        <h2>Assign Kaligadh</h2>
        <p>Order {order.id} — {order.customerName} · {order.items.join(', ')}</p>
      </div>
      <div className="page-body">
        <div style={{ maxWidth: 700 }}>

          <div className="alert alert-info mb-4">
            Assign workers for each item below. You can skip any item and assign later from the order page.
          </div>

          {order.items.map(item => {
            const c = ITEM_COLORS[item] || {};
            const a = assignments[item] || {};
            const filteredWorkers = kaligadhs.filter(k => k.specialties?.includes(item));
            return (
              <div key={item} className="assign-panel">
                <div className="assign-panel-header">
                  <ItemTag item={item} />
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    {filteredWorkers.length} worker{filteredWorkers.length !== 1 ? 's' : ''} available
                  </span>
                </div>

                <div className="grid-2 mb-3">
                  <div>
                    <label className="form-label">Select Kaligadh</label>
                    <select className="form-select" value={a.kaligadhId}
                      onChange={e => updateAssignment(item, 'kaligadhId', e.target.value)}>
                      <option value="">— Skip for now —</option>
                      {filteredWorkers.map(k => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                      {filteredWorkers.length === 0 && <option disabled>No workers with {item} specialty</option>}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Making Cost (Rs.)</label>
                    <input className="form-input" type="number" value={a.makingCost}
                      onChange={e => updateAssignment(item, 'makingCost', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="form-label">Note (optional)</label>
                  <input className="form-input" placeholder="Any note for this assignment..." value={a.note}
                    onChange={e => updateAssignment(item, 'note', e.target.value)} />
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="card card-pad mb-6" style={{ background: 'var(--paper-2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Assignment Summary</div>
            {order.items.map(item => {
              const a = assignments[item] || {};
              const k = kaligadhs.find(x => x.id === a.kaligadhId);
              return (
                <div key={item} className="flex items-center justify-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--paper-3)', fontSize: 13 }}>
                  <span><ItemTag item={item} />&nbsp;&nbsp;{k ? <strong>{k.name}</strong> : <span style={{ color: 'var(--ink-4)' }}>Not assigned</span>}</span>
                  {k && <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)' }}>− {formatCurrency(a.makingCost)}</span>}
                </div>
              );
            })}
            <div className="flex items-center justify-between mt-3">
              <span style={{ fontWeight: 700, fontSize: 13 }}>Total Making Cost</span>
              <span style={{ fontFamily: 'DM Serif Display', fontSize: 18, color: 'var(--accent)' }}>
                − {formatCurrency(
                  order.items.reduce((sum, item) => {
                    const a = assignments[item];
                    return a?.kaligadhId ? sum + (Number(a.makingCost) || 0) : sum;
                  }, 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-ghost btn-lg" onClick={onDone}>Skip All &amp; Finish</button>
            <button className="btn btn-accent btn-lg flex-1" disabled={saving} onClick={handleConfirm}>
              <UserCheck size={16} /> Confirm Assignments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
