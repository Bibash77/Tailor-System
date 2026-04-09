import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingBag, Users, Truck, BookOpen, Settings as SettingsIcon
} from 'lucide-react';
import { openDB } from './db';

import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import NewOrder from './pages/NewOrder';
import AssignKaligadh from './pages/AssignKaligadh';
import KaligadhPage from './pages/Kaligadh';
import Dealers from './pages/Dealers';
import Activity from './pages/Activity';
import SettingsPage from './pages/Settings';

import './index.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'kaligadh', label: 'Kaligadh', icon: Users },
  { id: 'dealers', label: 'Dealers', icon: Truck },
  { id: 'activity', label: 'Activity', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [dbReady, setDbReady] = useState(false);
  const [newOrderFlow, setNewOrderFlow] = useState(null); // null | 'new' | {order, step:'assign'}
  const [highlightOrderId, setHighlightOrderId] = useState(null);

  useEffect(() => {
    openDB().then(() => setDbReady(true)).catch(console.error);
  }, []);

  function handleOrderSaved(order) {
    setNewOrderFlow(null);
    setPage('orders');
  }

  function handleSaveAndAssign(order) {
    setNewOrderFlow({ order, step: 'assign' });
  }

  function handleAssignDone() {
    setNewOrderFlow(null);
    setPage('orders');
  }

  function handleAssignOrder(order) {
    setNewOrderFlow({ order, step: 'assign' });
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
          <div style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: '#1C1917', marginBottom: 8 }}>Tailor Manager</div>
          <div style={{ fontSize: 13, color: '#78716C' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Determine main content
  let content;
  if (newOrderFlow === 'new') {
    content = <NewOrder onSaved={handleOrderSaved} onSaveAndAssign={handleSaveAndAssign} />;
  } else if (newOrderFlow?.step === 'assign') {
    content = <AssignKaligadh order={newOrderFlow.order} onDone={handleAssignDone} />;
  } else {
    switch (page) {
      case 'dashboard':
        content = <Dashboard onNavigate={setPage} onNavigateOrder={handleNavigateOrder} />;
        break;
      case 'orders':
        content = (
          <Orders
            onNewOrder={() => setNewOrderFlow('new')}
            onAssignOrder={handleAssignOrder}
            highlightOrderId={highlightOrderId}
            onHighlightClear={() => setHighlightOrderId(null)}
          />
        );
        break;
      case 'kaligadh':
        content = <KaligadhPage />;
        break;
      case 'dealers':
        content = <Dealers />;
        break;
      case 'activity':
        content = <Activity onNavigateOrder={handleNavigateOrder} />;
        break;
      case 'settings':
        content = <SettingsPage />;
        break;
      default:
        content = <Dashboard onNavigate={setPage} onNavigateOrder={handleNavigateOrder} />;
    }
  }

  const activePage = newOrderFlow ? (newOrderFlow === 'new' ? '__new' : '__assign') : page;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Tailor<br />Manager</h1>
          <span>Business Suite</span>
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
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          v1.0 · MVP
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {content}
      </main>
    </div>
  );
}
