import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('health routes', () => {
  it('returns ok', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('ok');
  });
});
