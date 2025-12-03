// ---------------------------------------------
// SMC TYPES
// ---------------------------------------------

// Basic OHLC arrays for any timeframe
export interface TFSeries {
  prices: number[]; // closes
  highs: number[];
  lows: number[];
  opens: number[]; // NEW
}

// Input for the core engine
export interface ComputeSMCInput {
  symbol: string;
  current: number;
  previousClose: number;

  prices: number[];
  highs: number[];
  lows: number[];
  opens: number[]; // NEW
}

// Output of the engine
export interface SMCOutput {
  symbol: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number;
}
