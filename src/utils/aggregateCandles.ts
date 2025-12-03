// src/utils/liveAggregator.ts

export type SymbolType = "stock" | "index" | "crypto";

export interface SymbolInput {
  symbol: string;
  type: SymbolType;
}

export interface LiveData {
  s: string;          // symbol
  c: number;          // current/last price
  h: number;          // high
  l: number;          // low
  o: number;          // open
  pc: number;         // previous close
  timestamp: number;
}

// -------------------- Server cache --------------------
const CACHE_TTL = 5_000; // 5 seconds
const serverCache = new Map<string, { data: LiveData; fetchedAt: number }>();

// -------------------- Helper to fetch a single symbol --------------------
async function fetchSymbol(item: SymbolInput): Promise<LiveData | null> {
  const now = Date.now();
  const cacheKey = `${item.type}:${item.symbol}`;

  const cached = serverCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    let res: globalThis.Response;

    if (item.type === "crypto") {
      res = await fetch(`/api/finnhub/live?symbol=${encodeURIComponent(item.symbol)}`);
    } else {
      res = await fetch(`/api/nse/live?symbol=${encodeURIComponent(item.symbol)}`);
    }

    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const json = await res.json();

    const normalized: LiveData = {
      s: item.symbol,
      c: Number(json.price ?? json.c ?? 0),
      o: Number(json.open ?? json.o ?? 0),
      h: Number(json.high ?? json.h ?? 0),
      l: Number(json.low ?? json.l ?? 0),
      pc: Number(json.prevClose ?? json.pc ?? 0),
      timestamp: Number(json.timestamp ?? Date.now()),
    };

    serverCache.set(cacheKey, { data: normalized, fetchedAt: now });
    return normalized;
  } catch (err) {
    console.warn(`[Aggregator] Failed fetching ${item.symbol}:`, err);
    return null;
  }
}

// -------------------- Aggregator --------------------
export async function fetchLiveBatch(symbols: SymbolInput[]): Promise<LiveData[]> {
  const results: LiveData[] = [];

  for (const item of symbols) {
    try {
      const tick = await fetchSymbol(item);
      if (tick) results.push(tick);
    } catch {
      // ignore individual symbol errors
    }
  }

  return results;
}

// -------------------- Firestore storage helper --------------------
import { db } from "@/firebase/firebase";
import { setDoc, doc } from "firebase/firestore";

export async function storeLiveToFirestore(symbolData: LiveData[], userEmail?: string) {
  try {
    for (const d of symbolData) {
      const path = userEmail
        ? `users/${userEmail}/live/${d.s}`
        : `live/${d.s}`; // global live data
      await setDoc(doc(db, path), d, { merge: true });
    }
  } catch (err) {
    console.error("[Aggregator] Firestore write failed:", err);
  }
}
