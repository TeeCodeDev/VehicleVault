import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types/index.js';
import { apiFetch, setAuthToken, getAuthToken } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initUser() {
      if (getAuthToken()) {
        try {
          const res = await apiFetch<{ user: User }>('/api/auth/me');
          setUser(res.user);
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
    }

    initUser();

    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

