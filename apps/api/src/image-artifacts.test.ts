/**
 * API build artifact tests — validates that the TypeScript build produces
 * the required runtime artifacts (migrate.js, seed.js, baseline SQL).
 *
 * These tests validate the local dist/ output from `pnpm build`.
 * Docker image validation is handled by the E2E test suite.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// CWD for api tests is apps/api/ (set by vitest workspace)
const DIST_ROOT = resolve(process.cwd(), 'dist');

const REQUIRED_ARTIFACTS = [
  'db/migrate.js',
  'db/seed.js',
  'db/migrations/0001_baseline_definitive.sql',
];

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('API build artifacts', () => {
  it('contains migrate.js, seed.js, and baseline SQL in dist/', () => {
    for (const artifact of REQUIRED_ARTIFACTS) {
      const fullPath = resolve(DIST_ROOT, artifact);
      expect(existsSync(fullPath), `${artifact} should exist in dist/`).toBe(true);
    }
  });

  it('baseline SQL in dist/ matches source checksum', () => {
    const distBaseline = resolve(DIST_ROOT, 'db/migrations/0001_baseline_definitive.sql');
    const srcBaseline = resolve(process.cwd(), 'src/db/migrations/0001_baseline_definitive.sql');

    const distHash = sha256(distBaseline);
    const srcHash = sha256(srcBaseline);

    expect(distHash).toBe(srcHash);

    // Baseline 0001 is IMMUTABLE — SHA-256 fixed at creation
    expect(srcHash).toBe('2e4fab57f6e5227444a7d881243b8d63cddf1a2369ac5c942f1ed0e96fade1f8');
  });

  it('migrate.js is a valid JavaScript module', () => {
    const content = readFileSync(resolve(DIST_ROOT, 'db/migrate.js'), 'utf-8');
    // Must be a valid JS module (CJS or ESM)
    expect(content).toMatch(/exports\.|module\.exports|require\(|import .* from|export /);
    expect(content.length).toBeGreaterThan(100);
  });

  it('seed.js is a valid JavaScript module', () => {
    const content = readFileSync(resolve(DIST_ROOT, 'db/seed.js'), 'utf-8');
    expect(content).toMatch(/exports\.|module\.exports|require\(|import .* from|export /);
    expect(content.length).toBeGreaterThan(100);
  });
});
