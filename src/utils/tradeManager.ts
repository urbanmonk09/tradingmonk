// src/utils/tradeManager.ts
import { SignalResult } from "./xaiLogic";

export type TradeResult = SignalResult & { symbol: string };

// -------------------------------
// Browser localStorage keys
// -------------------------------
const STORAGE_KEY = "tradeHistory";

// -------------------------------
// Load trade history from localStorage
// -------------------------------
export async function loadTradeHistory(): Promise<TradeResult[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TradeResult[];
  } catch (e) {
    console.warn("Failed to load trade history", e);
    return [];
  }
}

// -------------------------------
// Save trade history to localStorage
// -------------------------------
export async function saveTradeHistory(trades: TradeResult[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (e) {
    console.warn("Failed to save trade history", e);
  }
}

// -------------------------------
// Map SMC signal to TradeResult
// -------------------------------
export function signalToTradeResult(signal: SignalResult, symbol: string): TradeResult {
  return { ...signal, symbol };
}
