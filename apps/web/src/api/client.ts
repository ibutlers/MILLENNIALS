const BASE = '';

type FetchOptions = Omit<RequestInit, 'body'> & { body?: string };

export async function apiFetch<T = Record<string, unknown>>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `HTTP ${response.status}`) as Error & {
      status: number;
      code: string;
      currentVersion?: number;
      providedVersion?: number;
    };
    err.status = response.status;
    err.code = body?.error?.code || 'unknown';
    err.currentVersion = body?.error?.currentVersion;
    err.providedVersion = body?.error?.providedVersion;
    throw err;
  }

  return response.json();
}
