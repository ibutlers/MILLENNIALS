// ── Pure finance conversion utilities ──
// No React imports.

export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

export function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function bpsToPct(bps: number): string {
  return (bps / 100).toFixed(2);
}

export function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}
