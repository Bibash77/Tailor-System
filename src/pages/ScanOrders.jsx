import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, ImagePlus, Check, X, Loader, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { scanQueueDB } from '../db';
import { authFetch } from '../context/AuthContext';

// ─── Thumbnail helper (client-side resize before upload) ──────────────────────
function resizeImage(file, maxPx = 1600, thumbPx = 220) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const make = (size, quality) => {
        const ratio = Math.min(size / img.width, size / img.height, 1);
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', quality);
      };
      resolve({ full: make(maxPx, 0.85), thumb: make(thumbPx, 0.7) });
    };
    img.src = url;
  });
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ item, itemCategories, onConfirm, onClose }) {
  const ex = item.extracted || {};
  const [form, setForm] = useState({
    customerName:    ex.customerName    || '',
    customerPhone:   ex.customerPhone   || '',
    billNo:          ex.billNo          || '',
    totalAmount:     ex.totalAmount     ?? '',
    advanceAmount:   ex.advanceAmount   ?? '',
    remainingAmount: ex.remainingAmount ?? '',
    deliveryDate:    ex.deliveryDate    || '',
    items:           ex.items           || [],
    note:            ex.note            || '',
    measurements:    ex.measurements    || null,
  });
  const [saving, setSaving]   = useState(false);
  const [showMeas, setShowMeas] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.customerName) return alert('Customer name is required');
    setSaving(true);
    try {
      await onConfirm(item._id, {
        orderData: {
          customerName:    form.customerName.trim(),
          customerPhone:   form.customerPhone.trim(),
          billNo:          form.billNo.trim(),
          totalAmount:     Number(form.totalAmount)     || 0,
          advanceAmount:   Number(form.advanceAmount)   || 0,
          remainingAmount: Number(form.remainingAmount) || 0,
          deliveryDate:    form.deliveryDate,
          items:           form.items,
          note:            form.note,
          measurements:    form.measurements,
        },
      });
    } finally { setSaving(false); }
  }

  const hasMeas = form.measurements &&
    Object.values(form.measurements.shirt || {}).some(v => v != null);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: '24px 20px 32px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 20 }}>Confirm Order</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C' }}><X size={20} /></button>
        </div>

        {/* Thumb preview */}
        {item.thumb && (
          <img src={item.thumb} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Customer Name *">
            <input className="form-input" value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Full name" autoFocus />
          </Row>
          <Row label="Phone">
            <input className="form-input" value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} placeholder="98XXXXXXXX" />
          </Row>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Row label="Bill No">
              <input className="form-input" value={form.billNo} onChange={e => set('billNo', e.target.value)} placeholder="e.g. 3435" />
            </Row>
            <Row label="Delivery Date">
              <input className="form-input" type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} />
            </Row>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Row label="Total (Rs)">
              <input className="form-input" type="number" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} />
            </Row>
            <Row label="Advance (Rs)">
              <input className="form-input" type="number" value={form.advanceAmount} onChange={e => set('advanceAmount', e.target.value)} />
            </Row>
            <Row label="Remaining (Rs)">
              <input className="form-input" type="number" value={form.remainingAmount} onChange={e => set('remainingAmount', e.target.value)} />
            </Row>
          </div>

          {/* Items */}
          <Row label="Items">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {itemCategories.map(cat => {
                const sel = form.items.includes(cat.name);
                return (
                  <button key={cat.name} type="button"
                    onClick={() => set('items', sel ? form.items.filter(i => i !== cat.name) : [...form.items, cat.name])}
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                      background: sel ? 'var(--accent)' : 'transparent',
                      color:      sel ? 'white'         : 'var(--ink-3)',
                      borderColor: sel ? 'var(--accent)' : 'var(--paper-3)' }}>
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </Row>

          <Row label="Note">
            <textarea className="form-input" rows={2} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Any note from bill…" style={{ resize: 'none' }} />
          </Row>

          {/* Measurements collapsible */}
          {hasMeas && (
            <div style={{ border: '1.5px solid var(--paper-2)', borderRadius: 10, overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowMeas(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--paper-1)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Measurements (from scan)
                {showMeas ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showMeas && (
                <div style={{ padding: '12px 14px', fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(form.measurements?.shirt || {}).filter(([k]) => k !== 'shirtDesign').map(([k, v]) =>
                    v != null ? <div key={k}><span style={{ color: 'var(--ink-4)' }}>Shirt {k}:</span> <b>{v}</b></div> : null
                  )}
                  {Object.entries(form.measurements?.pant || {}).filter(([k]) => k !== 'pantDesign').map(([k, v]) =>
                    v != null ? <div key={k}><span style={{ color: 'var(--ink-4)' }}>Pant {k}:</span> <b>{v}</b></div> : null
                  )}
                  {form.measurements?.pantDesign && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--ink-4)' }}>Design:</span> <b>{form.measurements.pantDesign}</b></div>}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 20, padding: '14px', fontSize: 15 }}
          disabled={saving}
          onClick={submit}
        >
          {saving ? <Loader size={16} className="spin" /> : <Check size={16} />}
          {saving ? 'Creating Order…' : 'Confirm & Create Order'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Queue item card ──────────────────────────────────────────────────────────
function QueueCard({ item, onConfirm, onDiscard, onRetry }) {
  const ex = item.extracted || {};

  if (item.status === 'processing') {
    return (
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {item.thumb
          ? <img src={item.thumb} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 60, height: 60, borderRadius: 8, background: 'var(--paper-2)', flexShrink: 0 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Scanning…</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>AI is reading your bill</div>
        </div>
        <Loader size={18} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
      </div>
    );
  }

  if (item.status === 'failed') {
    return (
      <div className="card card-pad" style={{ borderLeft: '3px solid #DC2626' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {item.thumb && <img src={item.thumb} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertCircle size={14} style={{ color: '#DC2626' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>Scan Failed</span>
            </div>
            <div style={{ fontSize: 12, color: '#78716C', marginBottom: 10 }}>
              {item.error || 'Could not read the bill. Please try again.'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onRetry(item)}>
                <RotateCcw size={13} /> Retry
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => onDiscard(item._id)}>
                <X size={13} /> Discard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ready
  return (
    <div className="card card-pad" style={{ borderLeft: '3px solid var(--green)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {item.thumb && <img src={item.thumb} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ex.customerName || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>No name found</span>}
            </div>
            {ex.billNo && <span style={{ fontSize: 11, background: 'var(--paper-2)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>#{ex.billNo}</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, flexWrap: 'wrap' }}>
            {ex.totalAmount  && <span>Rs {ex.totalAmount.toLocaleString('en-IN')}</span>}
            {ex.advanceAmount && <span>Adv: Rs {ex.advanceAmount.toLocaleString('en-IN')}</span>}
            {ex.deliveryDate && <span>Due: {ex.deliveryDate}</span>}
            {ex.items?.length > 0 && <span>{ex.items.join(', ')}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onConfirm(item)}>
              <Check size={13} /> Confirm
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => onDiscard(item._id)}>
              <X size={13} /> Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScanOrders({ itemCategories = [] }) {
  const [queue,          setQueue]          = useState([]);
  const [quota,          setQuota]          = useState(null);
  const [confirmingItem, setConfirmingItem] = useState(null);
  const cameraRef  = useRef();
  const galleryRef = useRef();

  const loadData = useCallback(async () => {
    const [q, qt] = await Promise.all([scanQueueDB.list(), scanQueueDB.quota()]);
    setQueue(q.items || []);
    setQuota(qt);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleFile(file) {
    if (!file) return;

    const { full, thumb } = await resizeImage(file);

    // Add processing placeholder to top of queue immediately
    const tempId = `temp_${Date.now()}`;
    setQueue(q => [{ _id: tempId, status: 'processing', thumb }, ...q]);

    const res = await scanQueueDB.scan({
      image: full,
      thumb,
      itemCategories: itemCategories.map(i => i.name),
    });

    if (res.quotaExceeded) {
      setQueue(q => q.filter(i => i._id !== tempId));
      alert(res.error);
      return;
    }

    // Replace temp with real result
    setQueue(q => q.map(i =>
      i._id === tempId
        ? { _id: res.id, status: res.status, extracted: res.extracted, error: res.error, thumb }
        : i
    ));

    // Refresh quota display
    scanQueueDB.quota().then(setQuota).catch(() => {});
  }

  async function handleConfirm(id, body) {
    await scanQueueDB.confirm(id, body);
    setQueue(q => q.filter(i => i._id !== id && String(i._id) !== String(id)));
    setConfirmingItem(null);
    scanQueueDB.quota().then(setQuota).catch(() => {});
  }

  async function handleDiscard(id) {
    if (!window.confirm('Discard this scanned bill?')) return;
    await scanQueueDB.discard(id).catch(() => {});
    setQueue(q => q.filter(i => i._id !== id && String(i._id) !== String(id)));
  }

  async function handleRetry(item) {
    // Remove failed item, trigger camera again
    setQueue(q => q.filter(i => i._id !== item._id && String(i._id) !== String(item._id)));
    await scanQueueDB.discard(item._id).catch(() => {});
    galleryRef.current?.click();
  }

  const used      = quota?.used          ?? 0;
  const limit     = quota?.monthlyLimit  ?? 100;
  const remaining = quota?.remaining     ?? (limit - used);
  const pct       = Math.min(100, Math.round((used / limit) * 100));
  const low       = remaining <= 10;

  return (
    <div>
      <div className="page-header">
        <h2>Scan Orders</h2>
        <p>Photograph a bill to queue it — review and confirm to create the order</p>
      </div>

      <div className="page-body">

        {/* Quota bar */}
        <div className="card card-pad mb-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Scan Credits</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Resets every month · Rs {quota?.price ?? 100}/month</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 26, color: low ? '#DC2626' : 'var(--accent)', lineHeight: 1 }}>{remaining}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>remaining of {limit}</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--paper-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: low ? '#DC2626' : 'var(--green)', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          {low && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>Only {remaining} scan{remaining !== 1 ? 's' : ''} left this month</div>}
        </div>

        {/* Capture buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <button
            className="btn btn-primary"
            style={{ padding: '18px', fontSize: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: 'auto' }}
            onClick={() => cameraRef.current?.click()}
            disabled={remaining <= 0}
          >
            <Camera size={28} />
            Take Photo
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '18px', fontSize: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: 'auto', border: '2px dashed var(--paper-3)' }}
            onClick={() => galleryRef.current?.click()}
            disabled={remaining <= 0}
          >
            <ImagePlus size={28} />
            Choose File
          </button>
        </div>

        {/* Hidden inputs */}
        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
        <input ref={galleryRef} type="file" accept="image/*"                        style={{ display: 'none' }} onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />

        {/* Queue list */}
        {queue.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pending ({queue.filter(i => i.status === 'ready').length} ready · {queue.filter(i => i.status === 'processing').length} scanning)
            </div>
            {queue.map(item => (
              <QueueCard
                key={item._id}
                item={item}
                onConfirm={setConfirmingItem}
                onDiscard={handleDiscard}
                onRetry={handleRetry}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-4)' }}>
            <Camera size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>No pending scans</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Take a photo of a bill to get started</div>
          </div>
        )}

      </div>

      {/* Confirm modal */}
      {confirmingItem && (
        <ConfirmModal
          item={confirmingItem}
          itemCategories={itemCategories}
          onConfirm={handleConfirm}
          onClose={() => setConfirmingItem(null)}
        />
      )}
    </div>
  );
}
