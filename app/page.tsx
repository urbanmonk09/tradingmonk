"use client";

import React, { useEffect, useState, useRef } from "react";
import StockCard from "../src/components/StockCard";
import { fetchStockData } from "../src/api/fetchStockData";
import { generateSMCSignal } from "../src/utils/xaiLogic";
import { signalToTradeResult } from "../src/utils/tradeManager";
import NotificationToast from "../src/components/NotificationToast";
import { useRouter } from "next/navigation";
import { api } from "../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { convex } from "@/lib/convexClient";
import Link from "next/link";
import { useMutation } from "convex/react";

export type StockDisplay = {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  explanation: string;
  price?: number;
  type: "stock" | "index" | "crypto";
  support?: number;
  resistance?: number;
  stoploss?: number;
  targets?: number[];
  hitStatus?: "ACTIVE" | "TARGET ✅" | "STOP ❌";
};

const defaultSymbols = [
  "^NSEI","^NSEBANK","RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS",
  "LT.NS","SBIN.NS","ITC.NS","HINDUNILVR.NS","MARUTI.NS","AXISBANK.NS","KOTAKBANK.NS",
  "BAJFINANCE.NS","BHARTIARTL.NS","SUNPHARMA.NS","TATAMOTORS.NS","TATASTEEL.NS",
  "HCLTECH.NS","WIPRO.NS","ADANIENT.NS","BTC/USD","ETH/USD","SOL/USD"
];

export default function Home() {
  const [stockData, setStockData] = useState<StockDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StockDisplay[]>([]);
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);
  const lastSignalsRef = useRef<Record<string, string>>({});
  const { user, isLoaded } = useUser();

  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("lastSignals") : null;
      lastSignalsRef.current = raw ? JSON.parse(raw) : {};
    } catch {
      lastSignalsRef.current = {};
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const computeFixedLevels = (prevClose: number, smcSignal: "BUY"|"SELL"|"HOLD") => {
    let stoploss = prevClose;
    let targets = [prevClose];
    if (smcSignal === "BUY") {
      stoploss = prevClose * 0.985;
      targets = [prevClose * 1.01, prevClose * 1.02, prevClose * 1.03];
    } else if (smcSignal === "SELL") {
      stoploss = prevClose * 1.015;
      targets = [prevClose * 0.99, prevClose * 0.98, prevClose * 0.97];
    }
    return { stoploss, targets };
  };

 const saveTrade = useMutation(api.trades.saveTrade)



  async function maybeNotifyAndSave(
    symbol: string,
    provider: string,
    trade: any,
    currentPrice: number | null
  ) {
    const normalizedSignal: "BUY"|"SELL"|"HOLD" =
      trade.signal === "BUY" || trade.signal === "SELL"
        ? trade.signal
        : trade.signal === "long"
        ? "BUY"
        : trade.signal === "short"
        ? "SELL"
        : "HOLD";

    // Avoid duplicate notifications
    if (lastSignalsRef.current[symbol] === normalizedSignal) return;
    lastSignalsRef.current[symbol] = normalizedSignal;

    if (typeof window !== "undefined") {
      localStorage.setItem("lastSignals", JSON.stringify(lastSignalsRef.current));
    }

    const isPro = Boolean(user?.publicMetadata?.isPro || (user as any)?.isPro);

    // Browser notifications for Pro members
    if (isPro && typeof window !== "undefined" && "Notification" in window) {
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

    // Save trade to Convex
    if (isPro && userEmail) {
      const payload = {
        userEmail,
        symbol,
        direction: normalizedSignal === "BUY" ? "long" : "short",
        entryPrice: currentPrice ?? (trade.entryPrice ?? 0),
        stopLoss: trade.stoploss ?? undefined,
        targets: trade.targets ?? undefined,
        confidence: trade.confidence ?? 0,
        status: "active",
        provider,
        note: trade.explanation ?? "",
      };
      await saveTrade(payload);
;
    }
  }

  async function loadData(isLiveUpdate = false) {
    if (!isLiveUpdate) setLoading(true);
    const out: StockDisplay[] = [];
    const enhancedSymbols = [...defaultSymbols, "XAU/USD"];

    for (let i = 0; i < enhancedSymbols.length; i++) {
      const symbol = enhancedSymbols[i];
      try {
        const provider = i % 2 === 0 ? "finnhub" : "yahoo";
        const data = await fetchStockData(symbol, provider as any);
        const smc = generateSMCSignal(data);
        const trade = signalToTradeResult(smc, symbol);

        let type: "stock"|"index"|"crypto" = "stock";
        if (symbol.startsWith("^")) type = "index";
        else if (symbol.includes("/USD") || symbol.includes("BINANCE:")) type = "crypto";

        const displaySymbol = provider === "yahoo" && type === "stock" ? symbol : symbol.replace(".NS", "");
        const prevClose = typeof data.previousClose === "number" ? data.previousClose : data.current;

        const { stoploss, targets } = prevClose ? computeFixedLevels(prevClose, trade.signal) : { stoploss: undefined, targets: undefined };
        const currentPrice = typeof data.current === "number" ? data.current : prevClose;
        const safePrice: number | undefined = currentPrice ?? undefined;

        const mappedSignal: "BUY"|"SELL"|"HOLD" =
          ["BUY","SELL","HOLD"].includes(trade.signal) ? trade.signal
          : trade.signal === "BUY"
          ? "BUY"
          : trade.signal === "SELL"
          ? "SELL"
          : "HOLD";

        out.push({
          symbol: displaySymbol,
          signal: mappedSignal,
          confidence: trade.confidence,
          explanation: trade.explanation,
          price: safePrice,
          type,
          support: prevClose ? prevClose * 0.995 : undefined,
          resistance: prevClose ? prevClose * 1.01 : undefined,
          stoploss,
          targets,
          hitStatus:
            safePrice !== undefined && targets && stoploss
              ? safePrice >= Math.max(...targets)
                ? "TARGET ✅"
                : safePrice <= stoploss
                ? "STOP ❌"
                : "ACTIVE"
              : "ACTIVE",
        });

        await maybeNotifyAndSave(displaySymbol, provider, { ...trade, stoploss, targets }, currentPrice);

      } catch (err) {
        console.warn("Error loading symbol:", symbol, err);
      }
    }

    // Sort and pick top display
    out.sort((a,b) => b.confidence - a.confidence);
    const topIndex = out.find(s => s.type === "index");
    const topStock = out.find(s => s.type === "stock");
    const topCrypto = out.find(s => s.type === "crypto");
    const topXAU = out.find(s => s.symbol === "XAU/USD");
    const prevTrade = out.find(s => s.hitStatus !== "ACTIVE");
    const topDisplay: StockDisplay[] = [];
    if (topIndex) topDisplay.push(topIndex);
    if (topStock) topDisplay.push(topStock);
    if (topCrypto) topDisplay.push(topCrypto);
    if (topXAU) topDisplay.push(topXAU);
    if (prevTrade && !topDisplay.includes(prevTrade)) topDisplay.push(prevTrade);

    setStockData(topDisplay);
    if (!isLiveUpdate) setLoading(false);
  }

  const handleSearch = async () => {
    if (!search.trim()) return;
    let symbol = search.trim().toUpperCase();
    if (!symbol.startsWith("^") && !symbol.includes("/USD") && !symbol.includes(".NS"))
      symbol += ".NS";
    try {
      const data = await fetchStockData(symbol);
      const smc = generateSMCSignal(data);
      const trade = signalToTradeResult(smc, symbol);

      let type: "stock"|"index"|"crypto" = "stock";
      if (symbol.startsWith("^")) type = "index";
      else if (symbol.includes("/USD") || symbol.includes("BINANCE:")) type = "crypto";

      const prevClose = typeof data.previousClose === "number" ? data.previousClose : data.current;
      const { stoploss, targets } = prevClose ? computeFixedLevels(prevClose, trade.signal) : { stoploss: undefined, targets: undefined };
      const currentPrice = typeof data.current === "number" ? data.current : prevClose;
      const safePrice: number | undefined = currentPrice ?? undefined;

      const mappedSignal: "BUY"|"SELL"|"HOLD" =
        ["BUY","SELL","HOLD"].includes(trade.signal) ? trade.signal
        : trade.signal === "BUY"
        ? "BUY"
        : trade.signal === "SELL"
        ? "SELL"
        : "HOLD";

      const s: StockDisplay = {
        symbol: symbol.replace(".NS",""),
        signal: mappedSignal,
        confidence: trade.confidence,
        explanation: trade.explanation,
        price: safePrice,
        type,
        support: prevClose ? prevClose * 0.995 : undefined,
        resistance: prevClose ? prevClose * 1.01 : undefined,
        stoploss,
        targets,
        hitStatus:
          safePrice !== undefined && targets && stoploss
            ? safePrice >= Math.max(...targets)
              ? "TARGET ✅"
              : safePrice <= stoploss
              ? "STOP ❌"
              : "ACTIVE"
            : "ACTIVE",
      };

      setSearchResults([s]);
      await maybeNotifyAndSave(s.symbol, "yahoo", { ...trade, stoploss, targets }, currentPrice);

    } catch (err) {
      console.warn("Search failed:", symbol, err);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {toast && (
        <NotificationToast message={toast.msg} bg={toast.bg} onClose={() => setToast(null)} />
      )}

      <div className="mb-4">
        
      <button
  onClick={() => {
    if (!isLoaded) return;
    if (user) {
      router.push("/watchlist");   // ✅ Go straight to watchlist
    } else {
      setToast({ msg: "Please log in first!", bg: "bg-red-600" });
    }
  }}
  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
>
  Pro Members Watchlist
</button>


      </div>

      <div className="flex gap-4 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search stock or crypto..."
          className="flex-1 p-2 rounded border border-gray-300"
        />
        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600"
        >
          Search
        </button>
      </div>

      {loading ? <div>Loading…</div> : (
        <>
          {searchResults.length > 0 ? (
            <>
              <h3 className="text-lg font-semibold mb-2">🔍 Search Result</h3>
              {searchResults.map(s => <StockCard key={s.symbol} {...s} />)}
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-2">Top Index / Stock / Crypto / XAU / Previous Trade</h3>
              {stockData.map(s => <StockCard key={s.symbol} {...s} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}
