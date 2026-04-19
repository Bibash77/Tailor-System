import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const USER_KEY = 'tailor_user';

// ── Simple authFetch stub for local mode ─────────────────────────────────────────
export function authFetch(url, options = {}) {
  console.log('authFetch called (local mode):', url);
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  function login(userData) {
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  function updateUser(updates) {
    const updated = { ...user, ...updates };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    setUser(updated);
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