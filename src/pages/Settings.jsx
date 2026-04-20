import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Store, LogOut, Lock, Eye, EyeOff, Mail } from 'lucide-react';
import { settingsDB } from '../db';
import { useAuth, authFetch } from '../context/AuthContext';

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

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#44403C',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};