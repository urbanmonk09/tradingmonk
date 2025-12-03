"use client";

import React, { useEffect, useState } from "react";

// Use your sanitize function here
const sanitizeForApi = (sym: string) => sym.replace(/\s+/g, "");

// Reuse fetchAndDebug
const fetchAndDebug = async (sym: string): Promise<any | null> => {
  try {
    const clean = sanitizeForApi(sym);
    const isBinance = clean.startsWith("BINANCE:");
    const endpoint = isBinance ? "/api/finnhub/live" : "/api/truedata/live";

    const res = await fetch(`${endpoint}?symbol=${encodeURIComponent(clean)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    console.group(`=== API Response for ${sym} ===`);
    console.log(json);
    console.groupEnd();

    return json;
  } catch (err) {
    console.error(`Fetch error for ${sym}:`, err);
    return null;
  }
};

export default function DebugFetchPage() {
  const [symbols, setSymbols] = useState<string[]>([
    "RELIANCE",
    "TCS",
    "INFY",
    "NSE:NIFTY50",
    "BINANCE:BTCUSDT",
    "BINANCE:ETHUSDT",
  ]);

  const [results, setResults] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchAll = async () => {
      const out: Record<string, any> = {};
      for (const sym of symbols) {
        const data = await fetchAndDebug(sym);
        out[sym] = data;
      }
      setResults(out);
    };

    fetchAll();
  }, [symbols]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug Fetch</h1>
      <ul>
        {symbols.map((s) => (
          <li key={s} className="mb-2">
            <strong>{s}:</strong>{" "}
            <pre>{JSON.stringify(results[s] ?? {}, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
