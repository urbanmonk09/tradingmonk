import axios from "axios";

export interface StockData {
  symbol: string;
  current: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  lastUpdated: number;
  source?: "finnhub" | "yahoo" | "unknown";
}

// Fallback-aware fetch
export async function fetchStockData(
  symbol: string,
  provider: "finnhub" | "yahoo" = "finnhub"
): Promise<StockData> {
  try {
    const url = `/api/stock?symbol=${encodeURIComponent(symbol)}&provider=${provider}`;
    const res = await axios.get(url);
    const data = res.data as StockData;

    // Fallback logic for closed markets or missing data
    const currentPrice = data.current ?? data.previousClose ?? 0;

    return {
      ...data,
      current: currentPrice,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    console.warn("fetchStockData failed", symbol, err);
    return {
      symbol,
      current: 0,
      high: null,
      low: null,
      open: null,
      previousClose: null,
      prices: [],
      highs: [],
      lows: [],
      volumes: [],
      lastUpdated: Date.now(),
      source: "unknown",
    };
  }
}
