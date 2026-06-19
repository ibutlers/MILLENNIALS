// ── Pure finance conversion utilities ──
// No React imports.

export function parseLocaleNumber(value: string): number {
  const raw = value.trim().replace(/\s/g, '');
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';
  const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
  const normalized = raw
    .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
    .replace(decimalSeparator, '.');
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ''));

  return Number.isFinite(parsed) ? parsed : 0;
}

export function eurToCents(eur: number): number {
  return Math.max(0, Math.round((Number.isFinite(eur) ? eur : 0) * 100));
}

export function centsToEur(cents: number): string {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return (safeCents / 100).toFixed(2);
}

export function bpsToPct(bps: number): string {
  const safeBps = Number.isFinite(bps) ? bps : 0;
  return (safeBps / 100).toFixed(2);
}

export function pctToBps(pct: number): number {
  return Math.max(0, Math.round((Number.isFinite(pct) ? pct : 0) * 100));
}
