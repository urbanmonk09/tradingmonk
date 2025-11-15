"use client";

import React, { useEffect, useState, useContext } from "react";
import StockCard from "../../src/components/StockCard";
import { AuthContext } from "../../src/context/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fetchStockData } from "../../src/api/fetchStockData";

// ------------------------------
// Literal type for StockCard
type SymbolType = "stock" | "index" | "crypto";

// Default symbols to always show
const defaultSymbols: { symbol: string; type: SymbolType }[] = [
  { symbol: "RELIANCE.NS", type: "stock" },
  { symbol: "^NSEI", type: "index" },
  { symbol: "BTC/USD", type: "crypto" },
  { symbol: "ETH/USD", type: "crypto" },
  { symbol: "XAU/USD", type: "index" },
];

const REFRESH_INTERVAL = 180000; // 3 minutes

export default function Watchlist() {
  const { user } = useContext(AuthContext);
  const userEmail = (user as any)?.email ?? "";

  const savedTrades = useQuery(api.trades.getUserTrades, { userEmail }) ?? [];

  // Live prices with previousClose
  const [livePrices, setLivePrices] = useState<
    Record<string, { price: number; previousClose: number; lastUpdated: number }>
  >({});

  // ------------------------------
  // Map symbols to Yahoo-friendly tickers (use Yahoo for crypto)
  const apiSymbol = (symbol: string) => {
    if (symbol === "BTC/USD") return "BTC-USD";
    if (symbol === "ETH/USD") return "ETH-USD";
    if (symbol === "XAU/USD") return "GC=F";
    return symbol;
  };

  // ------------------------------
  // Fetch live prices (Yahoo only)
  useEffect(() => {
    let isMounted = true;

    async function fetchAllPrices() {
      const now = Date.now();
      for (const s of defaultSymbols) {
        const last = livePrices[s.symbol]?.lastUpdated ?? 0;
        if (now - last >= REFRESH_INTERVAL) {
          try {
            const provider = "yahoo";
            const data = await fetchStockData(apiSymbol(s.symbol), provider as any);
            if (!isMounted) return;
            setLivePrices((prev) => ({
              ...prev,
              [s.symbol]: {
                price: data.current ?? 0,
                previousClose: data.previousClose ?? data.current ?? 0,
                lastUpdated: now,
              },
            }));
          } catch (err) {
            console.warn("Failed to fetch price", s.symbol, err);
          }
        }
      }
    }

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [livePrices]);

  // ------------------------------
  // Merge saved trades with live prices
  const tradesWithPrices = savedTrades.map((t: any) => {
    const live = livePrices[t.symbol] ?? { price: 0, previousClose: 0 };
    const prevClose = live.previousClose ?? t.entryPrice ?? 0;

    const stoploss = prevClose * 0.985;
    const targets = [prevClose * 1.01, prevClose * 1.02, prevClose * 1.03];
    const support = prevClose * 0.995;
    const resistance = prevClose * 1.01;

    // Hit status based on live price
    let hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌" = "ACTIVE";
    if (live.price <= stoploss) hitStatus = "STOP ❌";
    else if (live.price >= Math.max(...targets)) hitStatus = "TARGET ✅";

    return {
      ...t,
      price: live.price ?? t.entryPrice,
      stoploss,
      targets,
      support,
      resistance,
      hitStatus,
      signal: t.direction === "long" ? "BUY" : t.direction === "short" ? "SELL" : "HOLD",
    };
  });

  const symbolsWithoutTrades = defaultSymbols.filter(
    (s) => !savedTrades.some((t: any) => t.symbol === s.symbol)
  );

  const sortedTrades = [...tradesWithPrices].sort((a, b) => b.confidence - a.confidence);

  const topTrades: typeof sortedTrades = [];
  const seenTypes: Record<string, boolean> = {};
  const remainingTrades: typeof sortedTrades = [];

  for (const t of sortedTrades) {
    if (!seenTypes[t.type]) {
      topTrades.push(t);
      seenTypes[t.type] = true;
    } else {
      remainingTrades.push(t);
    }
  }

  // ------------------------------
  // Render
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {!user ? (
        <p className="text-gray-500">Please log in to see your watchlist.</p>
      ) : (
        <>
          {/* Top trades */}
          {topTrades.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">🔥 Top Trades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topTrades.map((t) => (
                  <StockCard key={t._id} {...t} />
                ))}
              </div>
            </div>
          )}

          {/* Remaining trades */}
          {remainingTrades.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">All Other Trades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {remainingTrades.map((t) => (
                  <StockCard key={t._id} {...t} />
                ))}
              </div>
            </div>
          )}

          {/* Symbols without trades */}
          {symbolsWithoutTrades.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Live Prices</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {symbolsWithoutTrades.map((s) => {
                  const live = livePrices[s.symbol] ?? { price: 0, previousClose: 0 };
                  const prevClose = live.previousClose ?? live.price ?? 0;

                  const stoploss = prevClose * 0.985;
                  const targets = [prevClose * 1.01, prevClose * 1.02, prevClose * 1.03];
                  const support = prevClose * 0.995;
                  const resistance = prevClose * 1.01;

                  // Hit status based on live price
                  let hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌" = "ACTIVE";
                  if (live.price <= stoploss) hitStatus = "STOP ❌";
                  else if (live.price >= Math.max(...targets)) hitStatus = "TARGET ✅";

                  return (
                    <StockCard
                      key={s.symbol}
                      symbol={s.symbol}
                      type={s.type}
                      signal="HOLD"
                      confidence={0}
                      price={live.price ?? prevClose}
                      stoploss={stoploss}
                      targets={targets}
                      support={support}
                      resistance={resistance}
                      hitStatus={hitStatus}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
