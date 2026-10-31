import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types/index.js';
import { apiFetch, setAuthToken, getAuthToken } from '../api/client.js';
import { signInWithPasskey, passkeysSupported } from '../utils/passkeys.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authDisabled: boolean;
  hasUsers: boolean;
  passkeyAvailable: boolean;
  passkeyUnavailableReason: string | null;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<{ requires2FA?: boolean; tempToken?: string } | void>;
  verify2Fa: (tempToken: string, code: string) => Promise<any>;
  register: (email: string, pass: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  loginWithRecoveryCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [hasUsers, setHasUsers] = useState(true);
  const [serverPasskeyAvailable, setServerPasskeyAvailable] = useState(false);
  const [passkeyUnavailableReason, setPasskeyUnavailableReason] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/auth/status')
        .then((r) => r.json())
        .catch(() => null);

      if (typeof statusRes?.hasUsers === 'boolean') {
        setHasUsers(statusRes.hasUsers);
      }
      setServerPasskeyAvailable(statusRes?.passkeyAvailable === true);
      setPasskeyUnavailableReason(statusRes?.passkeyUnavailableReason || null);

      if (statusRes?.isProxyAuth && statusRes.user) {
        setUser(statusRes.user);
        setAuthDisabled(false);
        setLoading(false);
        return;
      }

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
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
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

  const login = async (email: string, pass: string, rememberMe = true) => {
    const res = await apiFetch<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass, rememberMe }),
    });
    if (res?.requires2FA) {
      return { requires2FA: true, tempToken: res.tempToken };
    }
    setAuthToken(res.accessToken);
    setUser(res.user);
  };

  const verify2Fa = async (tempToken: string, code: string) => {
    const res = await apiFetch<any>('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    });
    setAuthToken(res.accessToken);
    setUser(res.user);
    return res;
  };

  const loginWithPasskey = async () => {
    const res = await signInWithPasskey();
    setAuthToken(res.accessToken);
    setUser(res.user);
  };

  const loginWithRecoveryCode = async (code: string) => {
    const res = await apiFetch<{ accessToken: string; user: User }>('/api/auth/recovery/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
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
        hasUsers,
        passkeyAvailable: serverPasskeyAvailable && passkeysSupported(),
        passkeyUnavailableReason:
          passkeyUnavailableReason ||
          (serverPasskeyAvailable && !passkeysSupported() ? 'Deze browser ondersteunt geen passkeys.' : null),
        login,
        verify2Fa,
        register,
        loginWithPasskey,
        loginWithRecoveryCode,
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
