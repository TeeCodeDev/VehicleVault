import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types/index.js';
import { apiFetch, setAuthToken, getAuthToken } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authDisabled: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/auth/status')
        .then((r) => r.json())
        .catch(() => null);

      if (statusRes?.authDisabled) {
        setAuthDisabled(true);
        if (statusRes.user) {
          setUser(statusRes.user);
        }
        setLoading(false);
        return;
      } else {
        setAuthDisabled(false);
      }
    } catch {
      // Continue normal auth check
    }

    if (getAuthToken()) {
      try {
        const res = await apiFetch<{ user: User; authDisabled?: boolean }>('/api/auth/me');
        setUser(res.user);
        if (res.authDisabled) setAuthDisabled(true);
      } catch {
        setAuthToken(null);
        setUser(null);
      }
    } else {
      // Attempt cookie refresh
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setAuthToken(data.accessToken);
          setUser(data.user);
        }
      } catch {
        // ignore unauthenticated
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      if (!authDisabled) {
        setUser(null);
      }
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [checkAuth, authDisabled]);

  const login = async (email: string, pass: string) => {
    const res = await apiFetch<{ accessToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setAuthToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (email: string, pass: string) => {
    const res = await apiFetch<{ accessToken: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setAuthToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    if (!authDisabled) {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authDisabled,
        login,
        register,
        logout,
        refreshAuthStatus: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
