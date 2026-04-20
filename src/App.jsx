import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingBag, Users, UsersRound, Truck,
  BookOpen, Settings as SettingsIcon, Receipt, Wallet, BarChart2,
  LogOut,
} from 'lucide-react';
import { openDB, settingsDB } from './db';
import { ITEM_CATEGORIES, DEFAULT_MAKING_COSTS } from './utils';

import { AuthProvider, useAuth, API_BASE } from './context/AuthContext';
import Login         from './pages/auth/Login';
import Register      from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import NotificationBell from './components/NotificationBell';
import { setupPushNotifications, onForegroundMessage } from './firebase';

import Dashboard     from './pages/Dashboard';
import Orders        from './pages/Orders';
import NewOrder      from './pages/NewOrder';
import AssignKaligadh from './pages/AssignKaligadh';
import KaligadhPage  from './pages/Kaligadh';
import CustomersPage from './pages/Customers';
import Dealers       from './pages/Dealers';
import Activity      from './pages/Activity';
import SettingsPage  from './pages/Settings';
import ExpensesPage  from './pages/Expenses';
import SalaryPage    from './pages/Salary';
import FinancePage   from './pages/Finance';

import './index.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'orders',    label: 'Orders',     icon: ShoppingBag },
  { id: 'customers', label: 'Customers',  icon: UsersRound },
  { id: 'kaligadh',  label: 'Kaligadh',   icon: Users },
  { id: 'dealers',   label: 'Dealers',    icon: Truck },
  { id: 'expenses',  label: 'Expenses',   icon: Receipt },
  { id: 'salary',    label: 'Salary',     icon: Wallet },
  { id: 'finance',   label: 'Finance',    icon: BarChart2 },
  { id: 'activity',  label: 'Activity',   icon: BookOpen },
  { id: 'settings',  label: 'Settings',   icon: SettingsIcon },
];

// ─── Auth screen (login / register / forgot, local mode) ────────

function AuthScreen() {
  const [view, setView]         = useState(null); // null | 'login' | 'register' | 'forgot'
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(API_BASE + '/api/auth/status')
      .then(r => r.json())
      .then(({ hasUser }) => setView(hasUser ? 'login' : 'register'))
      .catch(() => setView('login'))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1C1917' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: 'white', marginBottom: 8 }}>Tailor Manager</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
      </div>
    </div>
  );

  if (view === 'register') return <Register onHasAccount={() => setView('login')} />;
  if (view === 'forgot')   return <ForgotPassword onBack={() => setView('login')} />;
  return (
    <Login
      onForgot={() => setView('forgot')}
      onRegister={() => setView('register')}
    />
  );
}

// ─── Main application shell (rendered only when authenticated) ────────────────

function AppShell() {
  const { user, logout } = useAuth();

  const [page, setPage]               = useState('dashboard');
  const [dbReady, setDbReady]         = useState(false);
  const [newOrderFlow, setNewOrderFlow] = useState(null);
  const [newOrderPrefill, setNewOrderPrefill] = useState(null);
  const [highlightOrderId, setHighlightOrderId] = useState(null);
  const [itemCategories, setItemCategories] = useState([]);

  useEffect(() => {
    openDB()
      .then(async () => {
        let items = await settingsDB.get('itemCategories');
        if (!items) {
          items = ITEM_CATEGORIES.map(name => ({ name, makingCost: DEFAULT_MAKING_COSTS[name] || 0 }));
          await settingsDB.set('itemCategories', items);
        }
        setItemCategories(items);
        setDbReady(true);
      })
      .catch(console.error);
  }, []);

  // Set up browser push notifications after DB is ready
  useEffect(() => {
    if (!dbReady) return;

    // Request permission + register FCM token (non-blocking)
    setupPushNotifications().catch(() => {});

    // Show foreground push as in-app toast (optional — bell already shows them)
    const unsub = onForegroundMessage((payload) => {
      // Foreground messages are handled by the bell polling; no extra toast needed
      console.info('[FCM] Foreground message:', payload?.notification?.title);
    });

    return unsub;
  }, [dbReady]);

  function handleOrderSaved()       { setNewOrderFlow(null); setNewOrderPrefill(null); setPage('orders'); }
  function handleSaveAndAssign(order) { setNewOrderPrefill(null); setNewOrderFlow({ order, step: 'assign' }); }
  function handleAssignDone()       { setNewOrderFlow(null); setPage('orders'); }
  function handleAssignOrder(order) { setNewOrderFlow({ order, step: 'assign' }); }
  function handleNewOrderForCustomer(customer) {
    setNewOrderPrefill({ customerName: customer.name, customerPhone: customer.phone });
    setNewOrderFlow('new');
  }
  function handleNavigateOrder(orderId) {
    setHighlightOrderId(orderId);
    setNewOrderFlow(null);
    setPage('orders');
  }

  if (!dbReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FAFAF9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: '#1C1917', marginBottom: 8 }}>
            {user.shopName || 'Tailor Manager'}
          </div>
          <div style={{ fontSize: 13, color: '#78716C' }}>Loading…</div>
        </div>
      </div>
    );
  }

  // Determine page content
  let content;
  if (newOrderFlow === 'new') {
    content = <NewOrder itemCategories={itemCategories} prefill={newOrderPrefill} onSaved={handleOrderSaved} onSaveAndAssign={handleSaveAndAssign} />;
  } else if (newOrderFlow?.step === 'assign') {
    content = <AssignKaligadh order={newOrderFlow.order} itemCategories={itemCategories} onDone={handleAssignDone} />;
  } else {
    switch (page) {
      case 'dashboard': content = <Dashboard onNavigate={setPage} onNavigateOrder={handleNavigateOrder} />; break;
      case 'orders':    content = <Orders onNewOrder={() => setNewOrderFlow('new')} onAssignOrder={handleAssignOrder} highlightOrderId={highlightOrderId} onHighlightClear={() => setHighlightOrderId(null)} />; break;
      case 'customers': content = <CustomersPage onNewOrderForCustomer={handleNewOrderForCustomer} />; break;
      case 'kaligadh':  content = <KaligadhPage itemCategories={itemCategories} />; break;
      case 'dealers':   content = <Dealers />; break;
      case 'expenses':  content = <ExpensesPage />; break;
      case 'salary':    content = <SalaryPage />; break;
      case 'finance':   content = <FinancePage onNavigate={setPage} />; break;
      case 'activity':  content = <Activity onNavigateOrder={handleNavigateOrder} />; break;
      case 'settings':  content = <SettingsPage itemCategories={itemCategories} onItemCategoriesChange={setItemCategories} />; break;
      default:          content = <Dashboard onNavigate={setPage} onNavigateOrder={handleNavigateOrder} />;
    }
  }

  const activePage = newOrderFlow ? (newOrderFlow === 'new' ? '__new' : '__assign') : page;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1 style={{ fontSize: 17, lineHeight: 1.3 }}>
            {user.shopName || 'Tailor Manager'}
          </h1>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? 'active' : ''}`}
              onClick={() => { setNewOrderFlow(null); setPage(id); }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Notifications + Logout at bottom */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {dbReady && (
            <NotificationBell onNavigate={(mod) => { setNewOrderFlow(null); setPage(mod); }} />
          )}
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '9px 12px', borderRadius: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'white'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
          >
            <LogOut size={15} /> Sign Out
          </button>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', padding: '4px 12px 0' }}>v1.0 · MVP</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {content}
      </main>
    </div>
  );
}

// ─── Root with auth gating ────────────────────────────────────────────────────

function AppContent() {
  const { user, loading } = useAuth();

  // Capture reset token from URL once (before any auth check)
  const [resetToken] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('resetToken');
    if (t) window.history.replaceState({}, '', window.location.pathname);
    return t || null;
  });

  // Loading: verifying stored JWT
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FAFAF9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: '#1C1917', marginBottom: 8 }}>Tailor Manager</div>
          <div style={{ fontSize: 13, color: '#78716C' }}>Loading…</div>
        </div>
      </div>
    );
  }

  // Password reset link (takes priority over auth state)
  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => window.location.replace('/')} // hard refresh clears state cleanly
      />
    );
  }

  // Not logged in → auth screens
  if (!user) return <AuthScreen />;

  // Logged in → full app
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
