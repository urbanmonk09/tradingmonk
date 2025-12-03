// src/hooks/useLivePrices.ts
"use client";

import { useState, useEffect, useRef } from "react";
import type { SymbolInput } from "@/src/utils/aggregateCandles";
import { computeMultiTimeframeSMC, StockData, OptimizedSMCResult } from "@/src/utils/smcEngineOptimized";

export type { SymbolInput };

export type LiveStockData = {
  s: string;
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  timestamp: number;
};

/* -------------------- Cache -------------------- */
const CACHE_TTL_MS = 5000;
const serverCache = new Map<string, { data: LiveStockData; fetchedAt: number }>();

/* -------------------- Batch + Polling -------------------- */
const MAX_BATCH_SIZE = 20;
const BATCH_INTERVAL_MS = 1000;
const POLL_INTERVAL_MS = 2000;

/* -------------------- NSE Index Map -------------------- */
const NSE_INDEX_MAP: Record<string, string> = {
  "NSE:NIFTY50": "NIFTY 50",
  "NSE:BANKNIFTY": "NIFTY BANK",
  "NSE:NIFTYIT": "NIFTY IT",
  "NSE:FINNIFTY": "FINNIFTY",
  "NSE:NIFTYPHARMA": "NIFTY PHARMA",
  "NSE:NIFTYFMCG": "NIFTY FMCG",
  "NSE:NIFTYAUTO": "NIFTY AUTO",
};

/* -------------------- Hook -------------------- */
export function useLivePrices(symbols: SymbolInput[]) {
  const [pricesRecord, setPricesRecord] = useState<Record<string, LiveStockData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queueRef = useRef<SymbolInput[]>([]);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastStoredRef = useRef<Record<string, number>>({});

  // -------------------- Rolling History --------------------
  const rollingHistoryRef = useRef<Record<
    string,
    { prices: number[]; highs: number[]; lows: number[]; volumes: number[] }
  >>({});

  const HISTORY_LIMIT = 100; // store last 100 ticks

  /* -------------------- Mount/Unmount -------------------- */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    queueRef.current = symbols ?? [];
  }, [symbols]);

  /* -------------------- Merge Records -------------------- */
  function mergeRecords(updates: Record<string, LiveStockData>) {
    setPricesRecord((prev) => ({ ...prev, ...updates }));
  }

  /* -------------------- Firestore Write -------------------- */
  async function writeToFirebase(item: SymbolInput, smcResult: OptimizedSMCResult) {
    try {
      let firebaseSymbol = item.symbol;
      if (item.type === "index") firebaseSymbol = NSE_INDEX_MAP[item.symbol] ?? item.symbol;

      // Prevent duplicate writes
      if (lastStoredRef.current[firebaseSymbol] === smcResult.optimizedConfidence) return;
      lastStoredRef.current[firebaseSymbol] = smcResult.optimizedConfidence;

      await fetch("/api/livePrices/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: firebaseSymbol.replace("NSE:", ""),
          price: smcResult.entryPrice ?? smcResult.targets[0],
          timestamp: Date.now(),
          exchange: item.type,
          signal: smcResult.signal,
          indicators: smcResult.indicators,
          reasons: smcResult.reasons,
          stoploss: smcResult.stoploss,
          targets: smcResult.targets,
        }),
      });
    } catch (err) {
      console.warn(`Server write failed for ${item.symbol}:`, err);
    }
  }

  /* -------------------- Fetch One -------------------- */
  async function fetchOne(item: SymbolInput): Promise<LiveStockData | null> {
    const now = Date.now();
    const cacheKey = `${item.type}:${item.symbol}`;
    const cached = serverCache.get(cacheKey);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

    try {
      const endpoint =
        item.type === "crypto"
          ? `/api/finnhub/live?symbol=${encodeURIComponent(item.symbol)}`
          : `/api/nse/live?symbol=${encodeURIComponent(item.symbol)}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP_${res.status}`);

      const json = await res.json();

      const data: LiveStockData = {
        s: item.symbol,
        c: Number(json.price ?? json.c ?? 0),
        o: Number(json.open ?? json.o ?? 0),
        h: Number(json.high ?? json.h ?? 0),
        l: Number(json.low ?? json.l ?? 0),
        pc: Number(json.prevClose ?? json.pc ?? 0),
        timestamp: Number(json.timestamp ?? now),
      };

      serverCache.set(cacheKey, { data, fetchedAt: now });

      // ---------------- Update rolling history ----------------
      const history = rollingHistoryRef.current[item.symbol] ?? { prices: [], highs: [], lows: [], volumes: [] };
      history.prices.push(data.c);
      history.highs.push(data.h);
      history.lows.push(data.l);
      history.volumes.push(0); // placeholder, extend if volume available

      if (history.prices.length > HISTORY_LIMIT) history.prices.shift();
      if (history.highs.length > HISTORY_LIMIT) history.highs.shift();
      if (history.lows.length > HISTORY_LIMIT) history.lows.shift();
      if (history.volumes.length > HISTORY_LIMIT) history.volumes.shift();

      rollingHistoryRef.current[item.symbol] = history;

      // ---------------- Compute SMC ----------------
      const stockData: StockData = {
        symbol: item.symbol,
        current: data.c,
        previousClose: data.pc,
        open: data.o,
        high: data.h,
        low: data.l,
        prices: history.prices,
        highs: history.highs,
        lows: history.lows,
        volumes: history.volumes,
      };

      const smcResult = computeMultiTimeframeSMC(stockData);

      // ---------------- Write to Firestore ----------------
      writeToFirebase(item, smcResult).catch(() => {});

      return data;
    } catch (err: any) {
      console.warn(`[useLivePrices] fetchOne failed for ${item.symbol}:`, err?.message ?? err);
      return null;
    }
  }

  /* -------------------- Fetch Batch -------------------- */
  async function fetchBatch(batch: SymbolInput[]) {
    const results: Record<string, LiveStockData> = {};

    for (const item of batch) {
      const tick = await fetchOne(item);
      if (tick) results[item.symbol] = tick;
    }

    if (Object.keys(results).length > 0) {
      mergeRecords(results);
      setIsConnected(true);
      setError(null);
    }
  }

  /* -------------------- Poll Loop -------------------- */
  useEffect(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    let cancelled = false;

    const runner = async () => {
      while (!cancelled && mountedRef.current) {
        const queue = queueRef.current ?? [];
        if (!queue.length) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          continue;
        }

        const copy = [...queue];
        const batches: SymbolInput[][] = [];
        while (copy.length) batches.push(copy.splice(0, MAX_BATCH_SIZE));

        for (const batch of batches) {
          if (cancelled || !mountedRef.current) break;
          await fetchBatch(batch);
          await new Promise((r) => setTimeout(r, BATCH_INTERVAL_MS));
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    runner().catch((err) => console.warn("Poll loop error:", err));

    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, []);

  return {
    prices: Object.values(pricesRecord),
    isConnected,
    error,
  };
}
