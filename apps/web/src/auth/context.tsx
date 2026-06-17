 
/**
 * Auth Context — Better Auth integration
 *
 * Provides:
 * - isAuthAvailable: boolean | null
 * - isAuthenticated: boolean
 * - isLoading: boolean
 * - checkedAvailability: boolean
 * - user: current user info (backward-compatible AuthUser)
 * - session: current session info
 * - login, logout, signUp functions
 *
 * When AUTH_MODE=*** no client is instantiated.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createAuthClient } from 'better-auth/client';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
  // Backward compat with legacy AuthState
  roles?: string[];
  status?: string;
  createdAt?: string;
}

export interface AuthState {
  isAuthAvailable: boolean | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkedAvailability: boolean;
  user: AuthUser | null;
  session: { id: string; expiresAt: Date } | null;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, name: string, invitationToken: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, baseURL }: { children: ReactNode; baseURL: string }) {
  const [isAuthAvailable, setIsAuthAvailable] = useState<boolean | null>(null);
  const [checkedAvailability, setCheckedAvailability] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthState['session']>(null);

  // Check auth availability
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${baseURL}/api/config/public`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setIsAuthAvailable(data.authEnabled === true);
        setCheckedAvailability(true);
      })
      .catch(() => {
        setIsAuthAvailable(false);
        setCheckedAvailability(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [baseURL]);

  // Initialize Better Auth client when available
  const [client, setClient] = useState<ReturnType<typeof createAuthClient> | null>(null);

  useEffect(() => {
    if (isAuthAvailable) {
      const c = createAuthClient({
        baseURL: `${baseURL}/api/auth`,
      });
      setClient(c);

      // Check existing session
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.getSession().then((res: any) => {
        const sessionData = res.data;
        if (sessionData?.user) {
          const userData = sessionData.user;
          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            emailVerified: userData.emailVerified || false,
            twoFactorEnabled: userData.twoFactorEnabled || false,
            roles: userData.role ? [userData.role] : ['investor'],
            status: 'active',
            createdAt: userData.createdAt,
          });
          setIsAuthenticated(true);
          if (sessionData.session) {
            setSession({
              id: sessionData.session.id,
              expiresAt: new Date(sessionData.session.expiresAt),
            });
          }
        }
      }).catch(() => {});
    }
  }, [isAuthAvailable, baseURL]);

  const login = useCallback(async (payload: { email: string; password: string }) => {
    if (!client) throw new Error('Auth not available');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.signIn.email({ email: payload.email, password: payload.password });
    if (result.error) throw new Error(result.error.message || 'Login failed');
    if (result.data?.user) {
      const userData = result.data.user;
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        emailVerified: userData.emailVerified || false,
        twoFactorEnabled: userData.twoFactorEnabled || false,
        roles: userData.role ? [userData.role] : ['investor'],
        status: 'active',
        createdAt: userData.createdAt,
      });
      setIsAuthenticated(true);
    }
  }, [client]);

  const logout = useCallback(async () => {
    if (!client) {
      setIsAuthenticated(false);
      return;
    }
    await client.signOut();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
  }, [client]);

  const signUp = useCallback(async (email: string, password: string, name: string, invitationToken: string) => {
    if (!client) throw new Error('Auth not available');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.signUp.email(
      { email, password, name },
      {
        headers: invitationToken ? { 'X-Invitation-Token': invitationToken } : undefined,
      },
    );
    if (result.error) throw new Error(result.error.message || 'Sign up failed');
  }, [client]);

  const refreshSession = useCallback(async () => {
    if (!client) return;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await client.getSession();
    const sessionData = res.data;
    if (sessionData?.user) {
      const userData = sessionData.user;
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        emailVerified: userData.emailVerified || false,
        twoFactorEnabled: userData.twoFactorEnabled || false,
        roles: userData.role ? [userData.role] : ['investor'],
        status: 'active',
        createdAt: userData.createdAt,
      });
      setIsAuthenticated(true);
      if (sessionData.session) {
        setSession({
          id: sessionData.session.id,
          expiresAt: new Date(sessionData.session.expiresAt),
        });
      }
    } else {
      setUser(null);
      setSession(null);
      setIsAuthenticated(false);
    }
  }, [client]);

  return (
    <AuthContext.Provider value={{
      isAuthAvailable,
      isAuthenticated,
      isLoading: isLoading || !checkedAvailability,
      checkedAvailability,
      user,
      session,
      login,
      logout,
      signUp,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
