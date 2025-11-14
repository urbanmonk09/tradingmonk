"use client";

import React, { useEffect, useState, useRef } from "react";
import StockCard from "../src/components/StockCard";
import { fetchStockData } from "../src/api/fetchStockData";
import { generateSMCSignal, StockDisplay } from "../src/utils/xaiLogic";
import NotificationToast from "../src/components/NotificationToast";
import { useRouter } from "next/navigation";
import { api } from "../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";

// ------------------------------
// Symbols for Home (4 max)
const homeSymbols = {
  stock: ["RELIANCE.NS", "TCS.NS", "INFY.NS"],
  index: ["^NSEI", "^NSEBANK"],
  crypto: ["BTC/USD", "ETH/USD"],
  commodity: ["XAU/USD"],
};

const REFRESH_INTERVAL = 180000; // 3 min

export default function Home() {
  const [stockData, setStockData] = useState<StockDisplay[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; previousClose: number; lastUpdated: number }>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StockDisplay[]>([]);
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);

  const lastSignalsRef = useRef<Record<string, string>>({});
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";

  // ------------------------------
  // Convex queries/mutations
  const savedTradesRaw = useQuery(api.trades.getUserTrades, userEmail ? { userEmail } : "skip") ?? [];
  const saveTrade = useMutation(api.trades.saveTrade);

  // ------------------------------
  // Load last signals from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("lastSignals") : null;
      lastSignalsRef.current = raw ? JSON.parse(raw) : {};
    } catch {
      lastSignalsRef.current = {};
    }
  }, []);

  // ------------------------------
  // Map symbols to API names
  const apiSymbol = (symbol: string) => {
    if (symbol === "BTC/USD") return "BTCUSDT";
    if (symbol === "ETH/USD") return "ETHUSDT";
    if (symbol === "XAU/USD") return "GC=F";
    return symbol;
  };

  // ------------------------------
  // Fetch live prices
  useEffect(() => {
    let isMounted = true;

    const allSymbols = [
      ...homeSymbols.stock,
      ...homeSymbols.index,
      ...homeSymbols.crypto,
      ...homeSymbols.commodity,
    ];

    const fetchAllPrices = async () => {
      const now = Date.now();
      for (const symbol of allSymbols) {
        const last = livePrices[symbol]?.lastUpdated ?? 0;
        if (now - last >= REFRESH_INTERVAL) {
          try {
            const provider =
              symbol.includes("/USD") && symbol !== "XAU/USD"
                ? "binance"
                : symbol === "XAU/USD"
                ? "yahoo"
                : "yahoo";

            const data = await fetchStockData(apiSymbol(symbol), provider as any);
            if (!isMounted) return;

            setLivePrices(prev => ({
              ...prev,
              [symbol]: {
                price: data.current ?? 0,
                previousClose: data.previousClose ?? data.current ?? 0,
                lastUpdated: now,
              },
            }));
          } catch (err) {
            console.warn("Failed fetching price", symbol, err);
            setToast({ msg: `Failed fetching ${symbol}`, bg: "bg-red-500" });
          }
        }
      }
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 10000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [livePrices]);

  // ------------------------------
  // Notify & save trades
  const maybeNotifyAndSave = async (symbol: string, provider: string, trade: any, prevClose: number, currentPrice?: number) => {
    const normalizedSignal: "BUY" | "SELL" | "HOLD" =
      trade.signal === "BUY" || trade.signal === "SELL"
        ? trade.signal
        : trade.signal === "long"
        ? "BUY"
        : trade.signal === "short"
        ? "SELL"
        : "HOLD";

    if (lastSignalsRef.current[symbol] === normalizedSignal) return;
    lastSignalsRef.current[symbol] = normalizedSignal;
    if (typeof window !== "undefined") localStorage.setItem("lastSignals", JSON.stringify(lastSignalsRef.current));

    const isPro = Boolean(user?.publicMetadata?.isPro || (user as any)?.isPro);

    if (isPro && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(`${normalizedSignal} signal - ${symbol}`, { body: `${symbol} ${currentPrice ?? ""}` });
      } else if (Notification.permission !== "denied") await Notification.requestPermission();
    }

    setToast({ msg: `${normalizedSignal} signal on ${symbol}`, bg: normalizedSignal === "BUY" ? "bg-green-600" : "bg-red-600" });

    if (isPro && userEmail) {
      await saveTrade({
        userEmail,
        symbol,
        type: symbol.startsWith("^")
          ? "index"
          : symbol.includes("/USD") || symbol === "XAU/USD"
          ? "crypto"
          : "stock",
        direction: normalizedSignal === "BUY" ? "long" : "short",
        entryPrice: prevClose, // ✅ use previous close
        stopLoss: trade.stoploss ?? undefined,
        targets: trade.targets ?? undefined,
        confidence: trade.confidence ?? 0,
        status: "active",
        provider,
        note: trade.explanation ?? "",
        timestamp: Date.now(),
      });
    }
  };

  // ------------------------------
  // Load Home Data
  const loadData = async () => {
    setLoading(true);
    const out: StockDisplay[] = [];

    for (const [type, symbols] of Object.entries(homeSymbols) as [keyof typeof homeSymbols, string[]][]) {
      let bestSymbol: StockDisplay | null = null;

      for (const symbol of symbols) {
        try {
          const provider =
            symbol.includes("/USD") && symbol !== "XAU/USD"
              ? "binance"
              : symbol === "XAU/USD"
              ? "yahoo"
              : "yahoo";

          const live = livePrices[symbol];
          const prevClose = live?.previousClose ?? 0;
          const currentPrice = live?.price ?? prevClose;

          const smc = generateSMCSignal({ current: currentPrice, previousClose: prevClose });
          const stoploss = smc.signal === "BUY" ? prevClose * 0.985 : smc.signal === "SELL" ? prevClose * 1.015 : prevClose;
          const targets =
            smc.signal === "BUY"
              ? [prevClose * 1.01, prevClose * 1.02, prevClose * 1.03]
              : smc.signal === "SELL"
              ? [prevClose * 0.99, prevClose * 0.98, prevClose * 0.97]
              : [prevClose];

          const stock: StockDisplay = {
            symbol: symbol.replace(".NS", ""),
            signal: smc.signal,
            confidence: smc.confidence,
            explanation: smc.explanation,
            price: currentPrice,
            type: type as StockDisplay["type"],
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
          };

          // Attach previous hit trade if exists
          const prevHitTrade = savedTradesRaw.find(
            t => t.symbol.replace(".NS", "") === symbol.replace(".NS", "") && t.status === "target_hit"
          );
          if (prevHitTrade) stock.hitStatus = "TARGET ✅";

          if (!bestSymbol || stock.confidence > bestSymbol.confidence) {
            bestSymbol = stock;
          }

          await maybeNotifyAndSave(stock.symbol, provider, { ...smc, stoploss, targets }, prevClose, currentPrice);
        } catch (err) {
          console.warn("Error loading symbol:", symbol, err);
        }
      }

      if (bestSymbol) out.push(bestSymbol);
    }

    setStockData(out);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [livePrices]);

  // ------------------------------
  // Search logic
  const handleSearch = () => {
    const term = search.trim().toLowerCase();
    if (!term) {
      setSearchResults(stockData);
      return;
    }
    const filtered = stockData.filter(s => s.symbol.toLowerCase().includes(term));
    setSearchResults(filtered);
  };

  // ------------------------------
  // Render
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {toast && <NotificationToast message={toast.msg} bg={toast.bg} onClose={() => setToast(null)} />}

      <div className="mb-4">
        <button
          onClick={() => {
            if (!isLoaded) return;
            if (user) router.push("/watchlist");
            else setToast({ msg: "Please log in first!", bg: "bg-red-600" });
          }}
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
        >
          Pro Members Watchlist
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search stock or crypto..."
          className="flex-1 p-2 rounded border border-gray-300"
        />
        <button onClick={handleSearch} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Search
        </button>
      </div>

      {loading ? <div>Loading…</div> : (searchResults.length ? searchResults : stockData).map(s => <StockCard key={s.symbol} {...s} />)}
    </div>
  );
}
