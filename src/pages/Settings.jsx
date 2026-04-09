import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { kaligadhsDB, settingsDB } from '../db';
import { generateUUID, ITEM_CATEGORIES, DEFAULT_MAKING_COSTS } from '../utils';
import { Modal, FormGroup, SectionHeader, Badge } from '../components/UI';

export default function Settings() {
  const [kaligadhs, setKaligadhs] = useState([]);
  const [costs, setCosts] = useState(DEFAULT_MAKING_COSTS);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingCosts, setEditingCosts] = useState(false);
  const [draftCosts, setDraftCosts] = useState({});
  const [form, setForm] = useState({ name: '', specialties: [] });

  useEffect(() => { load(); }, []);

  async function load() {
    const ks = await kaligadhsDB.getAll();
    setKaligadhs(ks);
    const savedCosts = await settingsDB.get('makingCosts');
    if (savedCosts) setCosts(savedCosts);
  }

  async function saveKaligadh() {
    if (!form.name.trim() || form.specialties.length === 0) return alert('Name and at least one specialty required.');
    const k = editing
      ? { ...editing, name: form.name, specialties: form.specialties }
      : { id: generateUUID(), name: form.name.trim(), specialties: form.specialties, totalDue: 0, lastPaidDate: null };
    await kaligadhsDB.save(k);
    setShowAdd(false); setEditing(null); setForm({ name: '', specialties: [] });
    load();
  }

  async function deleteKaligadh(id) {
    if (window.confirm('Delete this Kaligadh?')) { await kaligadhsDB.delete(id); load(); }
  }

  function openEdit(k) {
    setEditing(k);
    setForm({ name: k.name, specialties: k.specialties });
    setShowAdd(true);
  }

  async function saveCosts() {
    await settingsDB.set('makingCosts', draftCosts);
    setCosts(draftCosts);
    setEditingCosts(false);
  }

  const toggleSpecialty = (s) => {
    const cur = form.specialties;
    setForm({ ...form, specialties: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] });
  };

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure workers and making costs before creating orders</p>
      </div>
      <div className="page-body">

        {/* Making Costs */}
        <div className="card card-pad mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Making Costs</div>
              <div className="text-sm text-muted mt-1">Default cost per item category</div>
            </div>
            {!editingCosts
              ? <button className="btn btn-ghost btn-sm" onClick={() => { setDraftCosts({ ...costs }); setEditingCosts(true); }}><Edit2 size={13} /> Edit</button>
              : <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingCosts(false)}><X size={13} /> Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveCosts}><Check size={13} /> Save</button>
                </div>
            }
          </div>
          <div className="grid-2">
            {ITEM_CATEGORIES.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1.5px solid var(--paper-3)', borderRadius: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{cat}</span>
                {editingCosts
                  ? <input
                      type="number"
                      style={{ width: 90, padding: '5px 8px', border: '1.5px solid var(--ink)', borderRadius: 6, fontFamily: 'DM Sans', fontSize: 14, textAlign: 'right' }}
                      value={draftCosts[cat] || 0}
                      onChange={e => setDraftCosts({ ...draftCosts, [cat]: Number(e.target.value) })}
                    />
                  : <span style={{ fontFamily: 'DM Serif Display', fontSize: 17, color: 'var(--accent)' }}>Rs. {costs[cat]}</span>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Kaligadh List */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ padding: '18px 20px', borderBottom: '1px solid var(--paper-3)' }}>
            <div>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Kaligadh (Workers)</div>
              <div className="text-sm text-muted mt-1">{kaligadhs.length} worker{kaligadhs.length !== 1 ? 's' : ''} registered</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setForm({ name: '', specialties: [] }); setShowAdd(true); }}>
              <Plus size={14} /> Add Worker
            </button>
          </div>

          {kaligadhs.length === 0
            ? <div className="empty-state"><p>No workers added yet. Add your first Kaligadh above.</p></div>
            : <table>
                <thead><tr>
                  <th>Name</th>
                  <th>Specialties</th>
                  <th>Total Due</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {kaligadhs.map(k => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 600 }}>{k.name}</td>
                      <td>{k.specialties.map(s => <span key={s} className="badge badge-blue" style={{ marginRight: 4 }}>{s}</span>)}</td>
                      <td style={{ fontFamily: 'DM Serif Display', color: k.totalDue > 0 ? 'var(--accent)' : 'var(--ink-3)' }}>Rs. {k.totalDue || 0}</td>
                      <td>
                        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(k); }}><Edit2 size={13} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); deleteKaligadh(k.id); }} style={{ color: 'var(--red)' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>

      {showAdd && (
        <Modal
          title={editing ? 'Edit Kaligadh' : 'Add Kaligadh'}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveKaligadh}>Save</button>
          </>}
        >
          <FormGroup label="Full Name" required>
            <input className="form-input" placeholder="e.g. Ramesh Thapa" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </FormGroup>
          <FormGroup label="Specialties" required hint="Select all categories this worker can handle">
            <div className="checkbox-group">
              {ITEM_CATEGORIES.map(s => (
                <div key={s} className={`checkbox-item ${form.specialties.includes(s) ? 'checked' : ''}`} onClick={() => toggleSpecialty(s)}>{s}</div>
              ))}
            </div>
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}
