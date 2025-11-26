// app/(dashboard)/watchlist/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef, useContext } from "react";
import Link from "next/link";

import { fetchStockData } from "@/src/api/fetchStockData";
import { generateSMCSignal, StockDisplay as XAIStockDisplay } from "@/src/utils/xaiLogic";
import { computeOptimizedSMC, OptimizedSMCResult } from "@/src/utils/smcEngineOptimized";
import { symbols as allSymbols } from "@/src/api/symbols";
import StockCard from "@/src/components/StockCard";
import { AuthContext } from "@/src/context/AuthContext";
import { getUserTrades as getUserTradesFromFirestore } from "@/firebase/firestoreActions";
import { getUserWatchlist } from "@/firebase/firestoreWatchlist";

// shadcn/ui components — adjust imports if your project maps them differently
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SymbolType = "stock" | "index" | "crypto";
type TabType = "top" | "stock" | "crypto" | "index";

const defaultSymbols: { symbol: string; type: SymbolType }[] = [
  { symbol: "RELIANCE.NS", type: "stock" },
  { symbol: "^NSEI", type: "index" },
  { symbol: "BTC/USD", type: "crypto" },
  { symbol: "ETH/USD", type: "crypto" },
  { symbol: "XAU/USD", type: "index" },
];

const REFRESH_INTERVAL = 180000; // 3 minutes

export default function WatchlistPage() {
  const { user } = useContext(AuthContext);
  const userEmail = (user as any)?.email ?? (user as any)?.emailAddress ?? "";

  const [savedTrades, setSavedTrades] = useState<any[]>([]);
  const [userWatchlist, setUserWatchlist] = useState<{ id: string; userEmail: string; symbol: string; type: SymbolType }[]>([]);
  const [liveMap, setLiveMap] = useState<Record<string, {
    symbol?: string;
    current?: number | null;
    previousClose?: number | null;
    prices?: number[];
    highs?: number[];
    lows?: number[];
    volumes?: number[];
    lastUpdated?: number;
  }>>({});
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);
  const [search, setSearch] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("top");
  const [sortBy, setSortBy] = useState<"confidence" | "trend" | "volume">("confidence");
  const PAGE_SIZE = 9;
  const [pageMap, setPageMap] = useState<Record<string, number>>({ top: 1, stock: 1, crypto: 1, index: 1 });

  const tabsRef = useRef<HTMLDivElement | null>(null);

  const apiSymbol = (s: string) => {
    if (s === "BTC/USD") return "BTC-USD";
    if (s === "ETH/USD") return "ETH-USD";
    if (s === "XAU/USD") return "GC=F";
    return s;
  };

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
        console.error("Failed to load trades", err);
        setSavedTrades([]);
      }
    })();
    return () => { mounted = false; };
  }, [userEmail]);

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
        setUserWatchlist((wl ?? []).map((w: any) => ({ id: w.id, userEmail: w.userEmail, symbol: w.symbol, type: (w.type ?? "stock") as SymbolType })));
      } catch (err) {
        console.error("Failed to load watchlist", err);
        setUserWatchlist([]);
      }
    })();
    return () => { mounted = false; };
  }, [userEmail]);

  const mappedExtraSymbols = allSymbols.map((s) => {
    let yahooSymbol = s.symbol;
    if (s.type === "crypto" && s.symbol.includes("BINANCE:")) {
      const pair = s.symbol.split(":")[1];
      const base = pair.replace("USDT", "");
      yahooSymbol = `${base}-USD`;
    }
    return { symbol: yahooSymbol, type: s.type as SymbolType };
  });

  const userWatchlistSymbols = userWatchlist.map((w) => ({ symbol: w.symbol, type: w.type }));
  const combinedSymbols = [...defaultSymbols, ...mappedExtraSymbols, ...userWatchlistSymbols];

  const uniqueSymbols = Array.from(new Map(combinedSymbols.map(s => [`${s.symbol}-${s.type}`, s])).values());
  const allSymbolsToFetch = Array.from(new Set([...uniqueSymbols.map(s => s.symbol), ...savedTrades.map((t: any) => t.symbol)]));

  useEffect(() => {
    let mounted = true;
    if (allSymbolsToFetch.length === 0) return;
    const fetchAll = async () => {
      try {
        const promises = allSymbolsToFetch.map(async (sym) => {
          try {
            const data = await fetchStockData(apiSymbol(sym));
            return [sym, data] as const;
          } catch (err) {
            console.warn("fetchStockData error for", sym, err);
            return [sym, {
              symbol: sym,
              current: 0,
              previousClose: null,
              prices: [],
              highs: [],
              lows: [],
              volumes: [],
              lastUpdated: Date.now(),
            }] as const;
          }
        });
        const results = await Promise.all(promises);
        if (!mounted) return;
        const next: Record<string, any> = {};
        for (const [sym, data] of results) next[sym] = data;
        setLiveMap(prev => ({ ...prev, ...next }));
      } catch (err) {
        console.error("fetchAll error", err);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [JSON.stringify(allSymbolsToFetch)]);

  type UIItem = {
    symbol: string;
    type: SymbolType;
    xai: XAIStockDisplay | null;
    optimized: OptimizedSMCResult;
    price: number;
    support?: number;
    resistance?: number;
    stoploss?: number | null;
    targets?: number[] | null;
    hitStatus?: "ACTIVE" | "TARGET ✅" | "STOP ❌";
  };

  const combinedForRanking: UIItem[] = useMemo(() => {
    const items: UIItem[] = [];

    for (const t of savedTrades) {
      const sym: string = t.symbol;
      const live = liveMap[sym];
      const prevClose = t.previousClose ?? t.entryPrice ?? live?.previousClose ?? 0;
      const current = live?.current ?? t.entryPrice ?? prevClose ?? 0;

      const stockInput = {
        symbol: sym,
        current,
        previousClose: prevClose,
        prices: live?.prices ?? t.prices ?? [],
        highs: live?.highs ?? t.highs ?? [],
        lows: live?.lows ?? t.lows ?? [],
        volumes: live?.volumes ?? t.volumes ?? [],
      };

      const baseResult = generateSMCSignal(stockInput);
      const opt = computeOptimizedSMC(stockInput as any, { signal: baseResult.signal, confidence: baseResult.confidence, stoploss: baseResult.stoploss, targets: baseResult.targets });
      const showTrade = opt.signal !== "HOLD";

      items.push({
        symbol: sym,
        type: t.type ?? "stock",
        xai: {
          symbol: sym,
          signal: baseResult.signal,
          confidence: baseResult.confidence,
          explanation: baseResult.explanation,
          price: current,
          type: t.type ?? "stock",
          support: prevClose * 0.995,
          resistance: prevClose * 1.01,
          stoploss: baseResult.stoploss,
          targets: baseResult.targets,
          hitStatus: baseResult.hitStatus,
        } as XAIStockDisplay,
        optimized: opt,
        price: current, // <--- use live price
        support: prevClose * 0.995,
        resistance: prevClose * 1.01,
        stoploss: showTrade ? opt.stoploss : null,
        targets: showTrade ? opt.targets : null,
        hitStatus: opt.signal === "HOLD" ? "ACTIVE" : baseResult.hitStatus,
      });
    }

    for (const s of uniqueSymbols) {
      if (savedTrades.some((t: any) => t.symbol === s.symbol)) continue;

      const live = liveMap[s.symbol];
      const current = live?.current ?? 0;
      const prevClose = live?.previousClose ?? 0;

      const stockInput = {
        symbol: s.symbol,
        current,
        previousClose: prevClose,
        prices: live?.prices ?? [],
        highs: live?.highs ?? [],
        lows: live?.lows ?? [],
        volumes: live?.volumes ?? [],
      };

      const baseResult = generateSMCSignal(stockInput);
      const opt = computeOptimizedSMC(stockInput as any, { signal: baseResult.signal, confidence: baseResult.confidence, stoploss: baseResult.stoploss, targets: baseResult.targets });
      const showTrade = opt.signal !== "HOLD";

      items.push({
        symbol: s.symbol,
        type: s.type,
        xai: {
          symbol: s.symbol,
          signal: baseResult.signal,
          confidence: baseResult.confidence,
          explanation: baseResult.explanation,
          price: current,
          type: s.type,
          support: prevClose ? prevClose * 0.995 : 0,
          resistance: prevClose ? prevClose * 1.01 : 0,
          stoploss: baseResult.stoploss,
          targets: baseResult.targets,
          hitStatus: baseResult.hitStatus,
        } as XAIStockDisplay,
        optimized: opt,
        price: current, // <--- use live price
        support: prevClose ? prevClose * 0.995 : undefined,
        resistance: prevClose ? prevClose * 1.01 : undefined,
        stoploss: showTrade ? opt.stoploss : null,
        targets: showTrade ? opt.targets : null,
        hitStatus: opt.signal === "HOLD" ? "ACTIVE" : baseResult.hitStatus,
      });
    }

    return items;
  }, [savedTrades, uniqueSymbols, liveMap]);

  const computeTrendScore = (it: UIItem) => {
    const prev = it.support ? it.support / 0.995 : 0;
    const price = it.price ?? 0;
    return prev ? (price - prev) / prev : 0;
  };
  const computeVolumeScore = (it: UIItem) => {
    const live = liveMap[it.symbol];
    const vol = live?.volumes;
    if (Array.isArray(vol) && vol.length) return vol[vol.length - 1] ?? 0;
    return 0;
  };

  const sortList = (list: UIItem[], by: typeof sortBy) => {
    if (by === "confidence") return [...list].sort((a, b) => b.optimized.optimizedConfidence - a.optimized.optimizedConfidence);
    if (by === "trend") return [...list].sort((a, b) => computeTrendScore(b) - computeTrendScore(a));
    return [...list].sort((a, b) => computeVolumeScore(b) - computeVolumeScore(a));
  };

  const paginate = (list: UIItem[], page: number) => {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return { items: list.slice(start, end), totalPages, page: safePage };
  };

  const setPageForTab = (tab: TabType, page: number) => {
    setPageMap(prev => ({ ...prev, [tab]: page }));
    if (tabsRef.current) tabsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const combinedSorted = useMemo(() => sortList(combinedForRanking, sortBy), [combinedForRanking, sortBy]);
  const tabTopTrades = combinedSorted.slice(0, 5);
  const tabStocks = combinedSorted.filter(x => x.type === "stock");
  const tabCrypto = combinedSorted.filter(x => x.type === "crypto");
  const tabIndex = combinedSorted.filter(x => x.type === "index");

  const { currentItems, totalPagesForActive } = useMemo(() => {
    let list: UIItem[] = [];
    if (activeTab === "top") list = tabTopTrades;
    else if (activeTab === "stock") list = tabStocks;
    else if (activeTab === "crypto") list = tabCrypto;
    else list = tabIndex;

    const page = pageMap[activeTab] ?? 1;
    const { items, totalPages, page: safePage } = paginate(list, page);
    if (safePage !== page) setPageMap(prev => ({ ...prev, [activeTab]: safePage }));
    return { currentItems: items, totalPagesForActive: Math.max(1, totalPages) };
  }, [activeTab, sortBy, combinedSorted, pageMap.top, pageMap.stock, pageMap.crypto, pageMap.index]);

  const renderHoldFooter = () => (
    <div className="mt-3 text-sm text-gray-600">
      Market indecisive (HOLD). Waiting for BOS/CHOCH confirmation.
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Watchlist</h1>
        <Link href="/" className="text-sm text-blue-600">← Back to Home</Link>
      </div>

      {toast && <div className={`p-3 rounded mb-4 ${toast.bg || "bg-blue-600"} text-white`}>{toast.msg}</div>}

      {!user ? (
        <div className="p-6 bg-white rounded shadow text-center">
          <p className="text-gray-600">Please log in to view your watchlist.</p>
        </div>
      ) : (
        <>
          {/* Search + Controls */}
          <div className="mb-6 flex gap-3">
            <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search symbol..." />
            <Select onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="trend">Trend</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setToast({ msg: "Search filter applied locally", bg: "bg-gray-700" }); }}>Search</Button>
          </div>

          {/* Tabs + Grid */}
          <div ref={tabsRef} className="sticky top-20 bg-transparent z-20 py-2">
            <div className="flex items-center gap-2">
              <Tabs>
                <TabsList className="bg-white p-1 rounded shadow">
                  <TabsTrigger value="top" onClick={() => { setActiveTab("top"); setPageMap(p => ({ ...p, top: 1 })); }}>Top Trades</TabsTrigger>
                  <TabsTrigger value="stock" onClick={() => { setActiveTab("stock"); setPageMap(p => ({ ...p, stock: 1 })); }}>Stocks</TabsTrigger>
                  <TabsTrigger value="crypto" onClick={() => { setActiveTab("crypto"); setPageMap(p => ({ ...p, crypto: 1 })); }}>Crypto</TabsTrigger>
                  <TabsTrigger value="index" onClick={() => { setActiveTab("index"); setPageMap(p => ({ ...p, index: 1 })); }}>Index</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentItems.length === 0 ? (
              <div className="p-6 bg-white rounded shadow col-span-full text-center">No items</div>
            ) : currentItems
                .filter(ci => search.trim() === "" ? true : ci.symbol.toLowerCase().includes(search.trim().toLowerCase()))
                .map((it, i) => {
                  const sc = {
                    symbol: it.symbol,
                    signal: it.optimized.signal === "HOLD" ? (it.xai?.signal ?? "HOLD") : it.optimized.signal,
                    confidence: it.optimized.optimizedConfidence,
                    explanation:
                      (it.xai?.explanation ? it.xai.explanation + " · " : "") +
                      (it.optimized.reasons?.slice(0, 3).join(" | ") ?? ""),
                    price: liveMap[it.symbol]?.current ?? it.price, // <- live price used
                    type: it.type,
                    support: it.support,
                    resistance: it.resistance,
                    stoploss: it.stoploss ?? undefined,
                    targets: it.targets ?? undefined,
                    hitStatus: it.hitStatus,
                  } as XAIStockDisplay;

                  const isHold = it.optimized.signal === "HOLD";
                  const key = `${it.symbol}-${it.type}-${activeTab}-${pageMap[activeTab]}-${i}`;

                  return (
                    <Card key={key} className={isHold ? "bg-gray-100" : "bg-white"}>
                      <CardContent>
                        <StockCard {...sc} />
                        {isHold ? renderHoldFooter() : (
                          <div className="mt-3 text-sm text-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{it.optimized.signal}</Badge>
                              <span className="font-medium">Conf: {it.optimized.optimizedConfidence}%</span>
                              {it.optimized.indicators.rsi !== undefined && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>RSI {Math.round(it.optimized.indicators.rsi ?? 0)}</span>
                                </>
                              )}
                            </div>
                            {it.stoploss != null && it.targets != null && (
                              <div className="mb-2">
                                <div><strong>Stoploss:</strong> {it.stoploss.toFixed(2)}</div>
                                <div className="mt-1">
                                  <strong>Targets:</strong>
                                  <div className="flex gap-2 mt-1">
                                    {it.targets.map((t, idx) => <div key={idx} className="px-2 py-1 bg-gray-50 rounded">{`T${idx + 1}: ${t.toFixed(2)}`}</div>)}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="text-xs text-gray-600">
                              {it.optimized.reasons.slice(0, 3).map((r, idx) => <div key={idx}>• {r}</div>)}
                              {it.optimized.reasons.length > 3 && <div>• +{it.optimized.reasons.length - 3} more</div>}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <Button disabled={(pageMap[activeTab] ?? 1) <= 1} onClick={() => setPageForTab(activeTab, (pageMap[activeTab] ?? 1) - 1)}>Prev</Button>
            <div>Page {pageMap[activeTab] ?? 1} / {totalPagesForActive}</div>
            <Button disabled={(pageMap[activeTab] ?? 1) >= totalPagesForActive} onClick={() => setPageForTab(activeTab, (pageMap[activeTab] ?? 1) + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}
