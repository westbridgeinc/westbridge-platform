/**
 * Rate limiter using Redis (INCR + EXPIRE). Fails closed: when Redis is unavailable or errors, requests are denied.
 *
 * @deprecated Use `checkTieredRateLimit` from `lib/api/rate-limit-tiers.ts` for new code.
 * This simple fixed-window implementation is kept for existing routes (erp/list, erp/doc,
 * invite, auth/*) until they're migrated to the pipeline. The tiered limiter uses sliding
 * windows, supports cost multipliers, and adds proper X-RateLimit-* headers.
 *
 * DO NOT add new callers. Migrate existing callers when touching those files.
 */

import { getRedis } from "@/lib/redis";

const WINDOW_MS = 60 * 1000; // 1 minute

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return ip ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = WINDOW_MS
): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedis();
  if (!client) {
    const { logger } = await import("@/lib/logger");
    logger.warn("Rate limit: Redis unavailable, denying request (fail closed)");
    return { allowed: false, remaining: 0 };
  }

  const redisKey = `ratelimit:${key}`;
  try {
    const pipeline = client.pipeline();
    pipeline.incr(redisKey);
    pipeline.pexpire(redisKey, windowMs);
    const results = await pipeline.exec();
    const count = (results?.[0]?.[1] as number) ?? 1;
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    return { allowed, remaining };
  } catch (e) {
    const { logger } = await import("@/lib/logger");
    logger.warn("Rate limit: Redis error, denying request (fail closed)", { error: e instanceof Error ? e.message : String(e) });
    return { allowed: false, remaining: 0 };
  }
}
