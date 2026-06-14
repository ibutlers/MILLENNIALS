export type SerializedMoney = {
  cents: number;
  currency: string;
  formatted: string;
};

export type SerializedPercentage = {
  basisPoints: number | null;
  decimal: number | null;
  formatted: string | null;
};

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string) {
  const key = `es-ES:${currency}`;
  const existing = moneyFormatters.get(key);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 0 });
  moneyFormatters.set(key, formatter);
  return formatter;
}

export function serializeMoney(cents: number | string | bigint | null, currency: string): SerializedMoney | null {
  if (cents === null) return null;
  const numeric = typeof cents === 'bigint' ? Number(cents) : Number(cents);
  if (!Number.isSafeInteger(numeric)) throw new Error('Unsafe money amount');
  return { cents: numeric, currency, formatted: moneyFormatter(currency).format(numeric / 100) };
}

export function serializePercentage(basisPoints: number | null): SerializedPercentage {
  if (basisPoints === null) return { basisPoints: null, decimal: null, formatted: null };
  return { basisPoints, decimal: basisPoints / 10_000, formatted: `${(basisPoints / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })}%` };
}

export function calculateFundingProgress(committedCents: number | string | bigint, targetCents: number | string | bigint) {
  const committed = Number(committedCents);
  const target = Number(targetCents);
  if (!Number.isFinite(committed) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((committed / target) * 10_000) / 100));
}

export function serializeDate(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function serializeDateTime(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
