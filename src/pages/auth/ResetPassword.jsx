import { useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Lock, ArrowLeft } from 'lucide-react';
import AuthCard from './AuthCard';
import { API_BASE } from '../../context/AuthContext';

export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [status,   setStatus]   = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [message,  setMessage]  = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    if (password !== confirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(API_BASE + '/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Reset failed. The link may have expired.');
        return;
      }
      setStatus('success');
      setMessage(data.message || 'Password reset successfully.');
    } catch {
      setStatus('error');
      setMessage('Could not connect to server. Check your connection.');
    }
  }

  if (status === 'success') {
    return (
      <AuthCard title="Password reset" subtitle="You can now sign in with your new password">
        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
          <CheckCircle size={52} style={{ color: '#15803D', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: '#78716C' }}>{message}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={onDone}
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 0' }}
        >
          <ArrowLeft size={15} /> Go to Sign In
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set new password"
      subtitle="Choose a strong password for your account"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => { setPassword(e.target.value); setStatus('idle'); }}
              required
              autoFocus
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
            placeholder="Repeat new password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setStatus('idle'); }}
            required
          />
        </div>

        {status === 'error' && (
          <div style={{ ...errorStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <XCircle size={15} style={{ flexShrink: 0 }} />
            {message}
          </div>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={status === 'loading'}
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 0' }}
        >
          <Lock size={15} />
          {status === 'loading' ? 'Saving…' : 'Save New Password'}
        </button>
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
