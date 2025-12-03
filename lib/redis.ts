// lib/redis.ts
import Redis from "ioredis";

let redisClient: Redis | null = null;
const url = process.env.REDIS_URL || "";

if (url) {
  try {
    redisClient = new Redis(url);
    redisClient.on("error", (err) => {
      console.error("Redis error:", err);
    });
  } catch (e) {
    console.warn("Failed to connect to Redis:", e);
    redisClient = null;
  }
}

const memCache: Record<string, { value: string; expiry?: number }> = {};

export const redis = {
  async get(key: string): Promise<string | null> {
    if (redisClient) return redisClient.get(key);
    const v = memCache[key];
    if (!v) return null;
    if (v.expiry && Date.now() > v.expiry) { delete memCache[key]; return null; }
    return v.value;
  },
  async setEx(key: string, ttlSec: number, value: string): Promise<void> {
    if (redisClient) {
      await redisClient.set(key, value, "EX", ttlSec);
      return;
    }
    memCache[key] = { value, expiry: Date.now() + ttlSec * 1000 };
  },
  async incr(key: string): Promise<number> {
    if (redisClient) return redisClient.incr(key);
    const v = memCache[key];
    const next = v ? Number(v.value) + 1 : 1;
    memCache[key] = { value: String(next), expiry: Date.now() + 60 * 1000 };
    return next;
  },
  async expire(key: string, ttlSec: number): Promise<void> {
    if (redisClient) await redisClient.expire(key, ttlSec);
    else {
      const v = memCache[key];
      if (v) v.expiry = Date.now() + ttlSec * 1000;
    }
  },
};
