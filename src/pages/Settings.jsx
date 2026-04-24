import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Check, X, Store, LogOut, Lock, Eye, EyeOff, Mail, Bell, ScanLine, RefreshCw } from 'lucide-react';
import { settingsDB } from '../db';
import { useAuth, authFetch } from '../context/AuthContext';

const DEFAULT_NOTIF_SETTINGS = {
  emailEnabled:       true,
  notifyEmail:        '',
  delivery:           { enabled: true,  daysBefore: 3 },
  payment:            { enabled: true,  daysBefore: 3 },
  salary:             { enabled: true,  daysBeforeMonthEnd: 5 },
  finance:            { enabled: true  },
};

export default function Settings({ itemCategories, onItemCategoriesChange }) {
  const { user, updateUser, refreshSession, logout } = useAuth();

  // ── Account section ──────────────────────────────────────────────────────────
  const [shopNameDraft, setShopNameDraft] = useState('');
  const [editingShop, setEditingShop] = useState(false);

  function startEditShop() {
    setShopNameDraft(user?.shopName || '');
    setEditingShop(true);
  }

  function saveShopName() {
    const name = shopNameDraft.trim();
    if (!name) return;
    updateUser({ shopName: name });
    setEditingShop(false);
  }

  // ── Change Password section ──────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await authFetch('/api/auth/password', {
        method: 'PATCH',
        body: { currentPassword: currentPw, newPassword: newPw },
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ type: 'err', text: data.error }); return; }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwMsg({ type: 'ok', text: 'Password changed successfully.' });
    } catch {
      setPwMsg({ type: 'err', text: 'Network error. Try again.' });
    } finally {
      setPwLoading(false);
    }
  }

  // ── Change Email section ─────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  async function changeEmail(e) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailLoading(true);
    try {
      const res = await authFetch('/api/auth/email', {
        method: 'PATCH',
        body: { newEmail, currentPassword: emailPw },
      });
      const data = await res.json();
      if (!res.ok) { setEmailMsg({ type: 'err', text: data.error }); return; }
      refreshSession(data.token, data.user);
      setNewEmail(''); setEmailPw('');
      setEmailMsg({ type: 'ok', text: 'Email updated successfully.' });
    } catch {
      setEmailMsg({ type: 'err', text: 'Network error. Try again.' });
    } finally {
      setEmailLoading(false);
    }
  }

  // ── Notification settings ─────────────────────────────────────────────────────
  const [notifSettings,     setNotifSettings]     = useState(DEFAULT_NOTIF_SETTINGS);
  const [notifDirty,        setNotifDirty]        = useState(false);
  const [notifSaving,       setNotifSaving]       = useState(false);
  const [notifMsg,          setNotifMsg]           = useState(null);
  const [testEmailLoading,  setTestEmailLoading]  = useState(false);

  useEffect(() => {
    settingsDB.get('notificationSettings').then(v => {
      if (v) setNotifSettings({ ...DEFAULT_NOTIF_SETTINGS, ...v });
    }).catch(() => {});
  }, []);

  function setNotif(path, value) {
    setNotifDirty(true);
    setNotifSettings(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      if (keys.length === 1) { next[keys[0]] = value; }
      else { next[keys[0]] = { ...prev[keys[0]], [keys[1]]: value }; }
      return next;
    });
  }

  async function saveNotifSettings() {
    setNotifSaving(true);
    try {
      await settingsDB.set('notificationSettings', notifSettings);
      setNotifDirty(false);
      setNotifMsg({ type: 'ok', text: 'Notification settings saved.' });
    } catch {
      setNotifMsg({ type: 'err', text: 'Failed to save settings.' });
    } finally {
      setNotifSaving(false);
      setTimeout(() => setNotifMsg(null), 3000);
    }
  }

  async function sendTestEmail() {
    if (!notifSettings.notifyEmail) return alert('Enter an email address first.');
    setTestEmailLoading(true);
    try {
      const res = await authFetch('/api/notifications/test-email', {
        method: 'POST',
        body: { email: notifSettings.notifyEmail },
      });
      const data = await res.json();
      setNotifMsg(res.ok
        ? { type: 'ok',  text: 'Test email sent! Check your inbox.' }
        : { type: 'err', text: data.error || 'Send failed.' });
    } catch {
      setNotifMsg({ type: 'err', text: 'Network error.' });
    } finally {
      setTestEmailLoading(false);
      setTimeout(() => setNotifMsg(null), 4000);
    }
  }

  // ── Scan usage stats ──────────────────────────────────────────────────────────
  const [scanStats,        setScanStats]        = useState(null);
  const [scanStatsLoading, setScanStatsLoading] = useState(false);

  const loadScanStats = useCallback(async () => {
    setScanStatsLoading(true);
    try {
      const res  = await authFetch('/api/scan/stats');
      const data = await res.json();
      if (res.ok) setScanStats(data);
    } catch {}
    finally { setScanStatsLoading(false); }
  }, []);

  useEffect(() => { loadScanStats(); }, [loadScanStats]);

  // ── Item categories edit state ────────────────────────────────────────────────
  const [draftCategories, setDraftCategories] = useState([]);
  const [editingCategories, setEditingCategories] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState('');

  function startEditCategories() {
    setDraftCategories(itemCategories.map(i => ({ ...i })));
    setNewItemName('');
    setNewItemCost('');
    setEditingCategories(true);
  }

  function cancelEditCategories() {
    setEditingCategories(false);
    setNewItemName('');
    setNewItemCost('');
  }

  async function saveCategories() {
    await settingsDB.set('itemCategories', draftCategories);
    onItemCategoriesChange(draftCategories);
    setEditingCategories(false);
    setNewItemName('');
    setNewItemCost('');
  }

  function addNewItem() {
    const name = newItemName.trim();
    if (!name) return;
    if (draftCategories.find(i => i.name.toLowerCase() === name.toLowerCase())) {
      return alert('An item with that name already exists.');
    }
    setDraftCategories(prev => [...prev, { name, makingCost: Number(newItemCost) || 0 }]);
    setNewItemName('');
    setNewItemCost('');
  }

  function removeDraftItem(name) {
    setDraftCategories(prev => prev.filter(i => i.name !== name));
  }

  function updateDraftCost(name, cost) {
    setDraftCategories(prev => prev.map(i => i.name === name ? { ...i, makingCost: Number(cost) || 0 } : i));
  }

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your account and shop configuration</p>
      </div>
      <div className="page-body">

        {/* Account */}
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid var(--paper-2)', paddingBottom: 14 }}>
            <Store size={17} style={{ color: 'var(--accent)' }} />
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Account</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="text-sm text-muted" style={{ marginBottom: 2 }}>Email</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.email}</div>
          </div>

          <div>
            <div className="text-sm text-muted" style={{ marginBottom: 6 }}>Shop Name</div>
            {!editingShop ? (
              <div className="flex items-center gap-3">
                <span style={{ fontWeight: 600, fontSize: 15 }}>{user?.shopName || '—'}</span>
                <button className="btn btn-ghost btn-sm" onClick={startEditShop}><Edit2 size={13} /> Edit</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="form-input"
                  style={{ maxWidth: 280 }}
                  value={shopNameDraft}
                  onChange={e => setShopNameDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveShopName()}
                  autoFocus
                  placeholder="e.g. Ram Tailoring House"
                />
                <button className="btn btn-primary btn-sm" onClick={saveShopName}>
                  <Check size={13} /> Save
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingShop(false)}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid var(--paper-2)', paddingBottom: 14 }}>
            <Lock size={17} style={{ color: 'var(--accent)' }} />
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Change Password</div>
          </div>

          <form onSubmit={changePassword} style={{ maxWidth: 360 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPw}
                  onChange={e => { setCurrentPw(e.target.value); setPwMsg(null); }}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', display: 'flex' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>New Password</label>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwMsg(null); }}
                required
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwMsg(null); }}
                required
              />
            </div>

            {pwMsg && (
              <div style={{ marginBottom: 14, fontSize: 13, padding: '9px 12px', borderRadius: 8,
                color: pwMsg.type === 'ok' ? '#15803D' : '#DC2626',
                background: pwMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${pwMsg.type === 'ok' ? '#BBF7D0' : '#FECACA'}`,
              }}>
                {pwMsg.text}
              </div>
            )}

            <button className="btn btn-primary btn-sm" type="submit" disabled={pwLoading}>
              <Lock size={13} /> {pwLoading ? 'Saving…' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Change Email */}
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid var(--paper-2)', paddingBottom: 14 }}>
            <Mail size={17} style={{ color: 'var(--accent)' }} />
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Change Email</div>
          </div>

          <form onSubmit={changeEmail} style={{ maxWidth: 360 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>New Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="new@example.com"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailMsg(null); }}
                required
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Current Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Confirm with your password"
                value={emailPw}
                onChange={e => { setEmailPw(e.target.value); setEmailMsg(null); }}
                required
              />
            </div>

            {emailMsg && (
              <div style={{ marginBottom: 14, fontSize: 13, padding: '9px 12px', borderRadius: 8,
                color: emailMsg.type === 'ok' ? '#15803D' : '#DC2626',
                background: emailMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${emailMsg.type === 'ok' ? '#BBF7D0' : '#FECACA'}`,
              }}>
                {emailMsg.text}
              </div>
            )}

            <button className="btn btn-primary btn-sm" type="submit" disabled={emailLoading}>
              <Mail size={13} /> {emailLoading ? 'Saving…' : 'Update Email'}
            </button>
          </form>
        </div>

        {/* Sign Out */}
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-3" style={{ borderBottom: '1px solid var(--paper-2)', paddingBottom: 14 }}>
            <LogOut size={17} style={{ color: 'var(--red)' }} />
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Sign Out</div>
          </div>
          <p className="text-sm text-muted" style={{ marginBottom: 14 }}>
            You will be signed out of Tailor Manager on this device.
          </p>
          <button
            className="btn btn-sm"
            onClick={logout}
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>

        {/* Notification Settings */}
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid var(--paper-2)', paddingBottom: 14 }}>
            <Bell size={17} style={{ color: 'var(--accent)' }} />
            <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Notification Settings</div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Email Notifications</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <Toggle checked={notifSettings.emailEnabled} onChange={v => setNotif('emailEnabled', v)} />
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Send email alerts for important notifications</span>
            </label>
            {notifSettings.emailEnabled && (
              <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="your@email.com"
                  value={notifSettings.notifyEmail}
                  onChange={e => setNotif('notifyEmail', e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-ghost btn-sm" disabled={testEmailLoading} onClick={sendTestEmail}>
                  {testEmailLoading ? 'Sending…' : 'Test'}
                </button>
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>
              Requires SMTP_HOST, SMTP_USER, SMTP_PASS environment variables. Only high-priority alerts are emailed.
            </p>
          </div>

          {/* Delivery */}
          <NotifRule
            label="Delivery Reminders"
            hint="Remind when an order delivery date is approaching"
            enabled={notifSettings.delivery?.enabled}
            onToggle={v => setNotif('delivery.enabled', v)}
            daysLabel="Notify before delivery"
            days={notifSettings.delivery?.daysBefore}
            onDays={v => setNotif('delivery.daysBefore', v)}
          />

          {/* Payment */}
          <NotifRule
            label="Dealer Payment Reminders"
            hint="Remind when a dealer payment is due soon"
            enabled={notifSettings.payment?.enabled}
            onToggle={v => setNotif('payment.enabled', v)}
            daysLabel="Notify before due date"
            days={notifSettings.payment?.daysBefore}
            onDays={v => setNotif('payment.daysBefore', v)}
          />

          {/* Salary */}
          <NotifRule
            label="Salary Month-End Reminders"
            hint="Remind when unpaid salary is pending near month end"
            enabled={notifSettings.salary?.enabled}
            onToggle={v => setNotif('salary.enabled', v)}
            daysLabel="Trigger in last N days of month"
            days={notifSettings.salary?.daysBeforeMonthEnd}
            onDays={v => setNotif('salary.daysBeforeMonthEnd', v)}
          />

          {/* Finance */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--paper-2)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Finance Month-End Summary</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>Pending payables and receivables reminder near month end</div>
            </div>
            <Toggle checked={notifSettings.finance?.enabled} onChange={v => setNotif('finance.enabled', v)} />
          </div>

          {/* Save */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={!notifDirty || notifSaving} onClick={saveNotifSettings}>
              <Check size={13} /> {notifSaving ? 'Saving…' : 'Save Settings'}
            </button>
            {notifMsg && (
              <span style={{ fontSize: 13, color: notifMsg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                {notifMsg.text}
              </span>
            )}
          </div>
        </div>

        {/* Scan Usage */}
        <div className="card card-pad mb-6">
          <div className="flex items-center justify-between mb-4" style={{ borderBottom: '1px solid var(--paper-2)', paddingBottom: 14 }}>
            <div className="flex items-center gap-2">
              <ScanLine size={17} style={{ color: 'var(--accent)' }} />
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Bill Scan (AI)</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadScanStats} disabled={scanStatsLoading}>
              <RefreshCw size={13} className={scanStatsLoading ? 'spin' : ''} />
            </button>
          </div>

          {scanStats ? (
            <div>
              {/* Active model row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--paper-1)', borderRadius: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Active Model</div>
                  <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: 'var(--accent)' }}>{scanStats.currentModel}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: scanStats.failedToday?.length === scanStats.allModels?.length ? '#DC2626' : '#16A34A', boxShadow: '0 0 6px currentColor' }} />
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <StatBox label="Scans Today" value={scanStats.requestsToday} />
                <StatBox label="Cost Today" value={`$${(scanStats.costToday || 0).toFixed(4)}`} />
                <StatBox label="Total Scans" value={scanStats.totalRequests} />
                <StatBox label="Total Cost" value={`$${(scanStats.totalCost || 0).toFixed(4)}`} />
              </div>

              {/* Failed models today */}
              {scanStats.failedToday?.length > 0 && (
                <div style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, padding: '8px 12px', marginBottom: 10 }}>
                  Quota hit today: {scanStats.failedToday.join(', ')} — switched to next model automatically
                </div>
              )}

              {/* Last model switch */}
              {scanStats.lastSwitch && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10 }}>
                  Last switch: {scanStats.lastSwitch.from?.split('/')[1]} → {scanStats.lastSwitch.to?.split('/')[1]}
                  {' · '}{new Date(scanStats.lastSwitch.at).toLocaleTimeString()}
                </div>
              )}

              {/* OpenRouter key info */}
              {scanStats.keyInfo && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', borderTop: '1px solid var(--paper-2)', paddingTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>Plan: <b>{scanStats.keyInfo.is_free_tier ? 'Free Tier' : 'Paid'}</b></span>
                  <span>Used (month): <b>${(scanStats.keyInfo.usage_monthly || 0).toFixed(4)}</b></span>
                  {scanStats.keyInfo.limit != null && (
                    <span>Credit limit: <b>${scanStats.keyInfo.limit}</b></span>
                  )}
                </div>
              )}

              {/* All models */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Model Queue</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {scanStats.allModels?.map((m, i) => {
                    const isCurrent = m === scanStats.currentModel;
                    const isFailed  = scanStats.failedToday?.includes(m);
                    return (
                      <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                          background: isFailed ? '#FEE2E2' : isCurrent ? 'var(--accent)' : 'var(--paper-2)',
                          color: isFailed ? '#DC2626' : isCurrent ? 'white' : 'var(--ink-3)' }}>
                          {i + 1}
                        </span>
                        <span style={{ fontFamily: 'monospace', color: isFailed ? '#DC2626' : isCurrent ? 'var(--ink-1)' : 'var(--ink-3)',
                          textDecoration: isFailed ? 'line-through' : 'none' }}>
                          {m}
                        </span>
                        {isCurrent && <span style={{ fontSize: 10, background: '#DCFCE7', color: '#16A34A', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>active</span>}
                        {isFailed  && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: 10 }}>quota hit</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>
              {scanStatsLoading ? 'Loading…' : 'Could not load scan stats. Check OPENROUTER_API_KEY.'}
            </div>
          )}
        </div>

        {/* Item Categories */}
        <div className="card card-pad mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div style={{ fontFamily: 'DM Serif Display', fontSize: 18 }}>Item Categories</div>
              <div className="text-sm text-muted mt-1">Manage stitching items and their default making costs</div>
            </div>
            {!editingCategories
              ? <div className="flex gap-2">
                  <button className="btn btn-accent btn-sm" onClick={startEditCategories}><Plus size={13} /> Add</button>
                  <button className="btn btn-ghost btn-sm" onClick={startEditCategories}><Edit2 size={13} /> Edit</button>
                </div>
              : <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={cancelEditCategories}><X size={13} /> Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveCategories}><Check size={13} /> Save</button>
                </div>
            }
          </div>

          {!editingCategories ? (
            <div className="grid-2">
              {itemCategories.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1.5px solid var(--paper-3)', borderRadius: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
                  <span style={{ fontFamily: 'DM Serif Display', fontSize: 17, color: 'var(--accent)' }}>Rs. {cat.makingCost}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {draftCategories.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--paper-2)' }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
                  <input
                    type="number"
                    min="0"
                    style={{ width: 100, padding: '5px 8px', border: '1.5px solid var(--paper-3)', borderRadius: 6, fontFamily: 'DM Sans', fontSize: 14, textAlign: 'right' }}
                    value={cat.makingCost}
                    onChange={e => updateDraftCost(cat.name, e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)', padding: '4px 8px' }}
                    onClick={() => removeDraftItem(cat.name)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Add new item row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, marginTop: 4 }}>
                <input
                  className="form-input"
                  placeholder="Item name (e.g. Bhoto)"
                  style={{ flex: 1 }}
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNewItem()}
                />
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  placeholder="Cost"
                  style={{ width: 100, textAlign: 'right' }}
                  value={newItemCost}
                  onChange={e => setNewItemCost(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNewItem()}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={addNewItem}>
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 38, height: 22, borderRadius: 11,
        background: checked ? 'var(--green)' : 'var(--paper-3)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 18 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function NotifRule({ label, hint, enabled, onToggle, daysLabel, days, onDays }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--paper-2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{hint}</div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{daysLabel}:</span>
          <input
            type="number"
            min={1} max={30}
            value={days ?? 3}
            onChange={e => onDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            style={{ width: 60, padding: '4px 8px', border: '1.5px solid var(--paper-3)', borderRadius: 6, fontFamily: 'DM Sans', fontSize: 14, textAlign: 'center' }}
          />
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>days</span>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ background: 'var(--paper-1)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'DM Serif Display', color: 'var(--ink-1)' }}>{value}</div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#44403C',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};