import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('document metadata', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

  it('declares Spanish language, viewport and professional SEO metadata', () => {
    expect(html).toMatch(/<html\s+lang="es"/);
    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1"');
    expect(html).toMatch(/<title>Realstate \| Inversión inmobiliaria con disciplina y datos<\/title>/);
    expect(html).toContain('name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).not.toContain('rel="canonical"');
  });
});
