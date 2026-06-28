// ── Pure finance conversion utilities ──
// No React imports.

export function parseLocaleNumber(value: string): number {
  const raw = value.trim().replace(/\s/g, '');
  if (!raw) return 0;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  let normalized = raw;

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = raw.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '').replace(decimalSeparator, '.');
  } else if (hasComma) {
    const parts = raw.split(',');
    const last = parts.at(-1) ?? '';
    normalized = parts.length > 2 || last.length === 3 ? parts.join('') : raw.replace(',', '.');
  } else if (hasDot) {
    const parts = raw.split('.');
    const last = parts.at(-1) ?? '';
    normalized = parts.length > 2 || last.length === 3 ? parts.join('') : raw;
  }

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
