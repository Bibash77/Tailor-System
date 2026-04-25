import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LogOut, Users, ScanLine, TrendingUp, RefreshCw, ChevronDown, ChevronUp,
  Search, Edit2, Check, X, Trash2, ShieldCheck, ShieldOff, RotateCcw,
  Plus, Store, AlertTriangle, Clock, CheckCircle, XCircle, Gift, Settings,
  CreditCard, UserCheck, UserX, Building2,
} from 'lucide-react';
import { API_BASE } from '../../context/AuthContext';

// ─── API helper ───────────────────────────────────────────────────────────────
function adminFetch(path, opts = {}) {
  const token = localStorage.getItem('admin_token');
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }).then(async r => {
    const data = await r.json();
    if (r.status === 401) { localStorage.removeItem('admin_token'); window.location.reload(); }
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  const colors = {
    green:  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
    red:    { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    yellow: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    blue:   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    gray:   { bg: '#F5F5F4', text: '#57534E', border: '#E7E5E4' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color = '#1C1917', sub }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '18px 20px', border: '1.5px solid #E7E5E4', flex: '1 1 160px', minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color, lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#78716C', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Tab({ id, label, icon: Icon, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      display: 'flex', alignItems: 'center', gap: 7,
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '11px 16px', fontSize: 13, fontWeight: 600,
      color: active ? '#1C1917' : '#78716C',
      borderBottom: active ? '2px solid #1C1917' : '2px solid transparent',
      marginBottom: -2, transition: 'color 0.15s',
    }}>
      <Icon size={14} /> {label}
    </button>
  );
}

// ─── User status/role helpers ─────────────────────────────────────────────────
function statusBadge(s) {
  if (s === 'active')    return <Badge color="green"><CheckCircle size={10} /> Active</Badge>;
  if (s === 'suspended') return <Badge color="red"><XCircle size={10} /> Suspended</Badge>;
  return <Badge color="gray">{s}</Badge>;
}
function roleBadge(r) {
  if (r === 'shop_admin') return <Badge color="blue"><ShieldCheck size={10} /> Admin</Badge>;
  return <Badge color="gray">Associate</Badge>;
}
function subBadge(s) {
  if (s === 'active')  return <Badge color="green">Active</Badge>;
  if (s === 'trial')   return <Badge color="yellow"><Clock size={10} /> Trial</Badge>;
  if (s === 'expired') return <Badge color="red"><AlertTriangle size={10} /> Expired</Badge>;
  return <Badge color="gray">{s}</Badge>;
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({ user, shops, onSave, onClose }) {
  const [form, setForm] = useState({
    role:           user.role           || 'shop_admin',
    status:         user.status         || 'active',
    freeScanLimit:  user.scanQuota?.freeScanLimit ?? 20,
    paidPlanLimit:  user.scanQuota?.paidPlanLimit ?? 0,
    monthlyCharge:  user.scanQuota?.monthlyCharge ?? 500,
    billingStatus:  user.scanQuota?.billingStatus ?? 'active',
    shopId:         user.shopId || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try { await onSave(user._id, form); onClose(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const fld = (label, key, type = 'text', options) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {options ? (
        <select value={form[key]} onChange={e => set(key, e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, background: 'white' }}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, boxSizing: 'border-box' }} />
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, padding: '28px 24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 20 }}>Edit User</div>
            <div style={{ fontSize: 12, color: '#78716C' }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {fld('Role', 'role', 'text', [['shop_admin', 'Shop Admin'], ['associate', 'Associate']])}
            {fld('Account Status', 'status', 'text', [['active', 'Active'], ['suspended', 'Suspended']])}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4, borderTop: '1px solid #F5F5F4', paddingTop: 12 }}>
            Scan Quota
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {fld('Free Scans / Month', 'freeScanLimit', 'number')}
            {fld('Paid Extra Scans', 'paidPlanLimit', 'number')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {fld('Monthly Charge (Rs)', 'monthlyCharge', 'number')}
            {fld('Billing Status', 'billingStatus', 'text', [
              ['active', 'Active'], ['unpaid', 'Unpaid'], ['grace', 'Grace Period'], ['suspended', 'Suspended'],
            ])}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4, borderTop: '1px solid #F5F5F4', paddingTop: 12 }}>
            Shop Assignment
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Shop</label>
            <select value={form.shopId} onChange={e => set('shopId', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, background: 'white' }}>
              <option value="">— None —</option>
              {shops.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Grant Scans Modal ────────────────────────────────────────────────────────
function GrantScansModal({ user, onSave, onClose }) {
  const [scans, setScans] = useState(10);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try { await onSave(user._id, scans); onClose(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 340, padding: '28px 24px' }}>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 20, marginBottom: 4 }}>Grant Extra Scans</div>
        <div style={{ fontSize: 12, color: '#78716C', marginBottom: 20 }}>{user.email}</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Number of scans to grant</label>
        <input type="number" value={scans} min={1} onChange={e => setScans(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E7E5E4', fontSize: 15, boxSizing: 'border-box', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Saving…' : 'Grant'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────
function PaymentModal({ user, onSave, onClose }) {
  const defaultAmt = user.scanQuota?.monthlyCharge ?? user.subscription?.monthlyFee ?? 500;
  const [amount, setAmount] = useState(defaultAmt);
  const [method, setMethod] = useState('cash');
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(user._id, { amount: Number(amount), method, note }); onClose(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 380, padding: '28px 24px' }}>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 20, marginBottom: 4 }}>Record Payment</div>
        <div style={{ fontSize: 12, color: '#78716C', marginBottom: 20 }}>{user.email} · {user.shopName}</div>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Amount (Rs)', 'number', amount, setAmount],
          ].map(([lbl, type, val, setter]) => (
            <div key={lbl}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{lbl}</label>
              <input type={type} value={val} onChange={e => setter(e.target.value)} required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, background: 'white' }}>
              {[['cash','Cash'],['esewa','eSewa'],['bank','Bank Transfer'],['other','Other']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. April 2026"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Saving…' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ stats, users, onRefresh }) {
  const nearQuotaUsers = users.filter(u => u.scanQuota?.nearQuota && u.status !== 'suspended');
  const recentUsers    = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div>
      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Total Users"     value={stats?.totalUsers}      icon={Users}      color="#1C1917" />
        <StatCard label="Active Users"    value={stats?.activeUsers}     icon={UserCheck}  color="#16A34A" />
        <StatCard label="Total Shops"     value={stats?.totalShops}      icon={Building2}  color="#2563EB" />
        <StatCard label="Scans This Month" value={stats?.scansThisMonth} icon={ScanLine}   color="#7C3AED" />
        <StatCard label="Expected Revenue" value={stats?.expectedRevenue != null ? `Rs ${stats.expectedRevenue.toLocaleString('en-IN')}` : '—'} icon={TrendingUp} color="#16A34A" sub="sum of all monthly charges" />
        <StatCard label="Suspended"       value={stats?.suspendedUsers}  icon={UserX}      color="#DC2626" />
        <StatCard label="Near Quota (≤3)" value={stats?.nearQuota}       icon={AlertTriangle} color="#D97706" />
        <StatCard label="Expired Sub"     value={stats?.expiredSub}      icon={XCircle}    color="#DC2626" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Near quota users */}
        <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F5F5F4', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertTriangle size={14} style={{ color: '#D97706' }} /> Near Quota Limit
          </div>
          {nearQuotaUsers.length === 0 ? (
            <div style={{ padding: '24px 18px', color: '#78716C', fontSize: 13, textAlign: 'center' }}>All users have sufficient scans</div>
          ) : nearQuotaUsers.map(u => (
            <div key={u._id} style={{ padding: '10px 18px', borderBottom: '1px solid #FAFAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.shopName || u.email}</div>
                <div style={{ fontSize: 11, color: '#78716C' }}>{u.email}</div>
              </div>
              <Badge color="yellow">{u.scanQuota?.remaining} left</Badge>
            </div>
          ))}
        </div>

        {/* Recent registrations */}
        <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F5F5F4', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Users size={14} style={{ color: '#2563EB' }} /> Recent Registrations
          </div>
          {recentUsers.map(u => (
            <div key={u._id} style={{ padding: '10px 18px', borderBottom: '1px solid #FAFAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.shopName || u.email}</div>
                <div style={{ fontSize: 11, color: '#78716C' }}>{u.email}</div>
              </div>
              <div style={{ fontSize: 11, color: '#78716C' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ users, shops, onRefresh }) {
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('all');
  const [editUser,    setEditUser]    = useState(null);
  const [grantUser,   setGrantUser]   = useState(null);
  const [payUser,     setPayUser]     = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(null);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.shopName || '').toLowerCase().includes(q);
    const matchFilter =
      filter === 'all'       ? true :
      filter === 'active'    ? u.status === 'active' :
      filter === 'suspended' ? u.status === 'suspended' :
      filter === 'nearquota' ? u.scanQuota?.nearQuota :
      filter === 'expired'   ? u.subscription?.status === 'expired' : true;
    return matchSearch && matchFilter;
  });

  async function handleEdit(id, form) {
    await adminFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: form });
    onRefresh();
  }
  async function handleToggle(u) {
    const status = u.status === 'active' ? 'suspended' : 'active';
    await adminFetch(`/api/admin/users/${u._id}`, { method: 'PATCH', body: { status } });
    onRefresh();
  }
  async function handleResetQuota(u) {
    await adminFetch(`/api/admin/users/${u._id}/reset-quota`, { method: 'POST' });
    onRefresh();
  }
  async function handleGrant(id, scans) {
    await adminFetch(`/api/admin/users/${id}/grant-scans`, { method: 'POST', body: { scans } });
    onRefresh();
  }
  async function handlePayment(id, body) {
    await adminFetch(`/api/admin/users/${id}/subscription/payment`, { method: 'POST', body });
    onRefresh();
  }
  async function handleDelete(u) {
    await adminFetch(`/api/admin/users/${u._id}`, { method: 'DELETE' });
    setConfirmDel(null);
    onRefresh();
  }

  const TH = ({ children }) => (
    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1.5px solid #E7E5E4', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
  const TD = ({ children, style }) => (
    <td style={{ padding: '11px 14px', borderBottom: '1px solid #FAFAF9', verticalAlign: 'middle', ...style }}>
      {children}
    </td>
  );

  return (
    <div>
      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#A8A29E' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search email or shop…"
            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1.5px solid #E7E5E4', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
        {[['all','All'],['active','Active'],['suspended','Suspended'],['nearquota','Near Quota'],['expired','Expired Sub']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === v ? '#1C1917' : 'white',
              color:      filter === v ? 'white'   : '#57534E',
              borderColor: filter === v ? '#1C1917' : '#E7E5E4',
            }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead style={{ background: '#FAFAF9' }}>
            <tr>
              <TH>User / Shop</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Scans Used</TH>
              <TH>Subscription</TH>
              <TH>Charge / mo</TH>
              <TH>Joined</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#78716C', fontSize: 13 }}>No users found</td></tr>
            ) : filtered.map(u => {
              const q   = u.scanQuota || {};
              const pct = Math.min(100, Math.round((q.used / Math.max(1, q.freeScanLimit + (q.paidPlanLimit || 0))) * 100));
              return (
                <tr key={u._id} style={{ background: u.status === 'suspended' ? '#FFFBEB' : 'white' }}>
                  <TD>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.shopName || '—'}</div>
                    <div style={{ fontSize: 11, color: '#78716C' }}>{u.email}</div>
                    {u.shop && <div style={{ fontSize: 10, color: '#A8A29E' }}>{u.shop.name}</div>}
                  </TD>
                  <TD>{roleBadge(u.role)}</TD>
                  <TD>{statusBadge(u.status)}</TD>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 72, height: 5, background: '#F5F5F4', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#16A34A', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#57534E', whiteSpace: 'nowrap' }}>
                        {q.used || 0}/{(q.freeScanLimit || 20) + (q.paidPlanLimit || 0)}
                      </span>
                    </div>
                    {q.nearQuota && <div style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>⚠ {q.remaining} left</div>}
                  </TD>
                  <TD>{subBadge(u.subscription?.status)}</TD>
                  <TD style={{ fontSize: 13, fontWeight: 600 }}>Rs {q.monthlyCharge || 500}</TD>
                  <TD style={{ fontSize: 12, color: '#78716C', whiteSpace: 'nowrap' }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                      <ActionBtn icon={Edit2}     title="Edit"          color="#2563EB" onClick={() => setEditUser(u)} />
                      <ActionBtn icon={CreditCard} title="Record payment" color="#16A34A" onClick={() => setPayUser(u)} />
                      <ActionBtn icon={Gift}       title="Grant scans"   color="#7C3AED" onClick={() => setGrantUser(u)} />
                      <ActionBtn icon={RotateCcw}  title="Reset quota"   color="#D97706" onClick={() => handleResetQuota(u)} />
                      <ActionBtn
                        icon={u.status === 'active' ? ShieldOff : ShieldCheck}
                        title={u.status === 'active' ? 'Suspend' : 'Activate'}
                        color={u.status === 'active' ? '#DC2626' : '#16A34A'}
                        onClick={() => handleToggle(u)}
                      />
                      <ActionBtn icon={Trash2} title="Delete" color="#DC2626" onClick={() => setConfirmDel(u)} />
                    </div>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editUser  && <EditUserModal user={editUser}  shops={shops} onSave={handleEdit}    onClose={() => setEditUser(null)} />}
      {grantUser && <GrantScansModal user={grantUser}              onSave={handleGrant}   onClose={() => setGrantUser(null)} />}
      {payUser   && <PaymentModal    user={payUser}                onSave={handlePayment} onClose={() => setPayUser(null)} />}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '28px 24px', maxWidth: 360, width: '100%' }}>
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 20, marginBottom: 8 }}>Delete User?</div>
            <div style={{ fontSize: 13, color: '#78716C', marginBottom: 20 }}>
              This will permanently delete <strong>{confirmDel.email}</strong> and all their data. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDel)} className="btn" style={{ flex: 1, background: '#DC2626', color: 'white', border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, title, color, onClick }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 7, border: `1px solid ${color}22`,
      background: `${color}0d`, color, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', flexShrink: 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}0d`; }}
    >
      <Icon size={13} />
    </button>
  );
}

// ─── Shops Tab ────────────────────────────────────────────────────────────────
function ShopsTab({ shops, onRefresh }) {
  const [expanded, setExpanded] = useState({});
  const [newName,  setNewName]  = useState('');
  const [creating, setCreating] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [editName, setEditName] = useState('');

  async function createShop(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try { await adminFetch('/api/admin/shops', { method: 'POST', body: { name: newName.trim() } }); setNewName(''); onRefresh(); }
    catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function saveEdit(id) {
    await adminFetch(`/api/admin/shops/${id}`, { method: 'PATCH', body: { name: editName.trim() } });
    setEditId(null); onRefresh();
  }

  return (
    <div>
      {/* Create shop */}
      <form onSubmit={createShop} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New shop name…"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1.5px solid #E7E5E4', fontSize: 13 }} />
        <button type="submit" disabled={creating} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Create Shop
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shops.length === 0 && <div style={{ textAlign: 'center', padding: 48, color: '#78716C' }}>No shops yet</div>}
        {shops.map(shop => (
          <div key={shop._id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpanded(e => ({ ...e, [shop._id]: !e[shop._id] }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={17} style={{ color: '#2563EB' }} />
                </div>
                {editId === shop._id ? (
                  <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #D6D3D1', fontSize: 13 }} />
                    <button onClick={() => saveEdit(shop._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A' }}><Check size={15} /></button>
                    <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={15} /></button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{shop.name}</div>
                    <div style={{ fontSize: 11, color: '#78716C' }}>{shop.users?.length || 0} user{shop.users?.length !== 1 ? 's' : ''} · Created {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN') : '—'}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={e => { e.stopPropagation(); setEditId(shop._id); setEditName(shop.name); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C', display: 'flex' }}>
                  <Edit2 size={13} />
                </button>
                {expanded[shop._id] ? <ChevronUp size={15} style={{ color: '#78716C' }} /> : <ChevronDown size={15} style={{ color: '#78716C' }} />}
              </div>
            </div>

            {expanded[shop._id] && (
              <div style={{ borderTop: '1px solid #F5F5F4' }}>
                {(shop.users || []).length === 0 ? (
                  <div style={{ padding: '16px 18px', color: '#78716C', fontSize: 13 }}>No users in this shop yet</div>
                ) : (shop.users || []).map(u => (
                  <div key={u._id} style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #FAFAF9' }}>
                    <div style={{ fontSize: 13 }}>{u.email}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {roleBadge(u.role)}
                      {statusBadge(u.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ onRefresh }) {
  const [defaults, setDefaults]   = useState({ freeScanLimit: 20, monthlyCharge: 500 });
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [msg,      setMsg]        = useState('');
  const [pwOpen,   setPwOpen]     = useState(false);
  const [pw,       setPw]         = useState({ current: '', new: '', confirm: '' });
  const [pwMsg,    setPwMsg]      = useState('');

  useEffect(() => {
    adminFetch('/api/admin/defaults').then(d => { setDefaults(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function saveDefaults(e) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await adminFetch('/api/admin/defaults', { method: 'PATCH', body: defaults });
      setMsg('Saved successfully');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function changePw(e) {
    e.preventDefault();
    if (pw.new !== pw.confirm) { setPwMsg('Passwords do not match'); return; }
    try {
      await adminFetch('/api/admin/auth/change-password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.new } });
      setPwMsg('Password changed'); setPw({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwOpen(false), 1500);
    } catch (e) { setPwMsg(e.message); }
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#78716C' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Default quota settings */}
      <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', padding: '20px 22px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Default New User Settings</div>
        <div style={{ fontSize: 12, color: '#78716C', marginBottom: 18 }}>Applied to all newly registered shops</div>
        <form onSubmit={saveDefaults} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ['Default Free Scans / Month', 'freeScanLimit'],
            ['Default Monthly Charge (Rs)', 'monthlyCharge'],
          ].map(([label, key]) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>{label}</label>
              <input type="number" value={defaults[key] || ''} onChange={e => setDefaults(d => ({ ...d, [key]: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E7E5E4', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
          {msg && <div style={{ fontSize: 13, color: msg.includes('success') || msg.includes('Saved') ? '#16A34A' : '#DC2626' }}>{msg}</div>}
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save Defaults'}</button>
        </form>
      </div>

      {/* Change admin password */}
      <div style={{ background: 'white', borderRadius: 12, border: '1.5px solid #E7E5E4', overflow: 'hidden' }}>
        <button onClick={() => setPwOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          Change Admin Password
          {pwOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {pwOpen && (
          <form onSubmit={changePw} style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #F5F5F4' }}>
            <div style={{ paddingTop: 14 }} />
            {[['Current Password','current'],['New Password','new'],['Confirm New','confirm']].map(([lbl, k]) => (
              <div key={k}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{lbl}</label>
                <input type="password" value={pw[k]} onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))} required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E7E5E4', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            {pwMsg && <div style={{ fontSize: 13, color: pwMsg.includes('changed') ? '#16A34A' : '#DC2626' }}>{pwMsg}</div>}
            <button type="submit" className="btn btn-primary">Update Password</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard({ onLogout }) {
  const [stats,   setStats]   = useState(null);
  const [users,   setUsers]   = useState([]);
  const [shops,   setShops]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('dashboard');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, sh] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users'),
        adminFetch('/api/admin/shops'),
      ]);
      setStats(s);
      setUsers(u.users || []);
      setShops(sh.shops || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'dashboard', label: 'Dashboard',  icon: TrendingUp },
    { id: 'users',     label: `Users (${users.length})`, icon: Users },
    { id: 'shops',     label: `Shops (${shops.length})`, icon: Building2 },
    { id: 'settings',  label: 'Settings',   icon: Settings },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9' }}>
      {/* Header */}
      <div style={{ background: '#1C1917', color: 'white', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 19 }}>Tailor Manager</div>
          <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 10, fontWeight: 700, letterSpacing: '0.05em' }}>ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: '2px solid #E7E5E4', padding: '0 28px', display: 'flex', gap: 2 }}>
        {TABS.map(t => <Tab key={t.id} {...t} active={tab === t.id} onClick={setTab} />)}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {loading && tab === 'dashboard' ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#78716C' }}>Loading…</div>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab stats={stats} users={users} onRefresh={load} />}
            {tab === 'users'     && <UsersTab users={users} shops={shops} onRefresh={load} />}
            {tab === 'shops'     && <ShopsTab shops={shops} onRefresh={load} />}
            {tab === 'settings'  && <SettingsTab onRefresh={load} />}
          </>
        )}
      </div>
    </div>
  );
}
