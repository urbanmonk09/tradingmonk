"use client";

import React, { useEffect, useState, useContext } from "react";
import StockCard from "../../src/components/StockCard";
import { AuthContext } from "../../src/context/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fetchStockData } from "../../src/api/fetchStockData";

// ⬅️ NEW: import user symbols file
import { symbols as allSymbols } from "@/src/api/symbols";

// ⬅️ NEW: import xai logic for confidence computation
import { generateSMCSignal, StockDisplay } from "@/src/utils/xaiLogic";

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

  // --------------------------------------------------------------------------------
  // ⬅️ NEW LOGIC: Combine defaultSymbols + symbols file for "symbols without trades"
  // --------------------------------------------------------------------------------

  const mappedExtraSymbols = allSymbols.map((s) => {
    let yahooSymbol = s.symbol;

    // Convert Binance pair → Yahoo crypto format
    if (s.type === "crypto") {
      if (s.symbol.includes("BINANCE:")) {
        const pair = s.symbol.split(":")[1]; // BTCUSDT
        const base = pair.replace("USDT", "");
        yahooSymbol = `${base}-USD`;
      }
    }

    return { symbol: yahooSymbol, type: s.type as SymbolType };
  });

  const combinedSymbols = [...defaultSymbols, ...mappedExtraSymbols];

  const uniqueSymbols = combinedSymbols.filter(
    (v, i, a) => a.findIndex((x) => x.symbol === v.symbol) === i
  );

  const symbolsWithoutTrades = uniqueSymbols.filter(
    (s) => !savedTrades.some((t: any) => t.symbol === s.symbol)
  );

  // --------------------------------------------------------------------------------
  // ⬅️ NEW: Build combined list (saved trades + symbols without trades)
  // Use generateSMCSignal to compute confidence for sorting the Top 5
  // --------------------------------------------------------------------------------

  // Map saved trades into a displayable shape and attach XAI confidence
  const savedTradesForScoring: StockDisplay[] = tradesWithPrices.map((t: any) => {
    // Build a minimal StockData input for generateSMCSignal
    const stockInput = {
      symbol: t.symbol,
      current: t.price ?? t.entryPrice ?? 0,
      previousClose: t.previousClose ?? t.entryPrice ?? 0,
      prices: t.prices ?? [],
      highs: t.highs ?? [],
      lows: t.lows ?? [],
      volumes: t.volumes ?? [],
    };

    const signalResult = generateSMCSignal(stockInput);

    return {
      symbol: t.symbol,
      signal: t.signal ?? "HOLD",
      confidence: signalResult.confidence ?? 50,
      explanation: (t.explanation ?? "") + (signalResult.explanation ? ` ${signalResult.explanation}` : ""),
      price: t.price ?? t.entryPrice,
      type: t.type ?? ("stock" as const),
      support: t.support,
      resistance: t.resistance,
      stoploss: signalResult.stoploss ?? t.stoploss,
      targets: signalResult.targets ?? t.targets,
      hitStatus: t.hitStatus ?? signalResult.hitStatus,
    };
  });

  // Map symbolsWithoutTrades into a displayable shape and attach XAI confidence
  const symbolsForScoring: StockDisplay[] = symbolsWithoutTrades.map((s) => {
    const live = livePrices[s.symbol] ?? { price: 0, previousClose: 0 };
    const prevClose = live.previousClose ?? live.price ?? 0;

    const stockInput = {
      symbol: s.symbol,
      current: live.price ?? prevClose,
      previousClose: prevClose,
      prices: [], // no history available here
      highs: [],
      lows: [],
      volumes: [],
    };

    const signalResult = generateSMCSignal(stockInput);

    return {
      symbol: s.symbol,
      signal: signalResult.signal ?? "HOLD",
      confidence: signalResult.confidence ?? 50,
      explanation: signalResult.explanation ?? "",
      price: live.price ?? prevClose,
      type: s.type ?? ("stock" as const),
      support: prevClose * 0.995,
      resistance: prevClose * 1.01,
      stoploss: prevClose * 0.985,
      targets: signalResult.targets ?? [prevClose],
      hitStatus:
        live.price !== undefined
          ? updateHitStatusForRender(signalResult.hitStatus ?? "ACTIVE", live.price, signalResult)
              .hitStatus
          : (signalResult.hitStatus ?? "ACTIVE"),
    } as StockDisplay;
  });

  // Combined list for ranking
  const combinedForRanking: StockDisplay[] = [...savedTradesForScoring, ...symbolsForScoring];

  // Sort by confidence descending
  const combinedSorted = [...combinedForRanking].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  // Top 5 (new Top Trades)
  const topFive = combinedSorted.slice(0, 5);

  // Screener (everything else)
  const screenerList = combinedSorted.slice(5);

  // --------------------------------------------------------------------------------
  // NOTE: keep your original sorting variables intact (we do not remove or alter them)
  // --------------------------------------------------------------------------------

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

  // Helper used above to keep type-safety when forming hitStatus for symbolsWithoutTrades
  function updateHitStatusForRender(
    defaultHit: "ACTIVE" | "TARGET ✅" | "STOP ❌",
    currentPrice: number,
    signalResult: ReturnType<typeof generateSMCSignal>
  ) {
    // If signalResult.targets/stoploss exist we can compute a hit status
    if (signalResult.signal === "BUY") {
      if ((signalResult.targets ?? []).some((t) => currentPrice >= t)) {
        return { hitStatus: "TARGET ✅" as const };
      }
      if (currentPrice <= (signalResult.stoploss ?? currentPrice)) {
        return { hitStatus: "STOP ❌" as const };
      }
    }
    if (signalResult.signal === "SELL") {
      if ((signalResult.targets ?? []).some((t) => currentPrice <= t)) {
        return { hitStatus: "TARGET ✅" as const };
      }
      if (currentPrice >= (signalResult.stoploss ?? currentPrice)) {
        return { hitStatus: "STOP ❌" as const };
      }
    }
    return { hitStatus: defaultHit };
  }

  // ------------------------------
  // Render
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {!user ? (
        <p className="text-gray-500">Please log in to see your watchlist.</p>
      ) : (
        <>
          {/* -----------------------
              NEW: Top 5 (XAI confidence-based)
              Replaces the previous Top Trades block.
              ----------------------- */}
          {topFive.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">🔥 Top Trades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topFive.map((t) => (
                  <StockCard
                    key={(t as any)._id ?? t.symbol}
                    symbol={t.symbol}
                    type={t.type as any}
                    signal={t.signal}
                    confidence={t.confidence ?? 0}
                    explanation={t.explanation ?? ""}
                    price={t.price}
                    stoploss={t.stoploss}
                    targets={t.targets}
                    support={t.support}
                    resistance={t.resistance}
                    hitStatus={t.hitStatus}
                  />
                ))}
              </div>
            </div>
          )}

          {/* -----------------------
              NEW: Screener (everything after top 5)
              ----------------------- */}
          {screenerList.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Screener</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {screenerList.map((s) => (
                  <StockCard
                    key={(s as any)._id ?? s.symbol}
                    symbol={s.symbol}
                    type={s.type as any}
                    signal={s.signal}
                    confidence={s.confidence ?? 0}
                    explanation={s.explanation ?? ""}
                    price={s.price}
                    stoploss={s.stoploss}
                    targets={s.targets}
                    support={s.support}
                    resistance={s.resistance}
                    hitStatus={s.hitStatus}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Remaining trades (original block preserved below if needed) */}
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

          {/* Symbols without trades (original live prices block preserved) */}
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
