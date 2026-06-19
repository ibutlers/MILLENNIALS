import { describe, expect, it, vi } from 'vitest';
import { makeClientId } from './ids';

describe('makeClientId', () => {
  it('uses crypto.randomUUID when available', () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    });

    expect(makeClientId()).toBe('11111111-1111-4111-8111-111111111111');

    vi.stubGlobal('crypto', originalCrypto);
  });

  it('falls back to getRandomValues when randomUUID is not available', () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });

    expect(makeClientId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    vi.stubGlobal('crypto', originalCrypto);
  });
});
