import { useState } from 'react';
import { Upload, X, Receipt } from 'lucide-react';
import { ordersDB, activityDB } from '../db';
import { generateId, generateUUID, fileToBase64, todayISO, ITEM_CATEGORIES } from '../utils';
import { FormGroup, CheckboxGroup } from '../components/UI';

export default function NewOrder({ onSaved, onSaveAndAssign }) {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '',
    billNo: '', billPhoto: null,
    totalAmount: '', discount: '', advanceAmount: '',
    note: '', items: []
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const remaining = Math.max(0,
    (Number(form.totalAmount) || 0) - (Number(form.discount) || 0) - (Number(form.advanceAmount) || 0)
  );

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setForm({ ...form, billPhoto: b64 });
    setPreview(b64);
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
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await ordersDB.save(order);

    // Log advance as revenue in activity
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
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 17, marginBottom: 16 }}>Customer Information</div>
            <div className="grid-2">
              <FormGroup label="Customer Name" required>
                <input className="form-input" placeholder="Full name" value={form.customerName} onChange={e => f('customerName', e.target.value)} />
              </FormGroup>
              <FormGroup label="Phone Number" required>
                <input className="form-input" placeholder="98XXXXXXXX" value={form.customerPhone} onChange={e => f('customerPhone', e.target.value)} />
              </FormGroup>
            </div>
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
            <CheckboxGroup options={ITEM_CATEGORIES} selected={form.items} onChange={v => f('items', v)} />
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
