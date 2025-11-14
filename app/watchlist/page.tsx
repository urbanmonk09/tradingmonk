"use client";

import React, { useEffect, useState } from "react";
import StockCard from "../../src/components/StockCard";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { convex } from "@/lib/convexClient";

export interface Trade {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  explanation?: string;
  price?: number | null;
  type: "stock" | "index" | "crypto"; // ✅ make this required
  support?: number | null;
  resistance?: number | null;
  stoploss?: number | null;
  targets?: number[];
  hitStatus?: "TARGET ✅" | "STOP ❌" | "ACTIVE";
  provider?: string;
}

export default function Watchlist() {
  const { user, isLoaded } = useUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  useEffect(() => {
    if (!isLoaded || !userEmail) return;

    const fetchTrades = async () => {
      setLoading(true);
      try {
        const result = await convex.query(api.trades.getUserTrades, {
          email: userEmail,
        });

        const normalizedTrades: Trade[] = result.map((t: any) => {
          const displaySignal: "LONG" | "SHORT" | "HOLD" =
            t.direction === "long"
              ? "LONG"
              : t.direction === "short"
              ? "SHORT"
              : "HOLD";

          let hitStatus: "TARGET ✅" | "STOP ❌" | "ACTIVE" = "ACTIVE";

          if (t.entryPrice !== undefined && t.stopLoss !== undefined) {
            if (
              (displaySignal === "LONG" && t.entryPrice <= t.stopLoss) ||
              (displaySignal === "SHORT" && t.entryPrice >= t.stopLoss)
            ) {
              hitStatus = "STOP ❌";
            }
          }

          if (t.entryPrice !== undefined && t.targets?.length) {
            for (const target of t.targets) {
              if (
                (displaySignal === "LONG" && t.entryPrice >= target) ||
                (displaySignal === "SHORT" && t.entryPrice <= target)
              ) {
                hitStatus = "TARGET ✅";
                break;
              }
            }
          }

          return {
            symbol: t.symbol,
            signal:
              displaySignal === "LONG"
                ? "BUY"
                : displaySignal === "SHORT"
                ? "SELL"
                : "HOLD",
            confidence: t.confidence ?? 0,
            explanation: t.note ?? "",
            price: t.entryPrice ?? undefined,
            type: (t.type as "stock" | "index" | "crypto") ?? "stock", // ✅ force fallback
            support: t.entryPrice ? t.entryPrice * 0.995 : undefined,
            resistance: t.entryPrice ? t.entryPrice * 1.01 : undefined,
            stoploss: t.stopLoss ?? undefined,
            targets: t.targets ?? [],
            hitStatus,
            provider: t.provider ?? "unknown",
          };
        });

        setTrades(normalizedTrades);
      } catch (err) {
        console.error("Error fetching trades:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, [isLoaded, userEmail]);

  if (!isLoaded) return <p>Loading user info…</p>;
  if (!userEmail) return <p>Please log in to see your trades.</p>;

  const liveStocks = trades
    .filter((t) => t.type === "stock" && t.hitStatus === "ACTIVE")
    .slice(0, 3);
  const liveCryptos = trades
    .filter((t) => t.type === "crypto" && t.hitStatus === "ACTIVE")
    .slice(0, 2);
  const liveIndices = trades
    .filter((t) => t.type === "index" && t.hitStatus === "ACTIVE")
    .slice(0, 2);
  const pastStocks = trades
    .filter(
      (t) =>
        t.type === "stock" &&
        (t.hitStatus === "TARGET ✅" || t.hitStatus === "STOP ❌")
    )
    .slice(0, 3);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Your Watchlist</h1>

      {loading ? (
        <p>Loading trades…</p>
      ) : trades.length === 0 ? (
        <p>No trades found for today.</p>
      ) : (
        <div className="space-y-8">
          {/* ---- Live Stocks ---- */}
          {liveStocks.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-2 text-green-700">
                📈 Live Stocks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveStocks.map((trade) => (
                  <div
                    key={trade.symbol}
                    className="transition-transform hover:scale-[1.02]"
                  >
                    <StockCard
  key={trade.symbol}
  {...trade}
  explanation={trade.explanation ?? ""}
  price={trade.price ?? undefined}
  support={trade.support ?? undefined}
  resistance={trade.resistance ?? undefined}
  stoploss={trade.stoploss ?? undefined}
  type={trade.type ?? "stock"} // ✅ always passes a valid "stock" | "index" | "crypto"
 />

                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Live Cryptos ---- */}
          {liveCryptos.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-2 text-purple-700">
                💎 Live Crypto
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveCryptos.map((trade) => (
                  <div
                    key={trade.symbol}
                    className="transition-transform hover:scale-[1.02]"
                  >
                    <StockCard
  key={trade.symbol}
  {...trade}
  explanation={trade.explanation ?? ""}
  price={trade.price ?? undefined}
  support={trade.support ?? undefined}
  resistance={trade.resistance ?? undefined}
  stoploss={trade.stoploss ?? undefined}
  type={trade.type ?? "stock"} // ✅ always passes a valid "stock" | "index" | "crypto"
 />

                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Live Indices ---- */}
          {liveIndices.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-2 text-blue-700">
                🧭 Live Indices
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveIndices.map((trade) => (
                  <div
                    key={trade.symbol}
                    className="transition-transform hover:scale-[1.02]"
                  >
                    <StockCard
  key={trade.symbol}
  {...trade}
  explanation={trade.explanation ?? ""}
  price={trade.price ?? undefined}
  support={trade.support ?? undefined}
  resistance={trade.resistance ?? undefined}
  stoploss={trade.stoploss ?? undefined}
  type={trade.type ?? "stock"} // ✅ always passes a valid "stock" | "index" | "crypto"
 />

                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Past Stocks ---- */}
          {pastStocks.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-2 text-gray-700">
                ⏳ Past Stocks (Target/Stop Hit)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastStocks.map((trade) => (
                  <div
                    key={trade.symbol}
                    className="opacity-70 border border-gray-400 rounded-2xl p-1 bg-gray-200 cursor-not-allowed transition hover:opacity-90"
                  >
                    <StockCard
  key={trade.symbol}
  {...trade}
  explanation={trade.explanation ?? ""}
  price={trade.price ?? undefined}
  support={trade.support ?? undefined}
  resistance={trade.resistance ?? undefined}
  stoploss={trade.stoploss ?? undefined}
  type={trade.type ?? "stock"} // ✅ always passes a valid "stock" | "index" | "crypto"
 />

                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
