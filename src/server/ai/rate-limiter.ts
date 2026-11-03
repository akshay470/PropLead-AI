import { db } from "../db";
import { rateLimitBuckets } from "../db/schema";
import { eq } from "drizzle-orm";

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetMs: number;
}

interface InMemoryBucket {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private buckets = new Map<string, InMemoryBucket>();
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

  isRateLimited(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

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

// In-memory singletons for fast synchronous access and unit tests
export const sessionRateLimiter = new InMemoryRateLimiter(60000, 15);
export const ipRateLimiter = new InMemoryRateLimiter(60000, 30);

/**
 * DB-backed Rate Limiter for serverless instances (PostgreSQL-backed atomic window).
 * If the database is temporarily unreachable, it falls back gracefully to in-memory limiting.
 */
export async function checkDbRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60000,
  dbOrTx: any = db
): Promise<RateLimitResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);

  try {
    const [existing] = await dbOrTx
      .select({
        key: rateLimitBuckets.key,
        windowStart: rateLimitBuckets.windowStart,
        count: rateLimitBuckets.count,
      })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, key))
      .limit(1);

    if (!existing || new Date(existing.windowStart) < cutoff) {
      // Window expired or new key: reset/insert
      await dbOrTx
        .insert(rateLimitBuckets)
        .values({
          key,
          windowStart: now,
          count: 1,
        })
        .onConflictDoUpdate({
          target: rateLimitBuckets.key,
          set: {
            windowStart: now,
            count: 1,
          },
        });

      return {
        limited: false,
        remaining: maxRequests - 1,
        resetMs: windowMs,
      };
    }

    if (existing.count >= maxRequests) {
      const resetMs = Math.max(
        0,
        new Date(existing.windowStart).getTime() + windowMs - now.getTime()
      );
      return {
        limited: true,
        remaining: 0,
        resetMs,
      };
    }

    const nextCount = existing.count + 1;
    await dbOrTx
      .update(rateLimitBuckets)
      .set({
        count: nextCount,
      })
      .where(eq(rateLimitBuckets.key, key));

    const resetMs = Math.max(
      0,
      new Date(existing.windowStart).getTime() + windowMs - now.getTime()
    );

    return {
      limited: false,
      remaining: Math.max(0, maxRequests - nextCount),
      resetMs,
    };
  } catch (err) {
    console.warn("DB rate limiter error, using memory fallback:", err);
    return sessionRateLimiter.isRateLimited(key);
  }
}

// 15 messages per minute per session
export async function checkSessionRateLimit(sessionId: string, dbOrTx?: any): Promise<RateLimitResult> {
  return checkDbRateLimit(`sess_${sessionId}`, 15, 60000, dbOrTx);
}

// 30 messages per minute per IP
export async function checkIpRateLimit(ip: string, dbOrTx?: any): Promise<RateLimitResult> {
  return checkDbRateLimit(`ip_${ip}`, 30, 60000, dbOrTx);
}
