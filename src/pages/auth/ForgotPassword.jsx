import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import AuthCard from './AuthCard';
import { API_BASE } from '../../context/AuthContext';

export default function ForgotPassword({ onBack }) {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required.'); return; }

    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send reset email.'); return; }
      setSent(true);
    } catch {
      setError('Could not send reset email. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={`We sent a reset link to ${email}`}>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <CheckCircle size={48} style={{ color: '#15803D', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.7, marginBottom: 8 }}>
            Click the link in the email to set a new password.
            The link expires in 30 minutes.
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={onBack}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <ArrowLeft size={14} /> Back to Sign In
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Email Address</label>
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

        {error && <div style={errorStyle}>{error}</div>}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 0', marginBottom: 12 }}
        >
          <Mail size={15} />
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={onBack}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <ArrowLeft size={14} /> Back to Sign In
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
