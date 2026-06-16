import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { api } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SiteDetail from './pages/SiteDetail';
import History from './pages/History';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';

function Nav({ onLogout }: { onLogout: () => void }) {
  return (
    <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 24, height: 52 }}>
      <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginRight: 8 }}>👀 Job Watcher</span>
      {[
        { to: '/', label: 'Dashboard' },
        { to: '/history', label: 'History' },
        { to: '/notifications', label: 'Sent' },
        { to: '/settings', label: 'Settings' },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            fontSize: 14,
            fontWeight: 500,
            color: isActive ? '#2563eb' : '#64748b',
            borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
            paddingBottom: 4,
            textDecoration: 'none',
          })}
        >
          {label}
        </NavLink>
      ))}
      <button className="btn-ghost btn-sm" onClick={onLogout} style={{ marginLeft: 'auto' }}>
        Log out
      </button>
    </nav>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api.me().then((r) => setAuthed(r.authenticated)).catch(() => setAuthed(false));
  }, []);

  const handleLogout = () => {
    api.logout().then(() => setAuthed(false));
  };

  if (authed === null) return <div style={{ padding: 40, color: '#94a3b8' }}>Loading…</div>;

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <BrowserRouter>
      <Nav onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sites/:id" element={<SiteDetail />} />
        <Route path="/history" element={<History />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
