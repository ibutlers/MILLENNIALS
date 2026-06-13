import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('private area product architecture documentation', () => {
  const spec = readFileSync(resolve(__dirname, '../../../docs/product-spec.md'), 'utf8');

  it('documents future onboarding, private area, opportunity detail, investment flow and portfolio boundaries', () => {
    expect(spec).toContain('/onboarding/elegibilidad');
    expect(spec).toContain('/onboarding/identidad');
    expect(spec).toContain('/inversores/oportunidades/:slug');
    expect(spec).toContain('Estado de verificación');
    expect(spec).toContain('Simulador futuro');
    expect(spec).toContain('Flujo de inversión futuro');
    expect(spec).toContain('Cartera futura');
    expect(spec).toContain('Actualizaciones y documentos');
  });

  it('states that Hito 1 must not implement real authentication, KYC, payments or investments', () => {
    expect(spec).toMatch(/No implementar todavía autenticación real/i);
    expect(spec).toMatch(/No crear formularios que aparenten enviar emails o autenticar/i);
    expect(spec).toMatch(/No implementar todavía cálculos financieros reales/i);
    expect(spec).toMatch(/Debe ser imposible invertir si faltan/i);
  });
});
