import axios from "axios";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY!;
const MAX_TOKENS = 60;
const REFILL_INTERVAL = 5 * 60 * 1000;
let tokens = MAX_TOKENS;
const queue: (() => Promise<void>)[] = [];

const memoryCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 mins

setInterval(() => {
  tokens = MAX_TOKENS;
  processQueue();
}, REFILL_INTERVAL);

async function processQueue() {
  while (tokens > 0 && queue.length > 0) {
    const fn = queue.shift();
    if (fn) {
      tokens--;
      await fn();
    }
  }
}

async function fetchFinnhub(path: string, params: Record<string, any>) {
  const url = `https://finnhub.io/api/v1${path}?token=${FINNHUB_API_KEY}&${new URLSearchParams(
    params
  ).toString()}`;
  return new Promise<any>((resolve, reject) => {
    const exec = async () => {
      try {
        const res = await axios.get(url, { validateStatus: (s) => s < 500 });
        if (res.status === 403) throw new Error("Finnhub 403: invalid/expired API key");
        resolve(res.data);
      } catch (e) {
        reject(e);
      }
    };
    queue.push(exec);
    processQueue();
  });
}

export async function fetchStock(symbol: string) {
  const cache = memoryCache.get(symbol);
  if (cache && cache.expires > Date.now()) return cache.data;

  try {
    const quote = await fetchFinnhub("/quote", { symbol });
    const data = {
      symbol,
      current: quote.c,
      high: quote.h,
      low: quote.l,
      open: quote.o,
      previousClose: quote.pc,
      lastUpdated: Date.now(),
      source: "finnhub",
    };
    memoryCache.set(symbol, { data, expires: Date.now() + CACHE_TTL });
    return data;
  } catch (e) {
    console.error(e);
    return null;
  }
}
