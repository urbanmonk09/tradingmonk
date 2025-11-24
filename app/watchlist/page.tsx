"use client";

import React, { useEffect, useState, useMemo, useRef, useContext } from "react";
import Link from "next/link";

import StockCard from "../../src/components/StockCard";
import { fetchStockData } from "../../src/api/fetchStockData";
import { symbols as allSymbols } from "@/src/api/symbols";
import { generateSMCSignal, StockDisplay } from "@/src/utils/xaiLogic";
import { AuthContext } from "../../src/context/AuthContext";
import NotificationToast from "../../src/components/NotificationToast";

import {
  getUserTrades as getUserTradesFromFirestore,
} from "@/firebase/firestoreActions";
import {
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/firebase/firestoreWatchlist";

interface LivePrice {
  price: number;
  previousClose: number;
  lastUpdated: number;
  prices?: number[];
  highs?: number[];
  lows?: number[];
  volumes?: number[];
}

type SymbolType = "stock" | "index" | "crypto";

const defaultSymbols: { symbol: string; type: SymbolType }[] = [
  { symbol: "RELIANCE.NS", type: "stock" },
  { symbol: "^NSEI", type: "index" },
  { symbol: "BTC/USD", type: "crypto" },
  { symbol: "ETH/USD", type: "crypto" },
  { symbol: "XAU/USD", type: "index" },
];

const REFRESH_INTERVAL = 180000;

export default function Watchlist() {
  const { user } = useContext(AuthContext);
  const userEmail = (user as any)?.email ?? (user as any)?.emailAddress ?? "";

  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});

  const [savedTrades, setSavedTrades] = useState<any[]>([]);
  const [userWatchlist, setUserWatchlist] = useState<
    { id: string; userEmail: string; symbol: string; type: SymbolType }[]
  >([]);
  const [search, setSearch] = useState("");
  const [filteredResults, setFilteredResults] = useState<StockDisplay[]>([]);
  const [category, setCategory] = useState<"all" | "stock" | "crypto" | "index">(
    "all"
  );
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);

  // ------------------------------
  const apiSymbol = (symbol: string) => {
    if (symbol === "BTC/USD") return "BTC-USD";
    if (symbol === "ETH/USD") return "ETH-USD";
    if (symbol === "XAU/USD") return "GC=F";
    return symbol;
  };

  // Load saved trades
  useEffect(() => {
    if (!userEmail) {
      setSavedTrades([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const trades = await getUserTradesFromFirestore(userEmail);
        if (!mounted) return;
        setSavedTrades(trades ?? []);
      } catch (err) {
        console.error("Failed to load trades from Firestore", err);
        setSavedTrades([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userEmail]);

  // Load watchlist
  useEffect(() => {
    if (!userEmail) {
      setUserWatchlist([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const wl = await getUserWatchlist(userEmail);
        if (!mounted) return;
        const normalized = (wl ?? []).map((w: any) => ({
          id: w.id,
          userEmail: w.userEmail,
          symbol: w.symbol,
          type: (w.type ?? "stock") as SymbolType,
        }));
        setUserWatchlist(normalized);
      } catch (err) {
        console.error("Failed to load watchlist", err);
        setUserWatchlist([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userEmail]);

  // ------------------------------
  const mappedExtraSymbols = allSymbols.map((s) => {
    let yahooSymbol = s.symbol;
    if (s.type === "crypto" && s.symbol.includes("BINANCE:")) {
      const pair = s.symbol.split(":")[1];
      const base = pair.replace("USDT", "");
      yahooSymbol = `${base}-USD`;
    }
    return { symbol: yahooSymbol, type: s.type as SymbolType };
  });

  const userWatchlistSymbols = userWatchlist.map((w) => ({
    symbol: w.symbol,
    type: w.type,
  }));

  const combinedSymbols = [
    ...defaultSymbols,
    ...mappedExtraSymbols,
    ...userWatchlistSymbols,
  ];

  const uniqueSymbols = combinedSymbols.filter(
    (v, i, a) => a.findIndex((x) => x.symbol === v.symbol) === i
  );

  const symbolsWithoutTrades = uniqueSymbols.filter(
    (s) => !savedTrades.some((t: any) => t.symbol === s.symbol)
  );

  // ------------------------------
  // Live price fetcher
  useEffect(() => {
    let isMounted = true;
    const allSymbolsToFetch = uniqueSymbols.map((s) => s.symbol);

    const fetchAllPrices = async () => {
      const now = Date.now();
      for (const sym of allSymbolsToFetch) {
        const last = livePrices[sym]?.lastUpdated ?? 0;
        if (now - last >= REFRESH_INTERVAL) {
          try {
            const provider = "yahoo";
            const resp = await fetchStockData(apiSymbol(sym), provider as any);
            if (!isMounted) return;
            setLivePrices((prev) => ({
              ...prev,
              [sym]: {
                price: resp.current ?? 0,
                previousClose: resp.previousClose ?? resp.current ?? 0,
                lastUpdated: now,
              },
            }));
          } catch (err) {
            console.warn("Failed to fetch price", sym, err);
          }
        }
      }
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [JSON.stringify(uniqueSymbols.map((s) => s.symbol)), livePrices]);

  // ------------------------------
  // Trades with live prices
  const tradesWithPrices = savedTrades.map((t: any) => {
    const live = livePrices[t.symbol] ?? { price: 0, previousClose: 0 };
    const prevClose = live.previousClose ?? t.entryPrice ?? 0;

    const stoploss = prevClose * 0.985;
    const targets = [prevClose * 1.01, prevClose * 1.02, prevClose * 1.03];
    const support = prevClose * 0.995;
    const resistance = prevClose * 1.01;

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
      signal:
        t.direction === "long" ? "BUY" : t.direction === "short" ? "SELL" : "HOLD",
    };
  });

  const combinedForRanking: StockDisplay[] = [
  // --- Trades that already have price history ---
  ...tradesWithPrices.map((t: any) => {
    const prevClose = t.previousClose ?? t.entryPrice ?? 0;
    const currentPrice = t.price ?? t.entryPrice ?? prevClose;

    const stockInput = {
      symbol: t.symbol,
      current: currentPrice,
      previousClose: prevClose,
      prices: t.prices ?? [],
      highs: t.highs ?? [],
      lows: t.lows ?? [],
      volumes: t.volumes ?? [],
    };

    const signalResult = generateSMCSignal(stockInput);

    // --- Fixed stoploss & targets ---
    const stoploss = prevClose * 0.995; // -0.50%
    const targets =
      signalResult.signal === "BUY"
        ? [prevClose * 1.0078, prevClose * 1.01, prevClose * 1.0132]
        : signalResult.signal === "SELL"
        ? [prevClose * 0.9922, prevClose * 0.99, prevClose * 0.9868]
        : [prevClose];

    return {
      symbol: t.symbol,
      signal: signalResult.signal ?? "HOLD",
      confidence: signalResult.confidence ?? 50,
      explanation:
        (t.explanation ?? "") +
        (signalResult.explanation ? ` ${signalResult.explanation}` : ""),
      price: currentPrice,
      type: t.type ?? ("stock" as const),
      support: prevClose * 0.995,
      resistance: prevClose * 1.01,
      stoploss,
      targets,
      hitStatus:
        currentPrice >= Math.max(...targets)
          ? "TARGET ✅"
          : currentPrice <= stoploss
          ? "STOP ❌"
          : "ACTIVE",
    } as StockDisplay;
  }),

  // --- Symbols without prior trades ---
  ...symbolsWithoutTrades.map((s) => {
    const live = livePrices[s.symbol] ?? { price: 0, previousClose: 0 };
    const prevClose = live.previousClose ?? live.price ?? 0;
    const currentPrice = live.price ?? prevClose;

    const stockInput = {
      symbol: s.symbol,
      current: currentPrice,
      previousClose: prevClose,
      prices: live.prices ?? [],
      highs: live.highs ?? [],
      lows: live.lows ?? [],
      volumes: live.volumes ?? [],
    };

    const signalResult = generateSMCSignal(stockInput);

    // --- Fixed stoploss & targets ---
    const stoploss = prevClose * 0.995; // -0.50%
    const targets =
      signalResult.signal === "BUY"
        ? [prevClose * 1.0078, prevClose * 1.01, prevClose * 1.0132]
        : signalResult.signal === "SELL"
        ? [prevClose * 0.9922, prevClose * 0.99, prevClose * 0.9868]
        : [prevClose];

    return {
      symbol: s.symbol,
      signal: signalResult.signal ?? "HOLD",
      confidence: signalResult.confidence ?? 50,
      explanation: signalResult.explanation ?? "",
      price: currentPrice,
      type: s.type ?? ("stock" as const),
      support: prevClose * 0.995,
      resistance: prevClose * 1.01,
      stoploss,
      targets,
      hitStatus:
        currentPrice >= Math.max(...targets)
          ? "TARGET ✅"
          : currentPrice <= stoploss
          ? "STOP ❌"
          : "ACTIVE",
    } as StockDisplay;
  }),
];

  const combinedSorted = [...combinedForRanking].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
  );

  const topFive = combinedSorted.slice(0, 5);
  const screenerList = combinedSorted.slice(5);

  // ------------------------------
  // Remaining Trades split
  const sortedTrades = [...tradesWithPrices].sort(
    (a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)
  );

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
      {/* Back to Home + Title */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Watchlist</h1>
        <Link href="/" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          ← Back to Home
        </Link>
      </div>

      {toast && <div className={`p-3 text-white rounded mb-4 ${toast.bg}`}>{toast.msg}</div>}

      {!user ? (
        <p className="text-gray-500">Please log in to see your watchlist.</p>
      ) : (
        <>
          {/* SEARCH INPUT (Pro logic remains, but no fuzzy search) */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbols…"
                className="w-full px-4 py-2 rounded-lg border border-gray-300"
              />
              <button className="bg-blue-600 text-white px-4 py-2 rounded">Search</button>
            </div>
          </div>

          {/* TOP 5 */}
          {topFive.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">🔥 Top Trades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topFive.map((t) => (
                  <StockCard key={t.symbol} {...t} />
                ))}
              </div>
            </div>
          )}

          {/* SCREENER */}
          {screenerList.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Screener</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {screenerList.map((s) => (
                  <StockCard key={s.symbol} {...s} />
                ))}
              </div>
            </div>
          )}

          {/* Remaining Trades */}
          {remainingTrades.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">All Other Trades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {remainingTrades.map((t) => (
                  <StockCard key={(t as any)._id ?? t.symbol} {...t} />
                ))}
              </div>
            </div>
          )}

          {/* Live Prices for symbols without trades */}
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
