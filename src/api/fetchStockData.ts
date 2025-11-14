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

export async function fetchStockData(
  symbol: string,
  provider: "finnhub" | "yahoo" = "finnhub"
): Promise<StockData> {
  try {
    const url = `/api/stock?symbol=${encodeURIComponent(symbol)}&provider=${provider}`;
    const res = await axios.get(url);
    return res.data as StockData;
  } catch (err) {
    console.warn("fetchStockData failed", symbol, err);
    return {
      symbol,
      current: null,
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
