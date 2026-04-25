import { AlertTriangle, Clock, XCircle } from 'lucide-react';

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000));
}

export default function SubscriptionBanner({ subscription, accountStatus }) {
  if (accountStatus === 'suspended') {
    return (
      <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <XCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13 }}>
          <strong style={{ color: '#DC2626' }}>Account suspended.</strong>
          <span style={{ color: '#78716C', marginLeft: 6 }}>Contact the admin to restore access.</span>
        </div>
      </div>
    );
  }
  if (!subscription) return null;
  const { status, trialEndsAt, billedUntil } = subscription;

  if (status === 'expired') {
    return (
      <div style={{
        background: '#FEF2F2', borderBottom: '1px solid #FECACA',
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <XCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13 }}>
          <strong style={{ color: '#DC2626' }}>Subscription expired.</strong>
          <span style={{ color: '#78716C', marginLeft: 6 }}>
            You can view your data but cannot add or edit records. Contact the admin to renew.
          </span>
        </div>
      </div>
    );
  }

  if (status === 'trial') {
    const days = daysLeft(trialEndsAt);
    const urgent = days <= 7;
    return (
      <div style={{
        background: urgent ? '#FFFBEB' : '#F0FDF4',
        borderBottom: `1px solid ${urgent ? '#FDE68A' : '#BBF7D0'}`,
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Clock size={16} style={{ color: urgent ? '#D97706' : '#16A34A', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13 }}>
          <strong style={{ color: urgent ? '#D97706' : '#15803D' }}>
            Free trial — {days} day{days !== 1 ? 's' : ''} remaining.
          </strong>
          <span style={{ color: '#78716C', marginLeft: 6 }}>
            Contact the admin to subscribe and keep access after your trial ends.
          </span>
        </div>
      </div>
    );
  }

  if (status === 'active' && billedUntil) {
    const days = daysLeft(billedUntil);
    if (days > 7) return null;
    return (
      <div style={{
        background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13 }}>
          <strong style={{ color: '#D97706' }}>Subscription renews in {days} day{days !== 1 ? 's' : ''}.</strong>
          <span style={{ color: '#78716C', marginLeft: 6 }}>Contact the admin to renew.</span>
        </div>
      </div>
    );
  }

  return null;
}
