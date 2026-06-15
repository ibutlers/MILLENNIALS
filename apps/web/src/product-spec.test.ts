import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('private area product architecture documentation', () => {
  const spec = readFileSync(resolve(__dirname, '../../../docs/product-spec.md'), 'utf8');

  it('documents current state, disabled features, empty states and pending work', () => {
    expect(spec).toContain('Hito 11');
    expect(spec).toContain('Autenticación');
    expect(spec).toContain('KYC');
    expect(spec).toContain('inversor');
    expect(spec).toContain('Hito 12+');
    expect(spec).toContain('Hito 11');
    expect(spec).toContain('503');
  });

  it('documents that authentication, KYC, payments and investments are disabled in production', () => {
    expect(spec).toMatch(/AUTH_ENABLED.*503|REGISTRATION_ENABLED.*false/i);
    expect(spec).toMatch(/KYC|kyc/i);
    expect(spec).toMatch(/inversión real|Pagos/i);
    expect(spec).toMatch(/desactivado/i);
  });
});
