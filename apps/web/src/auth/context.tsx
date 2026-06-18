 
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
import { AccountDisabledError, AuthDisabledError, AuthResponseError, InvalidCredentialsError, RateLimitedError } from './client';

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

    const resp = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: payload.email, password: payload.password }),
    });

    const contentType = resp.headers.get('content-type') || '';
    const responsePayload: unknown = contentType.includes('application/json') ? await resp.json().catch(() => null) : await resp.text().catch(() => '');

    if (!resp.ok) {
      throw mapLoginError(resp, responsePayload);
    }

    if (responsePayload && typeof responsePayload === 'object' && 'error' in responsePayload && (responsePayload as { error?: unknown }).error) {
      throw mapLoginError(resp, responsePayload);
    }

    const sessionData = await readSessionFromClient(client);
    if (sessionData?.user) {
      const userData = sessionData.user;
      setUser(toAuthUser(userData));
      setIsAuthenticated(true);
      if (sessionData.session) {
        setSession({
          id: sessionData.session.id,
          expiresAt: new Date(sessionData.session.expiresAt),
        });
      }
      return;
    }

    throw new Error('Login completed without session');
  }, [client, baseURL]);

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
    const resp = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(invitationToken ? { 'X-Invitation-Token': invitationToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    const contentType = resp.headers.get('content-type') || '';
    const payload: unknown = contentType.includes('application/json') ? await resp.json().catch(() => null) : await resp.text().catch(() => '');

    if (!resp.ok) {
      throw new Error(readAuthErrorMessage(payload, resp.status));
    }

    if (!payload || (typeof payload === 'object' && 'error' in payload && (payload as { error?: unknown }).error)) {
      throw new Error(readAuthErrorMessage(payload, resp.status));
    }
  }, [client, baseURL]);

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

type BetterAuthUserLike = {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  role?: string;
  createdAt?: string;
};

type BetterAuthSessionLike = {
  user?: BetterAuthUserLike;
  session?: { id: string; expiresAt: string | Date };
};

async function readSessionFromClient(client: ReturnType<typeof createAuthClient>): Promise<BetterAuthSessionLike | null> {
  const res = await client.getSession() as { data?: BetterAuthSessionLike | null };
  return res.data || null;
}

function toAuthUser(userData: BetterAuthUserLike): AuthUser {
  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    emailVerified: userData.emailVerified || false,
    twoFactorEnabled: userData.twoFactorEnabled || false,
    roles: userData.role ? [userData.role] : ['investor'],
    status: 'active',
    createdAt: userData.createdAt,
  };
}

function mapLoginError(response: Response, payload: unknown): Error {
  if (response.status === 503) return new AuthDisabledError(response);
  if (response.status === 401) return new InvalidCredentialsError(response);
  if (response.status === 429) return new RateLimitedError(response);
  if (response.status === 403) return new AccountDisabledError(response);

  const message = readAuthErrorMessage(payload, response.status);
  return new AuthResponseError(message, response);
}

function readAuthErrorMessage(payload: unknown, status: number): string {
  const generic = 'No hemos podido completar la activación. Revisa los datos o solicita un nuevo enlace si el problema continúa.';
  if (payload && typeof payload === 'object') {
    const maybe = payload as { error?: { message?: unknown; code?: unknown }; message?: unknown; code?: unknown };
    const code = String(maybe.error?.code || maybe.code || '');
    const message = typeof maybe.error?.message === 'string'
      ? maybe.error.message
      : typeof maybe.message === 'string'
        ? maybe.message
        : '';
    if (code.includes('invalid_invitation')) return 'La invitación no es válida, ha expirado o ya ha sido utilizada.';
    if (code.includes('user_already_exists') || code.includes('already') || status === 409) return 'Ya existe una cuenta para este email. Usa recuperación de acceso o solicita ayuda al equipo.';
    if (message && !message.toLowerCase().includes('password') && !message.toLowerCase().includes('token')) return message;
  }
  if (status === 403) return 'La invitación no es válida, ha expirado o ya ha sido utilizada.';
  if (status >= 500) return 'No hemos podido completar la activación en este momento. Inténtalo más tarde o contacta con el equipo.';
  return generic;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
