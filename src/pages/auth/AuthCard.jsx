// Shared full-screen wrapper used by all auth pages.
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1C1917',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: 30,
            color: 'white',
            lineHeight: 1.15,
          }}>
            Tailor<br />Manager
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: 4,
          }}>
            Business Suite
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}>
          <h2 style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: 24,
            fontWeight: 400,
            color: '#1C1917',
            margin: '0 0 4px',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: 13, color: '#78716C', margin: '0 0 24px' }}>
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
