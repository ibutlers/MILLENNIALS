export class AuthRateLimiter {
  private attempts: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(
    private maxAttempts: number,
    private windowMs: number,
  ) {}

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.attempts.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.maxAttempts - 1 };
    }

    entry.count++;
    if (entry.count > this.maxAttempts) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: this.maxAttempts - entry.count };
  }
}
