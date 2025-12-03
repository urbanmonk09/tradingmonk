"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import StockCard from "@/src/components/StockCard";
import NotificationToast from "@/src/components/NotificationToast";
import RightSignupPanel from "@/src/components/RightSignupPanel";

import { auth } from "@/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserTrades } from "@/firebase/firestoreActions";

import { computeMultiTimeframeSMC, OptimizedSMCResult } from "@/src/utils/smcEngineOptimized";
import { StockDisplay } from "@/src/utils/xaiLogic";
import { useLivePrices } from "@/src/hooks/useLivePrices";
import type { LiveStockData, SymbolInput } from "@/src/hooks/useLivePrices";

/* ---------------------------------------------- */
const HOME_SYMBOLS = Object.freeze({
  stock: ["RELIANCE", "TCS", "INFY"] as const,
  index: ["NIFTY 50", "NIFTY BANK"] as const,
  crypto: ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT"] as const,
});
type Group = keyof typeof HOME_SYMBOLS;
/* ---------------------------------------------- */

const normalizeSignal = (s?: string): "LONG" | "SHORT" | "HOLD" => {
  if (!s) return "HOLD";
  const x = s.toUpperCase();
  if (x.includes("SELL") || x.includes("SHORT")) return "SHORT";
  if (x.includes("BUY") || x.includes("LONG")) return "LONG";
  return "HOLD";
};

/* ------- Robust tick normalizer used for both NSE & Finnhub responses ------- */
function buildNormalizedTick(raw: any): {
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  timestamp: number;
} {
  const now = Date.now();

  // If caller already returned our LiveStockData shape (c,h,l,o,pc,timestamp)
  if (raw && typeof raw === "object" && ("c" in raw || "price" in raw || "pc" in raw || "prevClose" in raw)) {
    // support many shapes:
    const price = Number(raw.c ?? raw.price ?? raw.close ?? raw.current ?? 0);
    const open = raw.o ?? raw.open ?? null;
    const high = raw.h ?? raw.high ?? null;
    const low = raw.l ?? raw.low ?? null;
    const prevClose = raw.pc ?? raw.prevClose ?? raw.previous_close ?? raw.previousClose ?? null;
    // timestamp from finnub (seconds) or ms
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

  // fallback
  return { price: 0, open: null, high: null, low: null, prevClose: null, timestamp: now };
}

/* ---------------------------------------------- */
export default function Home() {
  const router = useRouter();
  const [savedTrades, setSavedTrades] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; bg?: string } | null>(null);

  const symbolInputs: SymbolInput[] = useMemo(
    () => [
      ...HOME_SYMBOLS.index.map((s) => ({ symbol: s, type: "index" as const })),
      ...HOME_SYMBOLS.stock.map((s) => ({ symbol: s, type: "stock" as const })),
      ...HOME_SYMBOLS.crypto.map((s) => ({ symbol: s, type: "crypto" as const })),
    ],
    []
  );

  const { prices, isConnected, error } = useLivePrices(symbolInputs);

  const priceBySymbol = useMemo(() => {
    const map = new Map<string, LiveStockData>();
    if (!prices || !Array.isArray(prices)) return map;
    prices.forEach((p) => {
      if (p && (p.s || (p as any).symbol)) {
        const key = String(p.s ?? (p as any).symbol).trim();
        map.set(key, p);
      }
    });
    return map;
  }, [prices]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.email) {
        try {
          setSavedTrades(await getUserTrades(u.email));
        } catch {
          setSavedTrades([]);
        }
      } else setSavedTrades([]);
    });
    return () => unsub();
  }, []);

  const cards: StockDisplay[] = useMemo(() => {
    const output: StockDisplay[] = [];

    (["stock", "index"] as Group[]).forEach((grp) => {
      let best: StockDisplay | null = null;

      HOME_SYMBOLS[grp].forEach((sym) => {
        const normalizedSymbol = sym.replace(/^NSE:/i, "").trim();

        // attempt multiple lookups: exact symbol, normalized symbol, NSE style, etc.
        const tickRaw =
          priceBySymbol.get(sym) ??
          priceBySymbol.get(normalizedSymbol) ??
          priceBySymbol.get(sym.replace(/\s+/g, "").toUpperCase()) ??
          undefined;

        const tickNormalized = buildNormalizedTick(tickRaw);

        // live price prefers the actual live price; fallback to prevClose only when live is zero/absent
        const price = tickNormalized.price > 0 ? tickNormalized.price : tickNormalized.prevClose ?? 0;

        // Compute SMC using multi-timeframe function (we pass best-available numbers)
        let smc: OptimizedSMCResult;
        try {
          smc = computeMultiTimeframeSMC({
            symbol: sym,
            current: price,
            previousClose: tickNormalized.prevClose ?? price,
            prices: [], // you can wire historical arrays here later for better signals
            highs: tickNormalized.high !== null ? [tickNormalized.high] : [],
            lows: tickNormalized.low !== null ? [tickNormalized.low] : [],
            volumes: [],
          });
        } catch (err) {
          // maintain shape expected by UI
          smc = {
            symbol: sym,
            signal: "HOLD",
            optimizedConfidence: 50,
            reasons: [],
            indicators: {},
            stoploss: 0,
            targets: [],
            baseConfidence: 50,
            bestTimeframe: "N/A",
          } as any;
        }

        const card: StockDisplay = {
          symbol: sym,
          price,
          type: grp,
          signal: normalizeSignal(smc.signal),
          confidence: Math.round((smc as any).optimizedConfidence ?? 50),
          explanation: (smc.reasons ?? []).slice(0, 3).join("; "),
          support: tickNormalized.prevClose ? tickNormalized.prevClose * 0.995 : undefined,
          resistance: tickNormalized.prevClose ? tickNormalized.prevClose * 1.01 : undefined,
          stoploss: (smc as any).stoploss,
          targets: (smc as any).targets ?? [],
          hitStatus: "ACTIVE",
        };

        if (!best || card.confidence > best.confidence) best = card;
      });

      if (best) output.push(best);
    });

    // crypto cards (use same normalization but strip exchange prefix for display)
    HOME_SYMBOLS.crypto.forEach((sym) => {
      const tickRaw = priceBySymbol.get(sym) ?? priceBySymbol.get(sym.replace(/^BINANCE:/i, ""));
      const tickNormalized = buildNormalizedTick(tickRaw);

      const price = tickNormalized.price > 0 ? tickNormalized.price : tickNormalized.prevClose ?? 0;

      // build SMC for crypto too:
      let smc: OptimizedSMCResult;
      try {
        smc = computeMultiTimeframeSMC({
          symbol: sym,
          current: price,
          previousClose: tickNormalized.prevClose ?? price,
          prices: [],
          highs: tickNormalized.high !== null ? [tickNormalized.high] : [],
          lows: tickNormalized.low !== null ? [tickNormalized.low] : [],
          volumes: [],
        });
      } catch {
        smc = {
          symbol: sym,
          signal: "HOLD",
          optimizedConfidence: 50,
          reasons: [],
          indicators: {},
          stoploss: 0,
          targets: [],
          baseConfidence: 50,
          bestTimeframe: "N/A",
        } as any;
      }

      output.push({
        symbol: sym.replace(/^BINANCE:/i, ""),
        price,
        type: "crypto",
        signal: normalizeSignal(smc.signal),
        confidence: Math.round((smc as any).optimizedConfidence ?? 50),
        explanation: (smc.reasons ?? []).slice(0, 3).join("; "),
        support: tickNormalized.prevClose ? tickNormalized.prevClose * 0.995 : undefined,
        resistance: tickNormalized.prevClose ? tickNormalized.prevClose * 1.01 : undefined,
        stoploss: (smc as any).stoploss,
        targets: (smc as any).targets ?? [],
        hitStatus: "ACTIVE",
      });
    });

    return output;
  }, [priceBySymbol]);

  // ------------------ Fixed toast effect (store last sigKey safely) ------------------
  const lastNotifiedRef = useRef<{ sigKey?: string } | null>(null);

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
    const safe = Math.min(100, Math.max(0, conf));
    return (
      <div className="w-full h-3 bg-gray-300/40 rounded overflow-hidden backdrop-blur">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${safe}%` }} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex justify-center px-6">
      <div className="w-full max-w-7xl flex gap-6 pt-8">
        {/* LEFT CONTENT */}
        <div className="flex-1">
          {toast && <NotificationToast message={toast.msg} bg={toast.bg} onClose={() => setToast(null)} />}

          <div className="mb-6 flex items-center justify-between">
            <input
              type="text"
              disabled
              placeholder="Only Pro Members can Search"
              className="px-4 py-2 w-64 bg-gray-700/40 border border-gray-600 rounded text-gray-400 cursor-not-allowed backdrop-blur-sm"
            />

            <button
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-lg transition"
              onClick={() => router.push("/watchlist")}
            >
              Pro Members Watchlist
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-4">* Educational Research Work Only for Guidance</p>

          {!isConnected && <div className="text-gray-400 text-sm mb-2">Connecting to live prices…</div>}
          {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

          {/* CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.length === 0 && (
              <div className="col-span-full bg-black/40 p-4 rounded-lg text-center">No signals yet…</div>
            )}

            {cards.map((c) => (
              <div
                key={c.symbol}
                className="bg-white/10 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-xl hover:shadow-indigo-500/20 transition"
              >
                <div className="flex justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg">{c.symbol}</div>
                    <div className="text-xs text-gray-300">{c.explanation}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-indigo-400">{c.signal}</div>
                    <div className="text-sm text-gray-300">{c.price !== undefined ? c.price.toFixed(2) : "--"}</div>
                  </div>
                </div>

                <ConfidenceBar conf={c.confidence} />

                <div className="text-xs flex justify-between text-gray-400 mt-1 mb-3">
                  <span>Buy {c.confidence}%</span>
                  <span>Sell {100 - c.confidence}%</span>
                </div>

                <StockCard {...c} price={c.price} />
              </div>
            ))}
          </div>

          {/* FOOTER */}
          <footer className="mt-10 p-4 bg-gray-800/40 backdrop-blur rounded-lg text-center text-sm border border-white/10">
            <div className="flex justify-center gap-4 mb-1">
              <a href="/privacy" className="text-blue-400">
                Privacy
              </a>
              <a href="/terms" className="text-blue-400">
                Terms
              </a>
              <a href="/contact" className="text-blue-400">
                Contact
              </a>
              <a href="/refund" className="text-blue-400">
                Refund
              </a>
              <a href="/shipping" className="text-blue-400">
                Shipping
              </a>
            </div>
            <div className="text-gray-400">© 2025 AI Signal Platform</div>
          </footer>
        </div>

        {/* RIGHT SIGNUP PANEL */}
        <div className="hidden lg:block w-[330px]">
          <RightSignupPanel />
          <p className="text-xs text-gray-400 mt-2">
            Disclaimer: All stock ideas shown here are purely for educational purposes. They are not recommendations to buy or sell. Users should do their own research before trading.
          </p>
        </div>
      </div>
    </div>
  );
}
