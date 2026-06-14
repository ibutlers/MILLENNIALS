type Bucket = { count: number; resetAt: number };

export class OriginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly max: number, private readonly windowMs: number) {}

  check(origin: string, now = Date.now()) {
    const current = this.buckets.get(origin);
    if (!current || current.resetAt <= now) {
      this.buckets.set(origin, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, resetAt: now + this.windowMs };
    }
    if (current.count >= this.max) return { allowed: false, resetAt: current.resetAt };
    current.count += 1;
    return { allowed: true, resetAt: current.resetAt };
  }
}
