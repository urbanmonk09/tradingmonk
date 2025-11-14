"use client";

import React, { useContext } from "react";
import StockCard from "../../src/components/StockCard";
import { AuthContext } from "../../src/context/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api"; // ✅ use auto-generated api

// Type for each trade in the watchlist
export type WatchlistItem = {
  _id: string;
  symbol: string;
  type: "stock" | "index" | "crypto";
  direction: "long" | "short";
  entryPrice: number;
  stopLoss?: number;
  targets?: number[];
  confidence: number;
  note?: string;
  status: "active" | "target_hit" | "stopped_out";
  signal: "BUY" | "SELL" | "HOLD";
  hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌";
};

export default function Watchlist() {
  const { user } = useContext(AuthContext);

  // Redirect if not logged in
  if (!user) return null;

  // Get email from user — cast to any if TS type doesn't include it
  const userEmail = (user as any).email ?? "";

  // ✅ Correct useQuery call
  const trades = useQuery(api.trades.getUserTrades, { userEmail }) ?? [];

  // Map backend trade status to UI hitStatus
  const mapStatusToHitStatus = (status: "active" | "target_hit" | "stopped_out"): WatchlistItem["hitStatus"] => {
    switch (status) {
      case "active":
        return "ACTIVE";
      case "target_hit":
        return "TARGET ✅";
      case "stopped_out":
        return "STOP ❌";
      default:
        return "ACTIVE";
    }
  };

  // Normalize trades for WatchlistItem
  const normalizedTrades: WatchlistItem[] = trades.map((t: any) => ({
    _id: t._id,
    symbol: t.symbol,
    type: t.type,
    direction: t.direction,
    entryPrice: t.entryPrice,
    stopLoss: t.stopLoss,
    targets: t.targets,
    confidence: t.confidence,
    note: t.note,
    status: t.status,
    signal: t.direction === "long" ? "BUY" : t.direction === "short" ? "SELL" : "HOLD",
    hitStatus: mapStatusToHitStatus(t.status),
  }));

  // Sort by confidence descending
  const sortedTrades = [...normalizedTrades].sort((a, b) => b.confidence - a.confidence);

  // Skip top-1 per type (already shown on Home)
  const seen: Record<string, boolean> = {};
  const filteredTrades = sortedTrades.filter((t) => {
    if (!seen[t.type]) {
      seen[t.type] = true;
      return false; // skip first record of each type
    }
    return true;
  });

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-xl font-semibold mb-2">💼 Pro Members Watchlist</h2>
      <p className="text-gray-600 mb-4">All other high-quality trades ranked by confidence</p>

      {filteredTrades.length === 0 ? (
        <p>No trades yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrades.map((t) => (
            <StockCard
              key={t._id}
              symbol={t.symbol}
              type={t.type}
              signal={t.signal}
              confidence={t.confidence}
              explanation={t.note ?? ""}
              price={t.entryPrice}
              stoploss={t.stopLoss}
              targets={t.targets}
              support={undefined}
              resistance={undefined}
              hitStatus={t.hitStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
