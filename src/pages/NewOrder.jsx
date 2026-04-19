import { useState, useEffect, useRef } from 'react';
import { Upload, X, Receipt, Search, UserCheck, Calendar } from 'lucide-react';
import { ordersDB, activityDB } from '../db';
import { generateId, generateUUID, fileToBase64, todayISO, formatDate } from '../utils';
import { FormGroup, CheckboxGroup, Avatar } from '../components/UI';

function defaultDeliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function deriveCustomers(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.customerPhone?.trim() || o.customerName?.trim();
    if (!key) continue;
    if (!map[key]) map[key] = { name: o.customerName, phone: o.customerPhone || '' };
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

export default function NewOrder({ itemCategories, prefill, onSaved, onSaveAndAssign }) {
  const [form, setForm] = useState({
    customerName: prefill?.customerName || '',
    customerPhone: prefill?.customerPhone || '',
    billNo: '', billPhoto: null,
    totalAmount: '', discount: '', advanceAmount: '',
    note: '', items: [],
    deliveryDate: defaultDeliveryDate(),
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  // Customer search
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [useExisting, setUseExisting] = useState(!!prefill);
  const [custQuery, setCustQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Delivery date
  const [deliveryMode, setDeliveryMode] = useState('days');
  const [deliveryDays, setDeliveryDays] = useState('7');

  useEffect(() => {
    ordersDB.getAll().then(orders => setExistingCustomers(deriveCustomers(orders)));
  }, []);

  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recompute deliveryDate when mode=days and days value changes
  useEffect(() => {
    if (deliveryMode === 'days') {
      const n = Math.max(1, parseInt(deliveryDays) || 7);
      const d = new Date();
      d.setDate(d.getDate() + n);
      setForm(prev => ({ ...prev, deliveryDate: d.toISOString().split('T')[0] }));
    }
  }, [deliveryMode, deliveryDays]);

  const custMatches = custQuery.trim()
    ? existingCustomers.filter(c =>
        c.name.toLowerCase().includes(custQuery.toLowerCase()) ||
        c.phone.includes(custQuery)
      )
    : existingCustomers.slice(0, 6);

  function selectCustomer(c) {
    setForm(prev => ({ ...prev, customerName: c.name, customerPhone: c.phone }));
    setCustQuery('');
    setDropdownOpen(false);
  }

  function toggleUseExisting() {
    if (useExisting) {
      // turning off: clear customer fields
      setForm(prev => ({ ...prev, customerName: '', customerPhone: '' }));
      setCustQuery('');
    }
    setDropdownOpen(false);
    setUseExisting(v => !v);
  }

  const remaining = Math.max(0,
    (Number(form.totalAmount) || 0) - (Number(form.discount) || 0) - (Number(form.advanceAmount) || 0)
  );

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setPreview(b64);
    // Upload to Cloudinary via backend; falls back to base64 if Cloudinary not configured
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: b64 }),
      });
      const { url } = await res.json();
      setForm(prev => ({ ...prev, billPhoto: url }));
    } catch {
      setForm(prev => ({ ...prev, billPhoto: b64 }));
    }
  }

  function validate() {
    if (!form.customerName.trim()) return 'Customer name is required.';
    if (!form.customerPhone.trim()) return 'Customer phone is required.';
    if (!form.totalAmount || isNaN(Number(form.totalAmount))) return 'Total amount is required.';
    if (form.items.length === 0) return 'Select at least one item.';
    return null;
  }

  async function createOrder() {
    const err = validate();
    if (err) return alert(err);
    setSaving(true);
    const orderId = generateId();
    const advance = Number(form.advanceAmount) || 0;
    const order = {
      id: orderId,
      billNo: form.billNo.trim(),
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      billPhoto: form.billPhoto,
      totalAmount: Number(form.totalAmount),
      discount: Number(form.discount) || 0,
      advanceAmount: advance,
      remainingAmount: remaining,
      items: form.items,
      status: 'inProgress',
      note: form.note.trim(),
      deliveryDate: form.deliveryDate,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await ordersDB.save(order);
    if (advance > 0) {
      await activityDB.save({
        id: generateUUID(),
        type: 'revenue',
        subType: 'advance',
        amount: advance,
        description: `Advance received`,
        referenceId: orderId,
        referenceType: 'order',
        date: new Date().toISOString(),
      });
    }
    setSaving(false);
    return order;
  }

  async function handleSave() {
    const order = await createOrder();
    if (order) onSaved(order);
  }

  async function handleSaveAndAssign() {
    const order = await createOrder();
    if (order) onSaveAndAssign(order);
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <h2>New Order</h2>
        <p>Create a customer order and record bill details</p>
      </div>
      <div className="page-body">
        <div style={{ maxWidth: 700 }}>

          {/* Customer Info */}
          <div className="card card-pad mb-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 17 }}>Customer Information</div>
              {existingCustomers.length > 0 && (
                <button
                  type="button"
                  className={`btn btn-sm ${useExisting ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={toggleUseExisting}
                >
                  <UserCheck size={13} /> {useExisting ? 'Clear Selection' : 'Select Existing'}
                </button>
              )}
            </div>

            {/* Search dropdown — only when toggle is ON */}
            {useExisting && (
              <div ref={dropdownRef} style={{ position: 'relative', marginBottom: 14 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 32 }}
                    placeholder="Search existing customer by name or phone..."
                    value={custQuery}
                    onChange={e => { setCustQuery(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    autoFocus
                  />
                </div>
                {dropdownOpen && custMatches.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--paper)', border: '1px solid var(--paper-3)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', marginTop: 4, overflow: 'hidden' }}>
                    {custMatches.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => selectCustomer(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--paper-2)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <Avatar name={c.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.phone}</div>
                        </div>
                        <UserCheck size={14} style={{ marginLeft: 'auto', color: 'var(--ink-4)' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected customer preview strip */}
            {useExisting && form.customerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 8, marginBottom: 14 }}>
                <Avatar name={form.customerName} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{form.customerName}</div>
                  {form.customerPhone && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{form.customerPhone}</div>}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setForm(prev => ({ ...prev, customerName: '', customerPhone: '' })); setCustQuery(''); }}
                >
                  <X size={12} /> Clear
                </button>
              </div>
            )}

            {/* Name / phone — readonly when existing customer is selected */}
            <div className="grid-2">
              <FormGroup label="Customer Name" required>
                <input
                  className="form-input"
                  placeholder="Full name"
                  value={form.customerName}
                  onChange={e => !useExisting && f('customerName', e.target.value)}
                  readOnly={useExisting}
                  style={useExisting ? { background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'default' } : {}}
                />
              </FormGroup>
              <FormGroup label="Phone Number" required>
                <input
                  className="form-input"
                  placeholder="98XXXXXXXX"
                  value={form.customerPhone}
                  onChange={e => !useExisting && f('customerPhone', e.target.value)}
                  readOnly={useExisting}
                  style={useExisting ? { background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'default' } : {}}
                />
              </FormGroup>
            </div>
          </div>

          {/* Delivery Date */}
          <div className="card card-pad mb-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Calendar size={15} style={{ color: 'var(--ink-3)' }} />
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 17 }}>Delivery Date</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className={`btn btn-sm ${deliveryMode === 'days' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDeliveryMode('days')}
              >Days from today</button>
              <button
                type="button"
                className={`btn btn-sm ${deliveryMode === 'date' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDeliveryMode('date')}
              >Pick a date</button>
            </div>
            {deliveryMode === 'days' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={deliveryDays}
                    onChange={e => setDeliveryDays(e.target.value)}
                    style={{ width: 80, textAlign: 'center', fontFamily: 'DM Serif Display', fontSize: 18 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>days from today</span>
                </div>
                {form.deliveryDate && (
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', borderLeft: '1px solid var(--paper-3)', paddingLeft: 14 }}>
                    <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {formatDate(form.deliveryDate)}
                  </span>
                )}
              </div>
            ) : (
              <FormGroup label="Delivery Date">
                <input
                  className="form-input"
                  type="date"
                  value={form.deliveryDate || ''}
                  min={todayISO()}
                  onChange={e => f('deliveryDate', e.target.value)}
                  style={{ maxWidth: 220 }}
                />
              </FormGroup>
            )}
          </div>

          {/* Bill Details */}
          <div className="card card-pad mb-4">
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 17, marginBottom: 16 }}>Bill Details</div>

            <div className="grid-2 mb-4">
              <FormGroup label="Bill Number" hint="From the physical bill (optional)">
                <input className="form-input" placeholder="e.g. 3289" value={form.billNo} onChange={e => f('billNo', e.target.value)} />
              </FormGroup>
              <FormGroup label="Bill Photo" hint="Upload a photo of the physical bill">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1.5px dashed var(--paper-3)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>
                  <Upload size={14} />
                  {form.billPhoto ? 'Photo uploaded ✓' : 'Upload bill photo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </label>
              </FormGroup>
            </div>

            {preview && (
              <div style={{ marginBottom: 16, position: 'relative', display: 'inline-block' }}>
                <img src={preview} alt="Bill" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--paper-3)' }} />
                <button onClick={() => { setPreview(null); f('billPhoto', null); }}
                  style={{ position: 'absolute', top: -6, right: -6, background: 'var(--red)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={11} />
                </button>
              </div>
            )}

            <div className="grid-3">
              <FormGroup label="Total Amount (Rs.)" required>
                <input className="form-input" type="number" placeholder="0" value={form.totalAmount} onChange={e => f('totalAmount', e.target.value)} />
              </FormGroup>
              <FormGroup label="Discount (Rs.)">
                <input className="form-input" type="number" placeholder="0" value={form.discount} onChange={e => f('discount', e.target.value)} />
              </FormGroup>
              <FormGroup label="Advance Amount (Rs.)">
                <input className="form-input" type="number" placeholder="0" value={form.advanceAmount} onChange={e => f('advanceAmount', e.target.value)} />
              </FormGroup>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--paper-2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>REMAINING BALANCE</span>
              <span style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: remaining > 0 ? 'var(--accent)' : 'var(--green)' }}>
                Rs. {remaining.toLocaleString('en-NP')}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="card card-pad mb-4">
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 17, marginBottom: 6 }}>Items to Stitch</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>Select all items this customer needs</div>
            <CheckboxGroup options={itemCategories.map(i => i.name)} selected={form.items} onChange={v => f('items', v)} />
          </div>

          {/* Note */}
          <div className="card card-pad mb-6">
            <FormGroup label="Order Note" hint="Optional — any extra info about this order">
              <textarea className="form-textarea" placeholder="e.g. Urgent delivery, special design request..." value={form.note} onChange={e => f('note', e.target.value)} />
            </FormGroup>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="btn btn-ghost btn-lg" onClick={() => window.history.back()}>Cancel</button>
            <button className="btn btn-primary btn-lg flex-1" disabled={saving} onClick={handleSave}>
              <Receipt size={16} /> Save Order
            </button>
            <button className="btn btn-accent btn-lg flex-1" disabled={saving} onClick={handleSaveAndAssign}>
              Save & Assign Kaligadh →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
