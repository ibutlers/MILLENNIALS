export interface InvestorProject {
  id: string;
  slug: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  city: string | null;
  status: string;
  risk_level?: string | null;
  target_return_type?: string | null;
  target_return_bps?: number | null;
  target_amount_cents: number;
  committed_amount_cents: number;
  estimated_term_months?: number | null;
  investor_committed_amount_cents: number;
  investor_currency: string;
  investor_notes?: string | null;
}

export interface InvestorDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  mime_type: string | null;
  byte_size: number | string | null;
  created_at: string;
  project_id?: string;
  project_slug?: string;
  project_title?: string;
}

export interface InvestmentRequest {
  public_reference: string;
  status: string;
  opportunity_slug: string;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  transfer_reference: string | null;
}

export type InvestorApiErrorKind = 'unauthorized' | 'forbidden' | 'server' | 'network' | 'unknown';

export class InvestorApiError extends Error {
  status: number;
  code?: string;
  kind: InvestorApiErrorKind;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'InvestorApiError';
    this.status = status;
    this.code = code;
    this.kind = status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : status >= 500
          ? 'server'
          : 'unknown';
  }
}

export async function fetchInvestorJson<T>(path: string, signal?: AbortSignal, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw Object.assign(new InvestorApiError('No hay conexión con el área privada.', 0), { kind: 'network' as const });
  }

  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string }; data?: T } | null;
  if (!response.ok) {
    throw new InvestorApiError(
      body?.error?.message || defaultInvestorErrorMessage(response.status),
      response.status,
      body?.error?.code,
    );
  }
  return (body?.data ?? body) as T;
}

export function defaultInvestorErrorMessage(status: number): string {
  if (status === 401) return 'Tu sesión no está activa. Vuelve a iniciar sesión.';
  if (status === 403) return 'Tu usuario no tiene permisos para ver este recurso.';
  if (status >= 500) return 'El área privada no está disponible temporalmente.';
  return 'No hemos podido completar la operación.';
}

export function formatMoney(centsValue: number | string | null | undefined, currency = 'EUR'): string {
  const cents = Number(centsValue ?? 0);
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency });
}

export function formatBytes(value: number | string | null | undefined): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Tamaño no disponible';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function investorErrorTitle(error: InvestorApiError): string {
  if (error.kind === 'unauthorized') return 'Sesión caducada';
  if (error.kind === 'forbidden') return 'Sin permisos';
  if (error.kind === 'server') return 'Servicio temporalmente no disponible';
  if (error.kind === 'network') return 'Sin conexión';
  return 'No se ha podido cargar la información';
}
