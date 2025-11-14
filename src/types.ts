// src/types.ts
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
  signal?: "BUY" | "SELL" | "HOLD";
  hitStatus?: "active" | "target_hit" | "stopped_out";
};
