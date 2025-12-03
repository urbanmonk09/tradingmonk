// src/api/symbols.ts
export type SymbolType = "stock" | "index" | "crypto";

export interface WatchItem {
  symbol: string;
  type: SymbolType;
}

// 🎯 Correct TwelveData-compatible symbols

export const symbols: WatchItem[] = [
  // -------------------------------
  // 📈 INDICES (Correct TwelveData)
  // ------------------------------- 
   { type: "index", symbol: "NIFTY 50" },
  { type: "index", symbol: "NIFTY BANK" },
  { type: "index", symbol: "NIFTY IT" },
  { type: "index", symbol: "FINNIFTY" },
  { type: "index", symbol: "NIFTY PHARMA" },
  { type: "index", symbol: "NIFTY FMCG" },
  { type: "index", symbol: "NIFTY AUTO" },

  // -------------------------------
  // 🏦 STOCKS (No NSE: prefix)
  // -------------------------------
  { type: "stock", symbol: "RELIANCE" },
  { type: "stock", symbol: "TCS" },
  { type: "stock", symbol: "INFY" },
  { type: "stock", symbol: "HDFCBANK" },
  { type: "stock", symbol: "ICICIBANK" },
  { type: "stock", symbol: "SBIN" },
  { type: "stock", symbol: "ITC" },
  { type: "stock", symbol: "LT" },
  { type: "stock", symbol: "TATAMOTORS" },
  { type: "stock", symbol: "TATASTEEL" },
  { type: "stock", symbol: "HCLTECH" },
  { type: "stock", symbol: "WIPRO" },
  { type: "stock", symbol: "ADANIENT" },
  { type: "stock", symbol: "POWERGRID" },
  { type: "stock", symbol: "ONGC" },
  { type: "stock", symbol: "COALINDIA" },
  { type: "stock", symbol: "HDFCLIFE" },

  // -------------------------------
  // 💎 CRYPTO (Finnhub)
  // -------------------------------
  { type: "crypto", symbol: "BINANCE:BTCUSDT" },
  { type: "crypto", symbol: "BINANCE:ETHUSDT" },
  { type: "crypto", symbol: "BINANCE:SOLUSDT" },
  { type: "crypto", symbol: "BINANCE:XRPUSDT" },
  { type: "crypto", symbol: "BINANCE:ADAUSDT" },
  { type: "crypto", symbol: "BINANCE:DOGEUSDT" },
  { type: "crypto", symbol: "BINANCE:MATICUSDT" },
  { type: "crypto", symbol: "BINANCE:AVAXUSDT" },
  { type: "crypto", symbol: "BINANCE:DOTUSDT" },
  { type: "crypto", symbol: "BINANCE:LTCUSDT" }
];
