export interface AuthStatusResponse {
  available: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  roles: string[];
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  email: string;
  status: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface SessionData {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string | null;
  isCurrent: boolean;
}

async function jsonOrNull(res: Response) {
  try { return await res.json(); } catch { return null; }
}

/** Check if auth is available by hitting GET /api/v1/auth/me.
 *  If the API returns 503 (auth disabled), available=false. */
export async function checkAuthAvailable(signal?: AbortSignal): Promise<AuthStatusResponse> {
  const res = await fetch('/api/v1/auth/me', {
    signal,
    headers: { Accept: 'application/json' },
  });

  // 503 means auth is disabled
  if (res.status === 503) return { available: false };

  // 401 means auth is enabled but no valid session
  if (res.status === 401) return { available: true };

  // 200 means auth enabled and we have a session
  if (res.ok) return { available: true };

  // Any other error — assume auth is not available
  return { available: false };
}

/** Fetch current user. Returns null if not authenticated. */
export async function fetchMe(signal?: AbortSignal): Promise<UserResponse | null> {
  const res = await fetch('/api/v1/auth/me', {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (res.status === 503 || res.status === 401) return null;
  if (!res.ok) return null;

  const body = await res.json();
  return body.data ?? null;
}

/** POST /api/v1/auth/login */
export async function login(payload: LoginPayload, signal?: AbortSignal): Promise<LoginResponse> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await jsonOrNull(res);

  if (res.status === 503) {
    throw new AuthDisabledError(body?.error?.message ?? 'La autenticación no está disponible.');
  }

  if (res.status === 401) {
    throw new InvalidCredentialsError(body?.error?.message ?? 'Credenciales incorrectas.');
  }

  if (res.status === 403) {
    throw new AccountDisabledError(body?.error?.message ?? 'La cuenta está deshabilitada.');
  }

  if (res.status === 429) {
    throw new RateLimitedError(body?.error?.message ?? 'Demasiados intentos. Inténtalo más tarde.');
  }

  if (!res.ok) {
    throw new AuthError(body?.error?.message ?? 'No se ha podido iniciar sesión.');
  }

  return body.data;
}

/** POST /api/v1/auth/register */
export async function register(payload: RegisterPayload, signal?: AbortSignal): Promise<RegisterResponse> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await jsonOrNull(res);

  if (res.status === 503) {
    throw new AuthDisabledError(body?.error?.message ?? 'El registro no está disponible.');
  }

  if (res.status === 409) {
    throw new AuthError(body?.error?.message ?? 'No se ha podido completar el registro.');
  }

  if (!res.ok) {
    throw new AuthError(body?.error?.message ?? 'No se ha podido completar el registro.');
  }

  return body.data;
}

/** POST /api/v1/auth/logout */
export async function logout(signal?: AbortSignal): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    signal,
    headers: { Accept: 'application/json' },
  });
}

/** POST /api/v1/auth/verify-email */
export async function verifyEmail(token: string, signal?: AbortSignal): Promise<VerifyEmailResponse> {
  const res = await fetch('/api/v1/auth/verify-email', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  });

  const body = await jsonOrNull(res);

  if (res.status === 503) {
    throw new AuthDisabledError(body?.error?.message ?? 'La verificación no está disponible.');
  }

  if (!res.ok) {
    throw new AuthError(body?.error?.message ?? 'No se ha podido verificar el email.');
  }

  return body.data;
}

/** POST /api/v1/auth/forgot-password */
export async function forgotPassword(email: string, signal?: AbortSignal): Promise<ForgotPasswordResponse> {
  const res = await fetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  });

  const body = await jsonOrNull(res);

  if (res.status === 503) {
    throw new AuthDisabledError(body?.error?.message ?? 'La recuperación no está disponible.');
  }

  if (!res.ok) {
    throw new AuthError(body?.error?.message ?? 'No se ha podido procesar la solicitud.');
  }

  return body.data;
}

/** POST /api/v1/auth/reset-password */
export async function resetPassword(token: string, password: string, signal?: AbortSignal): Promise<ResetPasswordResponse> {
  const res = await fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  const body = await jsonOrNull(res);

  if (res.status === 503) {
    throw new AuthDisabledError(body?.error?.message ?? 'El restablecimiento no está disponible.');
  }

  if (!res.ok) {
    throw new AuthError(body?.error?.message ?? 'No se ha podido restablecer la contraseña.');
  }

  return body.data;
}

/** GET /api/v1/auth/sessions */
export async function fetchSessions(signal?: AbortSignal): Promise<SessionData[]> {
  const res = await fetch('/api/v1/auth/sessions', {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const body = await res.json();
  return body.data ?? [];
}

/** DELETE /api/v1/auth/sessions/:id */
export async function revokeSession(sessionId: string, signal?: AbortSignal): Promise<void> {
  await fetch(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    signal,
    headers: { Accept: 'application/json' },
  });
}

// ── Custom error classes ──
export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthError'; }
}
export class AuthDisabledError extends AuthError {
  constructor(message: string) { super(message); this.name = 'AuthDisabledError'; }
}
export class InvalidCredentialsError extends AuthError {
  constructor(message: string) { super(message); this.name = 'InvalidCredentialsError'; }
}
export class AccountDisabledError extends AuthError {
  constructor(message: string) { super(message); this.name = 'AccountDisabledError'; }
}
export class RateLimitedError extends AuthError {
  constructor(message: string) { super(message); this.name = 'RateLimitedError'; }
}
