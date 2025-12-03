"use client";

import { useEffect, useState, useRef } from "react";

export interface LivePriceState {
  price: number;           // current price (c)
  previousClose: number;   // previous close (pc)
  high?: number;           // high (h)
  low?: number;            // low (l)
  raw: any;                // raw API response
  connected: boolean;      // is connected / data fetched
  error?: string | null;   // error if fetch failed
}

/**
 * Hook to fetch live price data for a symbol.
 * Polls every `intervalMs` milliseconds.
 */
export default function useLivePrices(symbol: string, intervalMs: number = 15000) {
  const [state, setState] = useState<LivePriceState>({
    price: 0,
    previousClose: 0,
    high: undefined,
    low: undefined,
    raw: null,
    connected: false,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrice = async () => {
    try {
      const res = await fetch(`/api/finnhub/live?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Ensure data has 'c' and 'pc'
      if (typeof data.c !== "number" || typeof data.pc !== "number") {
        throw new Error("Invalid response structure");
      }

      setState({
        price: data.c,
        previousClose: data.pc,
        high: data.h,
        low: data.l,
        raw: data,
        connected: true,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        connected: false,
        error: err.message || "Unknown error",
      }));
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchPrice();

    // Start polling
    if (intervalMs > 0) {
      intervalRef.current = setInterval(fetchPrice, intervalMs);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [symbol, intervalMs]);

  return state;
}
