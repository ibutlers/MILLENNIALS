import { describe, expect, it } from 'vitest';
import { DEMO_OPPORTUNITY_DISCLAIMER, seedOpportunities } from './db/seed.js';

describe('demo opportunity seed data', () => {
  it('contains 3 to 5 original demo opportunities and one private exclusion fixture', () => {
    const publicSeeds = seedOpportunities.filter((item) => item.visibility === 'public');
    expect(publicSeeds.length).toBeGreaterThanOrEqual(3);
    expect(publicSeeds.length).toBeLessThanOrEqual(5);
    expect(seedOpportunities.some((item) => item.visibility === 'private')).toBe(true);
  });

  it('uses integer money, basis points and non-competitor local assets', () => {
    for (const item of seedOpportunities) {
      expect(Number.isInteger(item.targetAmountCents)).toBe(true);
      expect(Number.isInteger(item.committedAmountCents)).toBe(true);
      expect(item.currency).toMatch(/^[A-Z]{3}$/);
      expect(item.image.url).toMatch(/^\/images\//);
      expect(item.title).not.toMatch(/urbanflip|competidor/i);
    }
    expect(DEMO_OPPORTUNITY_DISCLAIMER).toMatch(/carácter informativo/i);
    expect(DEMO_OPPORTUNITY_DISCLAIMER).toMatch(/no constituye una oferta/i);
  });
});
