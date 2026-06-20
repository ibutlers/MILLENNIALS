/**
 * Auth API Client — thin wrapper around fetch for legacy endpoints.
 *
 * Kept for backward compatibility with existing auth pages
 * (LoginPage, RegisterPage, RecoverAccessPage, etc.).
 * New code should use Better Auth client from context.tsx.
 */

// ── Error classes (kept for backward compat) ──

export class AuthResponseError extends Error {
  response: Response;
  constructor(message: string, response: Response) {
    super(message);
    this.name = 'AuthResponseError';
    this.response = response;
  }
}

export class AuthDisabledError extends AuthResponseError {
  constructor(response: Response) { super('Auth disabled', response); this.name = 'AuthDisabledError'; }
}

export class InvalidCredentialsError extends AuthResponseError {
  constructor(response: Response) { super('Invalid credentials', response); this.name = 'InvalidCredentialsError'; }
}

export class RateLimitedError extends AuthResponseError {
  constructor(response: Response) { super('Rate limited', response); this.name = 'RateLimitedError'; }
}

export class AccountDisabledError extends AuthResponseError {
  constructor(response: Response) { super('Account disabled', response); this.name = 'AccountDisabledError'; }
}

export class TwoFactorRequiredError extends AuthResponseError {
  constructor(response: Response) { super('Two-factor verification required', response); this.name = 'TwoFactorRequiredError'; }
}

// ── Legacy API functions ──

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

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface SessionData {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string | null;
  isCurrent: boolean;
}

const API_BASE = '/api/v1/auth';

async function apiFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 503) throw new AuthDisabledError(response);
    if (response.status === 401) throw new InvalidCredentialsError(response);
    if (response.status === 429) throw new RateLimitedError(response);
    if (response.status === 403) throw new AccountDisabledError(response);
    throw new AuthResponseError('Request failed', response);
  }
  return response.json();
}

export async function checkAuthAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch('/api/config/public', { signal });
    const data = await r.json();
    return data.authEnabled === true;
  } catch {
    return false;
  }
}

export async function fetchMe(): Promise<{ data: UserResponse }> {
  return apiFetch('/me');
}

export async function login(payload: LoginPayload): Promise<{ data: UserResponse }> {
  return apiFetch('/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logout(): Promise<{ data: { message: string } }> {
  return apiFetch('/logout', { method: 'POST' });
}

export async function register(payload: RegisterPayload): Promise<{ data: UserResponse }> {
  return apiFetch('/register', { method: 'POST', body: JSON.stringify(payload) });
}

export async function verifyEmail(token: string): Promise<{ data: { message: string } }> {
  return apiFetch('/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function resendVerification(email: string): Promise<{ data: { message: string } }> {
  return apiFetch('/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
}

async function betterAuthFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/auth${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 503) throw new AuthDisabledError(response);
    if (response.status === 401) throw new InvalidCredentialsError(response);
    if (response.status === 429) throw new RateLimitedError(response);
    if (response.status === 403) throw new AccountDisabledError(response);
    throw new AuthResponseError('Request failed', response);
  }
  return response.json().catch(() => ({ status: true }));
}

export async function forgotPassword(email: string): Promise<{ data: { message: string } }> {
  await betterAuthFetch('/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email, redirectTo: '/acceso/restablecer' }),
  });
  return { data: { message: 'Si la cuenta existe, recibirás instrucciones para restablecer la contraseña.' } };
}

export async function resetPassword(token: string, password: string): Promise<{ data: { message: string } }> {
  await betterAuthFetch(`/reset-password?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ newPassword: password }),
  });
  return { data: { message: 'Contraseña restablecida.' } };
}

export async function fetchSessions(): Promise<{ data: SessionData[] }> {
  return apiFetch('/sessions');
}

export async function revokeSession(sessionId: string): Promise<{ data: { message: string } }> {
  return apiFetch(`/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function revokeAllSessions(): Promise<{ data: { message: string } }> {
  return apiFetch('/sessions', { method: 'DELETE' });
}
