"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import StockCard from "@/src/components/StockCard";
import NotificationToast from "@/src/components/NotificationToast";

import { symbols, WatchItem, SymbolType } from "@/src/api/symbols";
import { StockDisplay } from "@/src/utils/xaiLogic";
import { useLivePrices, LiveStockData, SymbolInput } from "@/src/hooks/useLivePrices";
import { computeMultiTimeframeSMC } from "@/src/utils/smcEngineOptimized";

const normalizeSignal = (s?: string): "LONG" | "SHORT" | "HOLD" => {
  if (!s) return "HOLD";
  const x = s.toUpperCase();
  if (x.includes("SELL") || x.includes("SHORT")) return "SHORT";
  if (x.includes("BUY") || x.includes("LONG")) return "LONG";
  return "HOLD";
};

function buildNormalizedTick(raw: any): {
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  timestamp: number;
} {
  const now = Date.now();

  if (raw && typeof raw === "object" && ("c" in raw || "price" in raw || "pc" in raw || "prevClose" in raw)) {
    const price = Number(raw.c ?? raw.price ?? raw.close ?? raw.current ?? 0);
    const open = raw.o ?? raw.open ?? null;
    const high = raw.h ?? raw.high ?? null;
    const low = raw.l ?? raw.low ?? null;
    const prevClose = raw.pc ?? raw.prevClose ?? raw.previous_close ?? raw.previousClose ?? null;
    let ts = raw.timestamp ?? raw.t ?? raw.time ?? now;
    if (typeof ts === "number" && ts < 1e12) ts = ts * 1000;
    ts = Number(ts) || now;

    return {
      price: Number.isFinite(price) ? price : 0,
      open: Number.isFinite(open) ? Number(open) : null,
      high: Number.isFinite(high) ? Number(high) : null,
      low: Number.isFinite(low) ? Number(low) : null,
      prevClose: Number.isFinite(prevClose) ? Number(prevClose) : null,
      timestamp: ts,
    };
  }

  return { price: 0, open: null, high: null, low: null, prevClose: null, timestamp: now };
}

export default function WatchlistPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<SymbolType>("stock");
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);

  const isPro = true; // placeholder

  const lastNotifiedRef = useRef<{ sigKey?: string } | null>(null);
  const smcCacheRef = useRef<Record<string, { timestamp: number; smc: any }>>({});

  const filteredSymbols: WatchItem[] = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return symbols.filter((s) => s.type === activeTab).filter((s) => (q ? s.symbol.toLowerCase().includes(q) : true));
  }, [activeTab, searchTerm]);

  const liveInputs: SymbolInput[] = useMemo(() => filteredSymbols.map((s) => ({ symbol: s.symbol, type: s.type })), [filteredSymbols]);

  const { prices, isConnected, error } = useLivePrices(liveInputs);

  const priceBySymbol = useMemo(() => {
    const map = new Map<string, LiveStockData>();
    (prices ?? []).forEach((p) => {
      if (p && (p.s || (p as any).symbol)) {
        const key = String(p.s ?? (p as any).symbol).trim();
        map.set(key, p);
      }
    });
    return map;
  }, [prices]);

  const cards: StockDisplay[] = useMemo(() => {
    const now = Date.now();
    return filteredSymbols.map((item) => {
      const normalizedSymbol = item.symbol.replace(/^NSE:/i, "").trim();

      const tickRaw = priceBySymbol.get(item.symbol) ?? priceBySymbol.get(normalizedSymbol) ?? undefined;
      const tickNormalized = buildNormalizedTick(tickRaw);

      const currentPrice = tickNormalized.price > 0 ? tickNormalized.price : tickNormalized.prevClose ?? 0;

      let smcData = smcCacheRef.current[item.symbol]?.smc;
      const cachedAt = smcCacheRef.current[item.symbol]?.timestamp ?? 0;

      if (!smcData || now - cachedAt > 30_000) {
        try {
          smcData = computeMultiTimeframeSMC({
            symbol: item.symbol,
            current: currentPrice,
            previousClose: tickNormalized.prevClose ?? currentPrice,
            prices: [],
            highs: tickNormalized.high !== null ? [tickNormalized.high] : [],
            lows: tickNormalized.low !== null ? [tickNormalized.low] : [],
            volumes: [],
          });
        } catch {
          smcData = { signal: "HOLD", optimizedConfidence: 50, reasons: [], stoploss: 0, targets: [] } as any;
        }
        smcCacheRef.current[item.symbol] = { timestamp: now, smc: smcData };
      }

      return {
        symbol: normalizedSymbol,
        signal: normalizeSignal(smcData.signal),
        confidence: Math.round((smcData as any).optimizedConfidence ?? 50),
        explanation: (smcData.reasons ?? []).slice(0, 3).join("; "),
        price: currentPrice,
        type: item.type,
        stoploss: (smcData as any).stoploss,
        targets: (smcData as any).targets ?? [],
        support: tickNormalized.prevClose ? tickNormalized.prevClose * 0.995 : undefined,
        resistance: tickNormalized.prevClose ? tickNormalized.prevClose * 1.01 : undefined,
        hitStatus: "ACTIVE",
      } as StockDisplay;
    });
  }, [filteredSymbols, priceBySymbol]);

  // Toast notifications (dedup using sigKey)
  useEffect(() => {
    const alertCards = cards.filter((c) => c.signal === "LONG" || c.signal === "SHORT");
    if (alertCards.length === 0) return;

    const sigKey = alertCards.map((c) => `${c.symbol}-${c.signal}`).join(",");

    if (lastNotifiedRef.current?.sigKey !== sigKey) {
      const firstAlert = alertCards[0];
      setToast({ msg: `${firstAlert.symbol}: ${firstAlert.signal} signal generated!` });
      lastNotifiedRef.current = { sigKey };
    }
  }, [cards]);

  const ConfidenceBar = ({ conf }: { conf: number }) => {
    const pct = Math.max(0, Math.min(100, conf));
    return (
      <div className="w-full h-3 rounded bg-gray-200 flex overflow-hidden">
        <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
        <div className="h-full bg-red-400" style={{ width: `${100 - pct}%` }} />
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {toast && <NotificationToast message={toast.msg} bg={toast.bg} onClose={() => setToast(null)} />}

      <button onClick={() => router.push("/")} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded">
        ← Back to Home
      </button>

      <input
        type="text"
        placeholder={isPro ? "Search symbols" : "Pro members only"}
        value={searchTerm}
        onChange={(e) => isPro && setSearchTerm(e.target.value)}
        disabled={!isPro}
        className={`w-full p-2 mb-4 border rounded ${isPro ? "border-gray-300" : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-400"}`}
      />

      <div className="flex space-x-4 mb-4 border-b border-gray-300">
        {(["stock", "index", "crypto"] as const).map((tab) => (
          <button
            key={tab}
            className={`py-2 px-4 font-semibold ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-blue-600"}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "stock" ? "Stocks" : tab === "index" ? "Indices" : "Crypto"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.filter((c) => c.type === activeTab).length === 0 && (
          <div className="col-span-full bg-white p-6 rounded text-center shadow">No trades in this category…</div>
        )}

        {cards
          .filter((c) => c.type === activeTab)
          .map((c) => (
            <div key={c.symbol} className="bg-white rounded shadow p-4">
              <div className="flex justify-between mb-2">
                <div>
                  <div className="font-semibold">{c.symbol}</div>
                  <div className="text-xs text-gray-500">{c.explanation}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{c.signal}</div>
                  <div className="text-sm text-gray-500">{(c.price ?? 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="mb-2">
                <ConfidenceBar conf={c.confidence} />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Buy {c.confidence}%</span>
                  <span>Sell {100 - c.confidence}%</span>
                </div>
              </div>

              <StockCard {...c} price={c.price} />
            </div>
          ))}
      </div>

      {!isConnected && <div className="text-gray-500 mt-4">Connecting to live prices…</div>}
      {error && <div className="text-red-600 mt-2">{error}</div>}
    </div>
  );
}
