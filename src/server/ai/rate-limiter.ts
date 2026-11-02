interface RateLimitBucket {
  timestamps: number[];
}

class InMemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 15) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Periodic cleanup of stale buckets every 5 minutes
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  isRateLimited(key: string): { limited: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Filter out timestamps outside the active sliding window
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= this.maxRequests) {
      const oldest = bucket.timestamps[0];
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return { limited: true, remaining: 0, resetMs };
    }

    bucket.timestamps.push(now);
    return {
      limited: false,
      remaining: this.maxRequests - bucket.timestamps.length,
      resetMs: this.windowMs,
    };
  }

  private cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }
  }
}

// 15 messages per minute per session
export const sessionRateLimiter = new InMemoryRateLimiter(60000, 15);

// 30 messages per minute per IP
export const ipRateLimiter = new InMemoryRateLimiter(60000, 30);
