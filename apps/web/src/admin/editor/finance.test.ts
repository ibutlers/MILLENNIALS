import { describe, expect, it } from 'vitest';
import { eurToCents, parseLocaleNumber, pctToBps } from './finance';

describe('finance editor helpers', () => {
  it('parses Spanish and English formatted numbers safely', () => {
    expect(parseLocaleNumber('1.234.567,89')).toBe(1234567.89);
    expect(parseLocaleNumber('1,234,567.89')).toBe(1234567.89);
    expect(parseLocaleNumber('6.500.000')).toBe(6500000);
    expect(parseLocaleNumber('6,500,000')).toBe(6500000);
    expect(parseLocaleNumber('250000')).toBe(250000);
    expect(parseLocaleNumber('')).toBe(0);
    expect(parseLocaleNumber('abc')).toBe(0);
  });

  it('converts invalid or negative values to safe non-negative integers', () => {
    expect(eurToCents(parseLocaleNumber('1.000,50'))).toBe(100050);
    expect(eurToCents(Number.NaN)).toBe(0);
    expect(pctToBps(parseLocaleNumber('8,25'))).toBe(825);
    expect(pctToBps(Number.NaN)).toBe(0);
  });
});
