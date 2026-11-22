import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiRequest,
  clearSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  saveSession
} from '../api/client';
import type { AuthUser, LoginResponse } from '../types/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(() => Boolean(getStoredAccessToken()));

  useEffect(() => {
    if (!getStoredAccessToken()) {
      setLoading(false);
      return;
    }
    apiRequest<{ user: AuthUser }>('/auth/me')
      .then(res => {
        setUser(res.user);
        localStorage.setItem('viendong_auth_user', JSON.stringify(res.user));
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true
    });
    saveSession(res);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    try {
      await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      // Ignore network errors during logout
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user?.permissions?.includes(permission)),
    [user]
  );

  const hasAnyPermission = useCallback(
    (...permissions: string[]) => permissions.some(p => user?.permissions?.includes(p)),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
