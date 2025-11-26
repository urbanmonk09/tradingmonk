"use client";

import React, { useEffect, useState, useRef } from "react";
import StockCard from "../src/components/StockCard";
import NotificationToast from "../src/components/NotificationToast";
import { useRouter } from "next/navigation";

import { auth } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { saveTradeToFirestore, getUserTrades } from "../firebase/firestoreActions";

import { computeOptimizedSMC } from "@/src/utils/smcEngineOptimized";
import { StockDisplay } from "@/src/utils/xaiLogic";
import { fetchStockData } from "../src/api/fetchStockData";

const homeSymbols = {
  stock: ["RELIANCE.NS", "TCS.NS", "INFY.NS"],
  index: ["^NSEI", "^NSEBANK"],
  crypto: ["BTC/USD", "ETH/USD"],
  commodity: ["XAU/USD"],
};

const REFRESH_INTERVAL = 180000;

// Normalize signals
const normalizeSignal = (s: string): "BUY" | "SELL" | "HOLD" => {
  if (!s) return "HOLD";
  const x = s.toUpperCase();
  if (x.includes("SELL") || x.includes("SHORT")) return "SELL";
  if (x.includes("BUY") || x.includes("LONG")) return "BUY";
  return "HOLD";
};

export default function Home() {
  const [stockData, setStockData] = useState<StockDisplay[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StockDisplay[]>([]);
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [savedTrades, setSavedTrades] = useState<any[]>([]);

  const lastSignalsRef = useRef<Record<string, string>>({});
  const router = useRouter();

  // Firebase auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user?.email) {
        const trades = await getUserTrades(user.email);
        setSavedTrades(trades);
      }
    });
    return () => unsub();
  }, []);

  const userEmail = firebaseUser?.email ?? "";

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("lastSignals") : null;
      lastSignalsRef.current = raw ? JSON.parse(raw) : {};
    } catch {
      lastSignalsRef.current = {};
    }
  }, []);

  const apiSymbol = (symbol: string) => {
    if (symbol === "BTC/USD") return "BTC-USD";
    if (symbol === "ETH/USD") return "ETH-USD";
    if (symbol === "XAU/USD") return "GC=F";
    return symbol;
  };

  // Fetch live prices using fetchStockData
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
            const data = await fetchStockData(apiSymbol(symbol), "yahoo");
            if (!isMounted) return;

            setLivePrices((prev) => ({
              ...prev,
              [symbol]: {
                price: data.current ?? 0,
                previousClose: data.previousClose ?? data.current ?? 0,
                lastUpdated: now,
                prices: data.prices,
                highs: data.highs,
                lows: data.lows,
                volumes: data.volumes,
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
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [livePrices]);

  // Notify & save trades
  const maybeNotifyAndSave = async (
    symbol: string,
    trade: any,
    prevClose: number,
    currentPrice?: number
  ) => {
    const normalizedSignal = normalizeSignal(trade.signal);
    if (lastSignalsRef.current[symbol] === normalizedSignal) return;

    lastSignalsRef.current[symbol] = normalizedSignal;
    if (typeof window !== "undefined")
      localStorage.setItem("lastSignals", JSON.stringify(lastSignalsRef.current));

    if (firebaseUser && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(`${normalizedSignal} signal - ${symbol}`, {
          body: `${symbol} ${currentPrice ?? ""}`,
        });
      } else if (Notification.permission !== "denied") {
        await Notification.requestPermission();
      }
    }

    setToast({
      msg: `${normalizedSignal} signal on ${symbol}`,
      bg: normalizedSignal === "BUY" ? "bg-green-600" : "bg-red-600",
    });

    if (firebaseUser?.email) {
      await saveTradeToFirestore({
        userEmail,
        symbol,
        type: symbol.startsWith("^")
          ? "index"
          : symbol.includes("/USD") || symbol === "XAU/USD"
          ? "crypto"
          : "stock",
        direction: normalizedSignal === "BUY" ? "long" : "short",
        entryPrice: prevClose,
        stopLoss: trade.stoploss ?? undefined,
        targets: trade.targets ?? undefined,
        confidence: trade.optimizedConfidence ?? 0,
        status: "active",
        provider: "yahoo",
        note: trade.reasons.join("\n"),
        timestamp: Date.now(),
      });
    }
  };

  // Load & compute optimized SMC signals
  const loadData = async () => {
    setLoading(true);
    const out: StockDisplay[] = [];

    for (const [type, symbols] of Object.entries(homeSymbols) as [
      keyof typeof homeSymbols,
      string[]
    ][]) {
      let bestSymbol: StockDisplay | null = null;

      for (const symbol of symbols) {
        try {
          const live = livePrices[symbol] ?? {};
          const prevClose = live.previousClose ?? 0;
          const currentPrice = live.price ?? prevClose;

          const smc = computeOptimizedSMC({
            symbol,
            current: currentPrice,
            previousClose: prevClose,
            prices: live.prices ?? [],
            highs: live.highs ?? [],
            lows: live.lows ?? [],
            volumes: live.volumes ?? [],
          });

          const finalSignal = normalizeSignal(smc.signal);

          const stock: StockDisplay = {
            symbol: symbol.replace(".NS", ""),
            signal: finalSignal,
            confidence: smc.optimizedConfidence,
            explanation: smc.reasons.join("; "),
            price: currentPrice,
            type: type as StockDisplay["type"],
            stoploss: smc.stoploss,
            targets: smc.targets,
            support: prevClose * 0.995,
            resistance: prevClose * 1.01,
            hitStatus:
              (finalSignal === "BUY" && currentPrice >= Math.max(...smc.targets)) ||
              (finalSignal === "SELL" && currentPrice <= Math.min(...smc.targets))
                ? "TARGET ✅"
                : (finalSignal === "BUY" && currentPrice <= smc.stoploss) ||
                  (finalSignal === "SELL" && currentPrice >= smc.stoploss)
                ? "STOP ❌"
                : "ACTIVE",
          };

          const prevHitTrade = savedTrades.find(
            (t) => t.symbol.replace(".NS", "") === symbol.replace(".NS", "") && t.status === "target_hit"
          );
          if (prevHitTrade) stock.hitStatus = "TARGET ✅";

          if (!bestSymbol || stock.confidence > bestSymbol.confidence) bestSymbol = stock;

          await maybeNotifyAndSave(stock.symbol, smc, prevClose, currentPrice);
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

  // Search
  const handleSearch = () => {
    const term = search.trim().toLowerCase();
    if (!term) {
      setSearchResults(stockData);
      return;
    }
    const filtered = stockData.filter((s) => s.symbol.toLowerCase().includes(term));
    setSearchResults(filtered);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {toast && (
        <NotificationToast
          message={toast.msg}
          bg={toast.bg}
          onClose={() => setToast(null)}
        />
      )}

      {/* Watchlist Button */}
      <div className="mb-4">
        <button
          onClick={() => {
            if (!firebaseUser) {
              setToast({ msg: "Please login first!", bg: "bg-red-600" });
              return;
            }
            router.push("/watchlist");
          }}
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
        >
          Pro Members Watchlist
        </button>
        *Educational Research Work Only for Guidance
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Only pro members can search stocks, crypto, indices"
          className="flex-1 p-2 rounded border border-gray-300"
        />
        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Search
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div>Loading…</div>
      ) : (searchResults.length ? searchResults : stockData).map((s) => (
          <StockCard key={s.symbol} {...s} />
        ))}

      {/* Footer */}
      <footer className="mt-10 p-6 bg-white rounded shadow text-center text-sm text-gray-600">
        <div className="flex flex-col gap-3">
          <a href="/contact" className="text-blue-600 hover:underline">Contact Us</a>
          <a href="/terms" className="text-blue-600 hover:underline">Terms & Conditions</a>
          <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
          <a href="/refund" className="text-blue-600 hover:underline">Refund Policy</a>
          <a href="/shipping" className="text-blue-600 hover:underline">Shipping Policy</a>
        </div>
        <p className="mt-4 text-gray-500 text-xs">
          © {new Date().getFullYear()} AI Signal Generator — Educational Research Tool Only
        </p>
      </footer>
    </div>
  );
}
