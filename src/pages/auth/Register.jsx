import { useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import AuthCard from './AuthCard';
import { useAuth, API_BASE } from '../../context/AuthContext';

export default function Register({ onHasAccount }) {
  const { login } = useAuth();

  const [shopName, setShopName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!shopName.trim()) { setError('Shop name is required.'); return; }
    if (!email.trim())    { setError('Email is required.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), shopName: shopName.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed.'); return; }
      login(data.token, data.user);
    } catch {
      setError('Registration failed. Please check your connection and make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Set up your Tailor Manager — takes less than a minute"
    >
      <form onSubmit={handleSubmit}>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Shop Name</label>
          <input
            className="form-input"
            placeholder="e.g. Ram Tailoring House"
            value={shopName}
            onChange={e => setShopName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email</label>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ paddingRight: 42 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', display: 'flex' }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            className="form-input"
            type={showPw ? 'text' : 'password'}
            placeholder="Repeat password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 0' }}
        >
          <UserPlus size={15} />
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        {onHasAccount && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#78716C', marginTop: 20 }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onHasAccount}
              style={{ color: '#C2410C', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Sign in
            </button>
          </p>
        )}
      </form>
    </AuthCard>
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

const errorStyle = {
  fontSize: 13,
  color: '#DC2626',
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 14,
};