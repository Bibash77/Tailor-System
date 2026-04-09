import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { kaligadhsDB, assignmentsDB, ordersDB } from '../db';
import { formatCurrency, formatDate } from '../utils';
import { ItemTag } from '../components/UI';

function ProfileView({ kaligadh, onBack }) {
  const [assignments, setAssignments] = useState([]);
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const as = await assignmentsDB.getByKaligadh(kaligadh.id);
      as.sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
      setAssignments(as);
      const orderMap = {};
      for (const a of as) {
        if (!orderMap[a.orderId]) {
          const o = await ordersDB.getById(a.orderId);
          if (o) orderMap[a.orderId] = o;
        }
      }
      setOrders(orderMap);
      setLoading(false);
    }
    load();
  }, [kaligadh.id]);

  const totalPcs = assignments.length;
  const totalEarned = assignments.reduce((s, a) => s + (Number(a.makingCost) || 0), 0);
  const pending = kaligadh.totalDue || 0;
  const received = totalEarned - pending;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <div>
            <h2 style={{ margin: 0 }}>{kaligadh.name}</h2>
            <p style={{ margin: 0 }}>Worker Profile</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <div className="stat-label">Total Earned (All Time)</div>
            <div className="stat-value" style={{ fontFamily: 'DM Serif Display', fontSize: 32, color: 'var(--green)' }}>
              {formatCurrency(totalEarned)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Already Received</div>
            <div className="stat-value" style={{ color: 'var(--ink)' }}>
              {formatCurrency(received >= 0 ? received : 0)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Due</div>
            <div className="stat-value" style={{ color: pending > 0 ? 'var(--accent)' : 'var(--green)' }}>
              {formatCurrency(pending)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Pieces Made</div>
            <div className="stat-value">{totalPcs} pcs</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Paid</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{formatDate(kaligadh.lastPaidDate)}</div>
          </div>
        </div>

        {/* Assignment History */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--paper-2)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Work History
          </div>
          {loading
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>
            : assignments.length === 0
            ? <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)' }}>No work assigned yet</div>
            : assignments.map(a => {
                const o = orders[a.orderId];
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--paper-2)', fontSize: 13 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ItemTag item={a.itemCategory} />
                        <span style={{ fontFamily: 'DM Serif Display', color: 'var(--accent)', fontSize: 14 }}>{a.orderId}</span>
                        {o && <span style={{ color: 'var(--ink-3)' }}>{o.customerName}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>
                        {formatDate(a.assignedAt)}
                        {a.note && ` · ${a.note}`}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'DM Serif Display', fontSize: 15, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      Rs. {a.makingCost}
                    </span>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}

// Standalone page — loaded via /kaligadh/:id URL
function StandaloneProfile() {
  const { id } = useParams();
  const [kaligadh, setKaligadh] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    kaligadhsDB.getById(id).then(k => {
      if (k) setKaligadh(k);
      else setNotFound(true);
    });
  }, [id]);

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FAFAF9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: '#1C1917', marginBottom: 8 }}>Worker Not Found</div>
          <div style={{ fontSize: 13, color: '#78716C' }}>The link may be incorrect. Please contact your manager.</div>
        </div>
      </div>
    );
  }

  if (!kaligadh) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FAFAF9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: '#1C1917', marginBottom: 8 }}>Tailor Manager</div>
          <div style={{ fontSize: 13, color: '#78716C' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ display: 'block' }}>
      <main className="main-content" style={{ marginLeft: 0 }}>
        <ProfileView kaligadh={kaligadh} onBack={null} />
      </main>
    </div>
  );
}

// In-app page — shown inside the admin sidebar layout, lets admin pick a worker
export default function KaligadhProfile() {
  // Check if we have a URL param (standalone mode)
  const params = useParams();
  if (params.id) return <StandaloneProfile />;

  const [kaligadhs, setKaligadhs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kaligadhsDB.getAll().then(ks => {
      ks.sort((a, b) => a.name.localeCompare(b.name));
      setKaligadhs(ks);
      setLoading(false);
    });
  }, []);

  if (selected) {
    return <ProfileView kaligadh={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Worker Profile</h2>
        <p>Select a worker to preview their profile, or share their link directly</p>
      </div>
      <div className="page-body">
        <div className="card">
          {loading
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading...</div>
            : kaligadhs.length === 0
            ? <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)' }}>No workers added yet</div>
            : kaligadhs.map(k => (
                <div
                  key={k.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--paper-2)' }}
                >
                  <button
                    onClick={() => setSelected(k)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flex: 1 }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>{k.name}</div>
                    {k.specialties?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {k.specialties.map(s => (
                          <span key={s} className="badge badge-blue">{s}</span>
                        ))}
                      </div>
                    )}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'DM Serif Display', fontSize: 16, color: (k.totalDue || 0) > 0 ? 'var(--accent)' : 'var(--green)' }}>
                        {formatCurrency(k.totalDue || 0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>pending due</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Copy worker profile link"
                      onClick={() => {
                        const url = `${window.location.origin}/kaligadh/${k.id}`;
                        navigator.clipboard.writeText(url);
                      }}
                      style={{ fontSize: 11 }}
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}
