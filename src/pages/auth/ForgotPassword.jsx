import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import AuthCard from './AuthCard';

export default function ForgotPassword({ onBack }) {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email is required.'); return; }

    // In local mode, just simulate sending
    setLoading(true);
    setTimeout(() => {
      setSent(true);
      setLoading(false);
    }, 800);
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={`We sent a reset link to ${email}`}>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <CheckCircle size={48} style={{ color: '#15803D', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.7, marginBottom: 8 }}>
            In local mode, password reset is not available.
            Please remember your password.
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

        {error && (
          <div style={errorStyle}>{error}</div>
        )}

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