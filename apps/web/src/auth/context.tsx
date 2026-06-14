import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkAuthAvailable,
  fetchMe,
  login as loginApi,
  logout as logoutApi,
  type UserResponse,
  type LoginPayload,
} from './client';

export interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthAvailable: boolean | null; // null = still checking
  checkedAvailability: boolean;
}

export interface AuthActions {
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthAvailable, setIsAuthAvailable] = useState<boolean | null>(null);
  const [checkedAvailability, setCheckedAvailability] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // On mount: check if auth is available, and if so, fetch /me
  useEffect(() => {
    const controller = new AbortController();

    async function init() {
      try {
        const status = await checkAuthAvailable(controller.signal);
        if (!mountedRef.current) return;

        setIsAuthAvailable(status.available);
        setCheckedAvailability(true);

        if (status.available) {
          const me = await fetchMe(controller.signal);
          if (!mountedRef.current) return;
          setUser(me);
        } else {
          setUser(null);
        }
      } catch {
        if (!mountedRef.current) return;
        setIsAuthAvailable(false);
        setCheckedAvailability(true);
        setUser(null);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    }

    init();
    return () => controller.abort();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await loginApi(payload);

    // After successful login, fetch the full user profile
    const me = await fetchMe();
    if (!mountedRef.current) return;

    if (me) {
      setUser(me);
    } else {
      // Session cookie was set, but /me returned null — store minimal info
      setUser({ id: result.id, email: result.email, name: 'Usuario', roles: [], status: result.status, emailVerified: false, createdAt: '' });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Even if the API call fails, clear local state
    }
    if (mountedRef.current) setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isAuthAvailable) return;
    const me = await fetchMe();
    if (mountedRef.current) setUser(me);
  }, [isAuthAvailable]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    isAuthAvailable,
    checkedAvailability,
    login,
    logout,
    refreshUser,
  }), [user, isLoading, isAuthAvailable, checkedAvailability, login, logout, refreshUser]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
