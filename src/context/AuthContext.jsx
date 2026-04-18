import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// ── Authenticated fetch helper ────────────────────────────────────────────────
// Automatically attaches the stored JWT to every request and JSON-stringifies body.
export function authFetch(url, { body, ...options } = {}) {
  const token = localStorage.getItem('auth_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // { email, shopName } or null
  const [loading, setLoading] = useState(true);   // true while verifying stored token

  // On mount, verify the stored JWT with the server
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user: u }) => setUser(u))
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem('auth_token', token);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setUser(null);
  }

  // Called after profile update to sync sidebar without re-login
  function updateUser(updates) {
    setUser(prev => ({ ...prev, ...updates }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
