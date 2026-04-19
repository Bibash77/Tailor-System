import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import AuthCard from './AuthCard';
import { useAuth } from '../../context/AuthContext';

export default function Login({ onForgot, onRegister }) {
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]  = useState(false);
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed.'); return; }
      login(data.token, data.user);
    } catch {
      setError('Login failed. Please check your connection and make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your Tailor Manager account">
      <form onSubmit={handleSubmit}>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email</label>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={labelStyle}>Password</label>
            {onForgot && (
              <button
                type="button"
                onClick={onForgot}
                style={{ fontSize: 12, color: '#C2410C', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Forgot password?
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
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

        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 0' }}
        >
          <LogIn size={15} />
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        {onRegister && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#78716C', marginTop: 20 }}>
            No account yet?{' '}
            <button
              type="button"
              onClick={onRegister}
              style={{ color: '#C2410C', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Create account
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