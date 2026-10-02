/**
 * Redis – CSDL thứ 2 (NoSQL key-value) dùng cho:
 *  - Cache dữ liệu đọc nhiều (danh sách khóa học, danh mục)
 *  - Rate limit dùng chung (chống brute-force OTP / spam form)
 * Nếu Redis không chạy, ứng dụng tự quay về chế độ không cache (không sập).
 */
import Redis from "ioredis";

const g = globalThis as unknown as { __redis?: Redis | null; __redisWarned?: boolean };

export function getRedis(): Redis | null {
  if (g.__redis !== undefined) return g.__redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    g.__redis = null;
    return null;
  }
  const client = new Redis(url, {
    keyPrefix: "sn:", // mọi key của app nằm dưới sn:* (khớp ACL)
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
  client.on("ready", () => console.log("Connected to Redis Successfully."));
  client.on("error", (e) => {
    if (!g.__redisWarned) console.warn("[redis] lỗi kết nối:", e.message);
    g.__redisWarned = true;
  });
  g.__redis = client;
  return client;
}

const ready = (r: Redis | null): r is Redis => Boolean(r && r.status === "ready");

/** Lấy từ cache, nếu chưa có thì gọi fn() rồi lưu với TTL (giây) */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const r = getRedis();
  if (ready(r)) {
    try {
      const hit = await r.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      /* bỏ qua lỗi cache */
    }
  }
  const value = await fn();
  if (ready(r)) {
    r.set(key, JSON.stringify(value), "EX", ttlSec).catch(() => {});
  }
  return value;
}

/** Phiên bản dữ liệu – tăng lên để vô hiệu hóa toàn bộ cache liên quan */
export async function cacheVersion(name: string): Promise<string> {
  const r = getRedis();
  if (!ready(r)) return "0";
  try {
    return (await r.get(`ver:${name}`)) ?? "0";
  } catch {
    return "0";
  }
}

export async function bumpCache(...names: string[]) {
  const r = getRedis();
  if (!ready(r)) return;
  await Promise.all(names.map((n) => r.incr(`ver:${n}`).catch(() => 0)));
}

/** Rate limit dùng Redis (INCR + PEXPIRE). Trả null nếu Redis không sẵn sàng */
export async function redisRateLimit(key: string, limit: number, windowMs: number) {
  const r = getRedis();
  if (!ready(r)) return null;
  try {
    const k = `rl:${key}`;
    const [[, count], [, ttl]] = (await r.multi().incr(k).pttl(k).exec()) as [[null, number], [null, number]];
    if (ttl < 0) await r.pexpire(k, windowMs);
    const retry = ttl > 0 ? ttl : windowMs;
    return { ok: count <= limit, retryAfterSec: count <= limit ? 0 : Math.ceil(retry / 1000) };
  } catch {
    return null;
  }
}

export async function redisReset(key: string) {
  const r = getRedis();
  if (ready(r)) await r.del(`rl:${key}`).catch(() => 0);
}

/** Thông tin cho /api/health */
export async function redisHealth() {
  const r = getRedis();
  if (!r) return { status: "disabled" as const };
  if (r.status !== "ready") return { status: "down" as const, state: r.status };
  const t = Date.now();
  try {
    await r.ping();
    const info = await r.info("memory");
    const pick = (k: string) => info.match(new RegExp(`^${k}:(.*)$`, "m"))?.[1]?.trim();
    return {
      status: "up" as const,
      latencyMs: Date.now() - t,
      usedMemory: pick("used_memory_human"),
      maxMemory: pick("maxmemory_human"),
      policy: pick("maxmemory_policy"),
    };
  } catch (e) {
    return { status: "error" as const, error: (e as Error).message };
  }
}
