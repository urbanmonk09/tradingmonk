// pages/api/stock/[symbol].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchCandles, fetchQuote } from "../../../lib/finnhub";
import { redis } from "../../../lib/redis";

type StockData = {
  symbol: string;
  current: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  lastUpdated: number;
  source?: string;
};

const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || "10");
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || "120");

function normalizeClientSymbol(input: string): { providerSymbol: string; cacheKey: string } {
  const s = input.trim().toUpperCase();
  if (s.endsWith(".NS")) {
    const base = s.replace(".NS", "");
    return { providerSymbol: `NSE:${base}`, cacheKey: `NSE:${base}` };
  }
  if (s.includes("/USD") || s.endsWith("USDT") || s.includes("-USD")) {
    const code = s.replace("/", "").replace("-USD", "USDT");
    return { providerSymbol: `BINANCE:${code.replace("USD", "USDT")}`, cacheKey: `BINANCE:${code}` };
  }
  if (s.startsWith("^")) return { providerSymbol: s, cacheKey: s };
  const base = s.replace(".NS", "");
  return { providerSymbol: `NSE:${base}`, cacheKey: `NSE:${base}` };
}

function safeNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { symbol } = req.query;
  if (!symbol || Array.isArray(symbol)) return res.status(400).json({ error: "Missing symbol" });

  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const rlKey = `rl:${ip}:${new Date().toISOString().slice(0,16)}`;
  try {
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 60);
    if (count > RATE_LIMIT_PER_MIN) return res.status(429).json({ error: "Too many requests" });
  } catch (e) {
    console.warn("Rate-limit redis error:", e);
  }

  const { providerSymbol, cacheKey } = normalizeClientSymbol(String(symbol));
  const cacheRedisKey = `stock:${cacheKey}`;

  try {
    const cached = await redis.get(cacheRedisKey);
    if (cached) {
      const parsed = JSON.parse(cached) as StockData;
      return res.status(200).json(parsed);
    }
  } catch (e) { console.warn("Redis get error:", e); }

  try {
    const candles = await fetchCandles(providerSymbol, "D");
    const quote = await fetchQuote(providerSymbol);

    const closes = Array.isArray(candles.c) ? candles.c.map(Number).filter(Number.isFinite) : [];
    const highs = Array.isArray(candles.h) ? candles.h.map(Number).filter(Number.isFinite) : [];
    const lows = Array.isArray(candles.l) ? candles.l.map(Number).filter(Number.isFinite) : [];
    const vols = Array.isArray(candles.v) ? candles.v.map(Number).filter(Number.isFinite) : [];

    const lastIdx = Math.max(0, closes.length - 1);
    const start = Math.max(0, closes.length - 100);

    const out: StockData = {
      symbol: cacheKey,
      current: safeNumber(quote.c) ?? closes[lastIdx] ?? null,
      high: safeNumber(quote.h) ?? (highs.length ? Math.max(...highs.slice(start)) : null),
      low: safeNumber(quote.l) ?? (lows.length ? Math.min(...lows.slice(start)) : null),
      open: safeNumber(quote.o) ?? closes[lastIdx] ?? null,
      previousClose: safeNumber(quote.pc) ?? closes[lastIdx - 1] ?? null,
      prices: closes.slice(-100),
      highs: highs.slice(-100),
      lows: lows.slice(-100),
      volumes: vols.slice(-100),
      lastUpdated: Date.now(),
      source: "finnhub",
    };

    try { await redis.setEx(cacheRedisKey, CACHE_TTL, JSON.stringify(out)); } catch (e) { console.warn("Redis setEx error:", e); }

    return res.status(200).json(out);
  } catch (err: any) {
    console.error("Fetch error", err?.message || err);
    const empty = {
      symbol: cacheKey,
      current: null,
      high: null,
      low: null,
      open: null,
      previousClose: null,
      prices: [],
      highs: [],
      lows: [],
      volumes: [],
      lastUpdated: Date.now(),
      source: "error",
    };
    return res.status(200).json(empty);
  }
}
