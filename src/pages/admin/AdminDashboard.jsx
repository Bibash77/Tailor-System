import { useState, useEffect, useCallback } from 'react';
import { LogOut, Users, ScanLine, TrendingUp, RefreshCw, ChevronDown, ChevronUp, Edit2, Check, X, CreditCard, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';
import { API_BASE } from '../../context/AuthContext';

function adminFetch(path, opts = {}) {
  const token = localStorage.getItem('admin_token');
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async r => {
    const data = await r.json();
    if (r.status === 401) { localStorage.removeItem('admin_token'); window.location.reload(); }
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatBox({ label, value, icon: Icon, color = '#1C1917' }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '20px 22px',
      border: '1.5px solid #E7E5E4', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <Icon size={16} style={{ color }} />
      </div>
      <div style={{ fontFamily: 'DM Serif Display', fontSize: 32, color }}>{value ?? '—'}</div>
    </div>
  );
}

// ─── Quota editor ─────────────────────────────────────────────────────────────
function QuotaEditor({ userId, quota, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [limit,   setLimit]   = useState(quota.monthlyLimit);
  const [price,   setPrice]   = useState(quota.price);
  const [saving,  setSaving]  = useState(false);

  async function save() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/quota`, {
        method: 'PATCH', body: { monthlyLimit: Number(limit), price: Number(price) },
      });
      setEditing(false);
      onSaved();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function resetUsed() {
    if (!window.confirm('Reset this user\'s scan usage to 0?')) return;
    await adminFetch(`/api/admin/users/${userId}/reset-quota`, { method: 'POST' });
    onSaved();
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color: '#57534E' }}>
          {quota.used}/{quota.monthlyLimit} used · Rs {quota.price}/mo
        </span>
        <button
          onClick={() => setEditing(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C', display: 'flex', alignItems: 'center' }}
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={resetUsed}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 11, fontWeight: 600 }}
        >
          Reset
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number" value={limit} onChange={e => setLimit(e.target.value)}
        style={{ width: 64, padding: '4px 8px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13 }}
        placeholder="Limit"
      />
      <span style={{ fontSize: 11, color: '#78716C' }}>scans ·</span>
      <span style={{ fontSize: 11, color: '#78716C' }}>Rs</span>
      <input
        type="number" value={price} onChange={e => setPrice(e.target.value)}
        style={{ width: 64, padding: '4px 8px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13 }}
        placeholder="Price"
      />
      <button onClick={save} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A' }}>
        <Check size={14} />
      </button>
      <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, onRefresh }) {
  const pct = Math.min(100, Math.round(((user.scanQuota?.used || 0) / (user.scanQuota?.monthlyLimit || 100)) * 100));

  return (
    <tr>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F4' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{user.shopName || '—'}</div>
        <div style={{ fontSize: 12, color: '#78716C' }}>{user.email}</div>
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: '#E7E5E4', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#DC2626' : '#16A34A', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, color: '#57534E', whiteSpace: 'nowrap' }}>
            {user.scanQuota?.used || 0}/{user.scanQuota?.monthlyLimit || 100}
          </span>
        </div>
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F4' }}>
        <QuotaEditor userId={user._id} quota={user.scanQuota} onSaved={onRefresh} />
      </td>
      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F4', fontSize: 12, color: '#78716C' }}>
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '—'}
      </td>
    </tr>
  );
}

// ─── Subscription row ─────────────────────────────────────────────────────────
function SubStatusBadge({ status }) {
  const cfg = {
    trial:   { bg: '#EFF6FF', color: '#1D4ED8', icon: Clock,         label: 'Trial' },
    active:  { bg: '#F0FDF4', color: '#15803D', icon: CheckCircle,   label: 'Active' },
    expired: { bg: '#FEF2F2', color: '#DC2626', icon: XCircle,       label: 'Expired' },
  }[status] || { bg: '#F5F5F4', color: '#78716C', icon: Clock, label: status };
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function SubscriptionRow({ user, onRefresh }) {
  const sub      = user.subscription || {};
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState(sub.monthlyFee || 500);
  const [method, setMethod] = useState('cash');
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [editFee, setEditFee] = useState(false);
  const [fee,     setFee]     = useState(sub.monthlyFee || 500);

  async function recordPayment(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminFetch(`/api/admin/users/${user._id}/subscription/payment`, {
        method: 'POST', body: { amount: Number(amount), method, note },
      });
      setPaying(false); setNote('');
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function saveFee() {
    await adminFetch(`/api/admin/users/${user._id}/subscription`, {
      method: 'PATCH', body: { monthlyFee: Number(fee) },
    });
    setEditFee(false); onRefresh();
  }

  const payments = [...(sub.payments || [])].reverse().slice(0, 3);

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', padding: '18px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{user.shopName || '—'}</div>
          <div style={{ fontSize: 12, color: '#78716C' }}>{user.email}</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SubStatusBadge status={sub.status} />
            {sub.status === 'trial' && sub.trialEndsAt && (
              <span style={{ fontSize: 12, color: '#78716C' }}>
                Trial ends: {new Date(sub.trialEndsAt).toLocaleDateString('en-IN')}
              </span>
            )}
            {sub.billedUntil && (
              <span style={{ fontSize: 12, color: '#78716C' }}>
                Paid until: {new Date(sub.billedUntil).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editFee ? (
            <>
              <span style={{ fontSize: 12, color: '#78716C' }}>Rs</span>
              <input type="number" value={fee} onChange={e => setFee(e.target.value)}
                style={{ width: 72, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13 }} />
              <span style={{ fontSize: 12, color: '#78716C' }}>/mo</span>
              <button onClick={saveFee} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A' }}><Check size={14} /></button>
              <button onClick={() => setEditFee(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={14} /></button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#57534E', fontWeight: 600 }}>Rs {sub.monthlyFee || 500}/mo</span>
              <button onClick={() => setEditFee(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C' }}><Edit2 size={12} /></button>
            </>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setPaying(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={13} /> Record Payment
          </button>
        </div>
      </div>

      {paying && (
        <form onSubmit={recordPayment} style={{ marginTop: 14, padding: '14px', background: '#FAFAF9', borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', display: 'block', marginBottom: 4 }}>Amount (Rs)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ width: 100, padding: '7px 10px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', display: 'block', marginBottom: 4 }}>Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13, background: 'white' }}>
              <option value="cash">Cash</option>
              <option value="esewa">eSewa</option>
              <option value="bank">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', display: 'block', marginBottom: 4 }}>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. April 2026"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 36 }}>
            {saving ? 'Saving…' : 'Confirm Payment'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setPaying(false)} style={{ height: 36 }}>Cancel</button>
        </form>
      )}

      {payments.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #F5F5F4', paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recent Payments</div>
          {payments.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#57534E', marginBottom: 3 }}>
              <span>{new Date(p.paidAt).toLocaleDateString('en-IN')} · {p.method}</span>
              <span style={{ fontWeight: 600 }}>Rs {p.amount} {p.note && <span style={{ fontWeight: 400, color: '#78716C' }}>· {p.note}</span>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Change password ──────────────────────────────────────────────────────────
function ChangePasswordPanel() {
  const [open,        setOpen]        = useState(false);
  const [current,     setCurrent]     = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState('');

  async function handleChange(e) {
    e.preventDefault();
    if (newPass !== confirm) { setMsg('Passwords do not match'); return; }
    setSaving(true); setMsg('');
    try {
      await adminFetch('/api/admin/auth/change-password', {
        method: 'POST', body: { currentPassword: current, newPassword: newPass },
      });
      setMsg('Password changed successfully');
      setCurrent(''); setNewPass(''); setConfirm('');
      setTimeout(() => setOpen(false), 1500);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
      >
        Change Admin Password
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <form onSubmit={handleChange} style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #F5F5F4' }}>
          <div style={{ paddingTop: 14 }} />
          {['Current Password', 'New Password', 'Confirm New Password'].map((label, i) => {
            const vals = [current, newPass, confirm];
            const setters = [setCurrent, setNewPass, setConfirm];
            return (
              <div key={label}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
                <input className="form-input" type="password" value={vals[i]} onChange={e => setters[i](e.target.value)} required />
              </div>
            );
          })}
          {msg && <div style={{ fontSize: 13, color: msg.includes('success') ? '#16A34A' : '#DC2626' }}>{msg}</div>}
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard({ onLogout }) {
  const [stats,    setStats]    = useState(null);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('subscriptions');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users'),
      ]);
      setStats(s);
      setUsers(u.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9' }}>
      {/* Header */}
      <div style={{ background: '#1C1917', color: 'white', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 20 }}>Tailor Manager · Admin</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={load}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={onLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <StatBox label="Total Users"      value={stats?.userCount}      icon={Users}      color="#1C1917" />
          <StatBox label="Scans This Month" value={stats?.scansThisMonth} icon={ScanLine}   color="#2563EB" />
          <StatBox label="Total Scans"      value={stats?.totalScans}     icon={ScanLine}   color="#57534E" />
          <StatBox label="Est. Revenue (Rs)" value={stats?.estimatedRevenue != null ? `Rs ${stats.estimatedRevenue}` : '—'} icon={TrendingUp} color="#16A34A" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E7E5E4', paddingBottom: 0 }}>
          {[['subscriptions', 'Subscriptions'], ['users', 'Scan Quotas'], ['settings', 'Admin Settings']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px', fontSize: 14, fontWeight: 600,
                color: tab === id ? '#1C1917' : '#78716C',
                borderBottom: tab === id ? '2px solid #1C1917' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Subscriptions tab */}
        {tab === 'subscriptions' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#78716C' }}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#78716C' }}>No users yet</div>
          ) : (
            <div>
              {users.map(u => <SubscriptionRow key={u._id} user={u} onRefresh={load} />)}
            </div>
          )
        )}

        {/* Scan quotas tab */}
        {tab === 'users' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#78716C' }}>Loading…</div>
          ) : (
            <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAF9' }}>
                    {['Shop / Email', 'Usage', 'Quota & Price', 'Joined'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #E7E5E4' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#78716C' }}>No users yet</td></tr>
                  ) : users.map(u => (
                    <UserRow key={u._id} user={u} onRefresh={load} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Settings tab */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 480 }}>
            <ChangePasswordPanel />
          </div>
        )}
      </div>
    </div>
  );
}
