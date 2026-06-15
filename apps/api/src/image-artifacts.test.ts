import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

const REQUIRED_ARTIFACTS = [
  'apps/api/dist/db/migrate.js',
  'apps/api/dist/db/seed.js',
  'apps/api/dist/db/migrations/0001_baseline_definitive.sql',
];

describe('API Docker image artifacts', () => {
  it('contains migrate.js, seed.js, and baseline SQL', () => {
    for (const artifact of REQUIRED_ARTIFACTS) {
      try {
        // Check inside the built image (requires docker)
        const result = execSync(
          `docker run --rm --entrypoint sh realstate-api-fix -c "test -f ${artifact} && echo OK || echo MISSING"`,
          { encoding: 'utf8', timeout: 10000 }
        ).trim();
        expect(result, `${artifact} should exist in image`).toBe('OK');
      } catch (error) {
        // If docker isn't available, skip gracefully
        if (error instanceof Error && (error.message.includes('command not found') || error.message.includes('ENOENT'))) {
          console.warn('Docker not available — skipping image artifact test');
          return;
        }
        throw error;
      }
    }
  }, 15000);

  it('baseline SQL in image matches source checksum', () => {
    try {
      const imageChecksum = execSync(
        'docker run --rm --entrypoint sh realstate-api-fix -c "sha256sum apps/api/dist/db/migrations/0001_baseline_definitive.sql | cut -d\\" \\" -f1"',
        { encoding: 'utf8', timeout: 10000 }
      ).trim();

      const sourceChecksum = execSync(
        'sha256sum apps/api/src/db/migrations/0001_baseline_definitive.sql | cut -d" " -f1',
        { encoding: 'utf8', timeout: 5000, cwd: process.cwd() + '/../..' }
      ).trim();

      expect(imageChecksum).toBe(sourceChecksum);
      // Baseline is immutable
      expect(sourceChecksum).toBe('2e4fab57f6e5227444a7d881243b8d63cddf1a2369ac5c942f1ed0e96fade1f8');
    } catch (error) {
      if (error instanceof Error && (error.message.includes('command not found') || error.message.includes('ENOENT'))) {
        console.warn('Docker not available — skipping checksum test');
        return;
      }
      throw error;
    }
  }, 15000);
});
