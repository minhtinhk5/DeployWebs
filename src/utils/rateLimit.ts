/**
 * Rate limit: ưu tiên Redis (dùng chung giữa các lần restart / nhiều tiến trình),
 * tự quay về bộ nhớ trong nếu Redis không chạy.
 */
import { redisRateLimit, redisReset } from "@/lib/redis";

type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as { __rlStore?: Map<string, Bucket> };
const store = (globalForRl.__rlStore ??= new Map<string, Bucket>());

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (store.size > 5000) {
    store.forEach((v, k) => {
      if (v.resetAt < now) store.delete(k);
    });
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  return (await redisRateLimit(key, limit, windowMs)) ?? memoryRateLimit(key, limit, windowMs);
}

export async function resetRateLimit(key: string) {
  store.delete(key);
  await redisReset(key);
}
