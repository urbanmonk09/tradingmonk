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

// ----------------------
// New types for tabs / assets
type TabType = "top" | "stock" | "crypto" | "index";
type AssetType = "stock" | "crypto";
// map UI tab -> actual asset type expected by logic (indexes behave like stocks)
const mapTabToAsset = (tab: TabType): AssetType => (tab === "crypto" ? "crypto" : "stock");
// ----------------------

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
  // NEW ADD-ONS STATE (Tabs / Sorting / Pagination / Sticky)
  // activeTab: top | stock | crypto | index
  const [activeTab, setActiveTab] = useState<TabType>("top");

  // sortBy: confidence | trend | volume
  const [sortBy, setSortBy] = useState<"confidence" | "trend" | "volume">(
    "confidence"
  );

  // pagination state per tab
  const PAGE_SIZE = 9;
  const [pageMap, setPageMap] = useState<Record<string, number>>({
    top: 1,
    stock: 1,
    crypto: 1,
    index: 1,
  });

  // whether to show sticky tabs — we'll use CSS "sticky"
  const tabsRef = useRef<HTMLDivElement | null>(null);

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
  // NOTE: Live price fetcher removed by request.
  // livePrices will remain an empty object unless populated elsewhere.

  // ------------------------------
  // Trades with live prices (adapted to not rely on livePrices fetcher)
  const tradesWithPrices = savedTrades.map((t: any) => {
    // prefer stored previousClose/entryPrice; livePrices may be empty now
    const live = livePrices[t.symbol] ?? { price: 0, previousClose: 0 };
    const prevClose = t.previousClose ?? t.entryPrice ?? live.previousClose ?? 0;
    const price = t.entryPrice ?? live.price ?? prevClose;

    const isShort = t.direction === "short";

    // Short and long have opposite stop/target logic
    const stoploss = isShort ? prevClose * 1.005 : prevClose * 0.995;
    const targets = isShort
      ? [prevClose * 0.9922, prevClose * 0.99, prevClose * 0.9868] // SHORT TARGETS
      : [prevClose * 1.0078, prevClose * 1.01, prevClose * 1.0132]; // LONG TARGETS

    const support = prevClose * 0.995;
    const resistance = prevClose * 1.01;

    let hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌" = "ACTIVE";

    if (!isShort) {
      if (price >= Math.max(...targets)) hitStatus = "TARGET ✅";
      else if (price <= stoploss) hitStatus = "STOP ❌";
    } else {
      if (price <= Math.min(...targets)) hitStatus = "TARGET ✅";
      else if (price >= stoploss) hitStatus = "STOP ❌";
    }

    return {
      ...t,
      price,
      stoploss,
      targets,
      support,
      resistance,
      hitStatus,
      // 🚨 this preserves short trades visually
      signal: isShort ? "SELL" : "BUY",
      type: t.type ?? "stock",
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
          ? [prevClose * 0.9922, prevClose * 0.99, prevClose * 1.0132 * 0.957] // fallback but shouldn't happen
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
      // Without live price fetches we fallback to zeros for price info
      const prevClose = 0;
      const currentPrice = 0;

      const stockInput = {
        symbol: s.symbol,
        current: currentPrice,
        previousClose: prevClose,
        prices: [],
        highs: [],
        lows: [],
        volumes: [],
      };

      const signalResult = generateSMCSignal(stockInput);

      // --- Fixed stoploss & targets ---
      const stoploss = prevClose * 0.995; // -0.50% => will be 0 if prevClose is 0
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

  // keep a single top list for UI tabs and for existing Top 5
  const tabTopTrades = combinedSorted.slice(0, 5);

  // ------------------------------
  // Remaining Trades split (keep existing behavior)
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
  const tabStocks = combinedSorted.filter((x) => x.type === "stock");
  const tabCrypto = combinedSorted.filter((x) => x.type === "crypto");
  const tabIndex = combinedSorted.filter((x) => x.type === "index");

  // Helper: compute trend and volume score (best-effort; data may be missing)
  const computeTrendScore = (s: StockDisplay) => {
    // prefer using previousClose if available via support/resistance heuristics,
    // else fallback to 0
    const price = s.price ?? 0;
    const prevClose = s.support ? s.support / 0.995 : 0; // reverse-engineer if support exists
    if (prevClose && prevClose > 0) {
      return (price - prevClose) / prevClose;
    }
    // fallback: use difference between price and resistance as a weak proxy
    const resistance = s.resistance ?? price;
    return (price - resistance) / (resistance || 1);
  };

  const computeVolumeScore = (s: StockDisplay) => {
    // If livePrices has volumes for symbol, use that; otherwise 0
    const vol = livePrices[s.symbol]?.volumes;
    if (Array.isArray(vol) && vol.length > 0) {
      // use latest volume
      return vol[vol.length - 1] ?? 0;
    }
    // not available -> 0
    return 0;
  };

  const sortList = (list: StockDisplay[], by: typeof sortBy) => {
    const copy = [...list];
    if (by === "confidence") {
      return copy.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    }
    if (by === "trend") {
      return copy.sort((a, b) => computeTrendScore(b) - computeTrendScore(a));
    }
    // volume
    return copy.sort((a, b) => computeVolumeScore(b) - computeVolumeScore(a));
  };

  // Pagination helper: returns items for a tab and total pages
  const paginate = (list: StockDisplay[], page: number) => {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const items = list.slice(start, end);
    return { items, totalPages, page: safePage };
  };

  // Update page for a given tab
  const setPageForTab = (tab: TabType, page: number) => {
    setPageMap((prev) => ({ ...prev, [tab]: page }));
    // scroll to tabs area for better UX
    if (tabsRef.current) {
      tabsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Pro-only enforcement: require user to be pro for certain tabs
  const isPro = !!(user as any)?.isPro;
  // Let's make Stocks and Crypto pro-only as an example (you can change which tabs are pro)
  const PRO_ONLY_TABS: TabType[] = ["stock", "crypto"];

  const tryActivateTab = (tab: TabType) => {
    if (PRO_ONLY_TABS.includes(tab) && !isPro) {
      setToast({
        msg: `${tab.charAt(0).toUpperCase() + tab.slice(1)} tab is for Pro members only. Upgrade to access.`,
        bg: "bg-yellow-600",
      });
      return;
    }
    setActiveTab(tab);
    // reset page to 1 when switching
    setPageMap((p) => ({ ...p, [tab]: 1 }));
  };

  // get list for active tab, sorted & paginated
  const { currentItems, totalPagesForActive } = useMemo(() => {
    let list: StockDisplay[] = [];
    if (activeTab === "top") list = tabTopTrades;
    else if (activeTab === "stock") list = tabStocks;
    else if (activeTab === "crypto") list = tabCrypto;
    else if (activeTab === "index") list = tabIndex;

    const sorted = sortList(list, sortBy);
    const page = pageMap[activeTab] ?? 1;
    const { items, totalPages, page: safePage } = paginate(sorted, page);

    // ensure pageMap sync if out of bounds
    if (page !== safePage) {
      setPageMap((p) => ({ ...p, [activeTab]: safePage }));
    }

    return { currentItems: items, totalPagesForActive: Math.max(1, totalPages) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sortBy, combinedSorted, JSON.stringify(livePrices), pageMap.top, pageMap.stock, pageMap.crypto, pageMap.index]);

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

          {/* TABS (sticky) */}
          <div ref={tabsRef} className="sticky top-16 z-20 bg-gray-100 py-3">
            <div className="container mx-auto px-0">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => tryActivateTab("top")}
                  className={`px-4 py-2 rounded-lg ${
                    activeTab === "top" ? "bg-blue-600 text-white" : "bg-white border"
                  }`}
                >
                  Top Trades
                </button>

                <button
                  onClick={() => tryActivateTab("stock")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    activeTab === "stock" ? "bg-blue-600 text-white" : "bg-white border"
                  }`}
                >
                  Stocks {PRO_ONLY_TABS.includes("stock") && !isPro ? "🔒" : ""}
                </button>

                <button
                  onClick={() => tryActivateTab("crypto")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    activeTab === "crypto" ? "bg-blue-600 text-white" : "bg-white border"
                  }`}
                >
                  Crypto {PRO_ONLY_TABS.includes("crypto") && !isPro ? "🔒" : ""}
                </button>

                <button
                  onClick={() => tryActivateTab("index")}
                  className={`px-4 py-2 rounded-lg ${
                    activeTab === "index" ? "bg-blue-600 text-white" : "bg-white border"
                  }`}
                >
                  Index
                </button>

                {/* Sorting dropdown */}
                <div className="ml-auto flex items-center gap-2">
                  <label className="text-sm mr-2">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2 py-1 rounded border"
                  >
                    <option value="confidence">Confidence</option>
                    <option value="trend">Trend</option>
                    <option value="volume">Volume</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* TAB CONTENT (shows filtered/sorted/paginated items) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">
              {activeTab === "top" && "🔥 Top Trades"}
              {activeTab === "stock" && "📈 Stocks"}
              {activeTab === "crypto" && "🪙 Crypto"}
              {activeTab === "index" && "📊 Indices"}
              {PRO_ONLY_TABS.includes(activeTab as any) && !isPro ? " (Pro only)" : ""}
            </h3>

            {/* If tab is pro-only and user isn't pro, show gated overlay */}
            {PRO_ONLY_TABS.includes(activeTab as any) && !isPro ? (
              <div className="p-6 bg-white rounded shadow text-center">
                <p className="mb-3">This tab is available for Pro members only.</p>
                <button
                  onClick={() => setToast({ msg: "Redirect to upgrade flow (implement in app)", bg: "bg-blue-600" })}
                  className="px-4 py-2 bg-yellow-500 rounded text-white"
                >
                  Upgrade to Pro
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentItems.length === 0 ? (
                    <div className="p-4 bg-white rounded shadow col-span-full text-center">
                      No items to show in this tab.
                    </div>
                  ) : (
                    currentItems.map((item) => <StockCard key={item.symbol} {...item} />)
                  )}
                </div>

                {/* Pagination controls */}
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => setPageForTab(activeTab, (pageMap[activeTab] ?? 1) - 1)}
                    disabled={(pageMap[activeTab] ?? 1) <= 1}
                    className="px-3 py-1 rounded border disabled:opacity-50"
                  >
                    Prev
                  </button>

                  <span>
                    Page {pageMap[activeTab] ?? 1} of {totalPagesForActive}
                  </span>

                  <button
                    onClick={() => setPageForTab(activeTab, (pageMap[activeTab] ?? 1) + 1)}
                    disabled={(pageMap[activeTab] ?? 1) >= totalPagesForActive}
                    className="px-3 py-1 rounded border disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>

          {/* --- EXISTING PAGE SECTIONS (kept exactly as before, with screener removed) --- */}

          {/* TOP 5 */}
          {tabTopTrades.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">🔥 Top Trades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tabTopTrades.map((t) => (
                  <StockCard key={t.symbol} {...t} />
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

          {/* Note: Live Prices section removed as requested */}
        </>
      )}
    </div>
  );
}
