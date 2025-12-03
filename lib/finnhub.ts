// lib/finnhub.ts
import axios from "axios";
import pRetry from "p-retry";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const KEY = process.env.FINNHUB_API_KEY;

if (!KEY) {
  console.warn("FINNHUB_API_KEY not set — server requests will fail.");
}

export type FinnhubCandles = {
  s: string; c: number[]; h: number[]; l: number[]; o: number[]; v: number[]; t: number[];
};

export async function fetchCandles(symbol: string, resolution = "D", from?: number, to?: number) {
  const now = Math.floor(Date.now() / 1000);
  const f = from ?? now - 180 * 24 * 60 * 60;
  const t = to ?? now;
  return pRetry(async () => {
    const r = await axios.get(`${FINNHUB_BASE}/stock/candle`, {
      params: { symbol, resolution, from: f, to: t, token: KEY },
      timeout: 10000,
    });
    if (r.status !== 200) throw new Error("Invalid status " + r.status);
    return r.data as FinnhubCandles;
  }, { retries: 2, factor: 1.5 });
}

export async function fetchQuote(symbol: string) {
  return pRetry(async () => {
    const r = await axios.get(`${FINNHUB_BASE}/quote`, { params: { symbol, token: KEY }, timeout: 8000 });
    if (r.status !== 200) throw new Error("Quote status " + r.status);
    return r.data;
  }, { retries: 2 });
}
