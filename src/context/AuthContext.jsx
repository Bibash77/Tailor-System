import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const API_BASE = process.env.REACT_APP_API_URL || '';

// Attaches JWT token to every request and JSON-stringifies body
export function authFetch(url, { body, ...options } = {}) {
  const token = localStorage.getItem('auth_token');
  return fetch(API_BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: verify stored JWT with MongoDB via /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }

    fetch(API_BASE + '/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        // Only invalidate on explicit auth rejection, not network/server errors
        if (r.status === 401 || r.status === 403) {
          localStorage.removeItem('auth_token');
          return null;
        }
        if (r.ok) return r.json();
        // Server error (500, timeout, cold start) — keep token, try again next load
        return null;
      })
      .then(data => { if (data?.user) setUser(data.user); })
      .catch(() => {
        // Network failure (offline, DNS, cold start) — keep token, don't log out
      })
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem('auth_token', token);
    setUser(userData);
  }

  // Call after any action that might change subscription status
  async function refreshSubscription() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const r = await fetch(API_BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); if (d?.user) setUser(d.user); }
    } catch {}
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setUser(null);
  }

  function updateUser(updates) {
    setUser(prev => ({ ...prev, ...updates }));
  }

  function refreshSession(token, userData) {
    localStorage.setItem('auth_token', token);
    setUser(userData);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, refreshSession, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
