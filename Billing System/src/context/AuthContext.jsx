import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setAccessToken, getAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    if (data?.accessToken) setAccessToken(data.accessToken);
    setUser(data?.user || null);
  }, []);

  // Restore session on load: try stored access token, then fall back to refresh cookie.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        if (getAccessToken()) {
          const res = await api.get('/auth/me');
          if (!cancelled) setUser(res.data.data.user);
          return;
        }
        const res = await api.post('/auth/refresh');
        if (!cancelled) applySession(res.data.data);
      } catch {
        setAccessToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      applySession(res.data.data);
      return res.data.data.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      permissions: user?.permissions || [],
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
