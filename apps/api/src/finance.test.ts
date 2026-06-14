import { describe, expect, it } from 'vitest';
import { calculateFundingProgress, serializeDate, serializeMoney, serializePercentage } from './opportunities/finance.js';

describe('financial serialization', () => {
  it('serializes integer cents without floating point money', () => {
    expect(serializeMoney(125000000, 'EUR')).toEqual({ cents: 125000000, currency: 'EUR', formatted: '1.250.000 €' });
    expect(serializeMoney(null, 'EUR')).toBeNull();
  });

  it('serializes basis points and null target returns', () => {
    expect(serializePercentage(825)).toEqual({ basisPoints: 825, decimal: 0.0825, formatted: '8,25%' });
    expect(serializePercentage(null)).toEqual({ basisPoints: null, decimal: null, formatted: null });
  });

  it('calculates funding progress safely and clamps extreme values', () => {
    expect(calculateFundingProgress(53000000, 125000000)).toBe(42.4);
    expect(calculateFundingProgress(2, 0)).toBe(0);
    expect(calculateFundingProgress(250, 100)).toBe(100);
  });

  it('serializes dates and null values', () => {
    expect(serializeDate('2026-10-15')).toBe('2026-10-15');
    expect(serializeDate(null)).toBeNull();
  });
});
