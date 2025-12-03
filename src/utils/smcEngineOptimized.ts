// src/utils/smcEngineOptimized.ts
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  detectFairValueGap,
  detectOrderBlock,
  detectVolumeSurge,
  detectLiquiditySweep,
  detectMitigationBlock,
  detectBreakerBlock,
  detectBOS,
  detectCHoCH,
} from "@/src/utils/xaiLogic";

export interface StockData {
  symbol: string;
  current?: number;
  previousClose?: number;
  entryPrice?: number;
  open?: number;
  high?: number;
  low?: number;
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  timeframe?: string; // e.g., '5m', '15m', etc.
}

export interface OptimizedSMCResult {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  baseConfidence: number;
  optimizedConfidence: number;
  bestTimeframe: string;
  reasons: string[];
  indicators: {
    sma20?: number;
    ema50?: number;
    rsi?: number;
    changePercent?: number;
    hasFVG?: boolean;
    orderBlock?: "BULLISH" | "BEARISH" | null;
    volumeSurge?: boolean;
    liquiditySweep?: "BULLISH" | "BEARISH" | null;
    bos?: "BULLISH" | "BEARISH" | null;
    choch?: "BULLISH" | "BEARISH" | null;
    mitigation?: "BULLISH" | "BEARISH" | null;
    breaker?: "BULLISH" | "BEARISH" | null;
  };
  stoploss: number;
  targets: number[];
  entryPrice?: number;
}

/**
 * Compute SMC signal for a single timeframe
 */
function computeSMCForTimeframe(stock: StockData): { signal: "BUY" | "SELL" | "HOLD"; confidence: number; indicators: any; reasons: string[] } {
  const prices = stock.prices ?? [];
  const highs = stock.highs ?? [];
  const lows = stock.lows ?? [];
  const volumes = stock.volumes ?? [];
  const current = stock.current ?? (stock.previousClose ?? (prices[prices.length - 1] ?? 0));

  const sma20 = calculateSMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const rsi = calculateRSI(prices, 14);
  const changePercent = stock.previousClose ? ((current - stock.previousClose) / stock.previousClose) * 100 : 0;

  const hasFVG = detectFairValueGap(highs, lows);
  const orderBlock = detectOrderBlock(prices);
  const volumeSurge = detectVolumeSurge(volumes);
  const liquiditySweep = detectLiquiditySweep(highs, lows, current);
  const bos = detectBOS(highs, lows);
  const choch = detectCHoCH(highs, lows);
  const mitigation = detectMitigationBlock(prices);
  const breaker = detectBreakerBlock(prices);

  let score = 50;
  const reasons: string[] = [];

  // SMA20
  if (Number.isFinite(sma20)) score += current > sma20 ? 8 : -4;
  reasons.push(`SMA20: ${sma20.toFixed(2)}`);

  // EMA50
  if (Number.isFinite(ema50)) score += current > ema50 ? 8 : -4;
  reasons.push(`EMA50: ${ema50.toFixed(2)}`);

  // RSI
  if (Number.isFinite(rsi)) {
    if (rsi < 30) score += 6;
    else if (rsi > 70) score -= 6;
    reasons.push(`RSI: ${rsi.toFixed(1)}`);
  }

  // BOS/CHOCH/Blocks
  if (bos === "BULLISH") score += 10;
  else if (bos === "BEARISH") score -= 10;
  if (choch === "BULLISH") score += 8;
  else if (choch === "BEARISH") score -= 8;
  if (orderBlock === "BULLISH") score += 6;
  else if (orderBlock === "BEARISH") score -= 6;
  if (mitigation === "BULLISH") score += 5;
  else if (mitigation === "BEARISH") score -= 5;
  if (breaker === "BULLISH") score += 4;
  else if (breaker === "BEARISH") score -= 4;
  if (hasFVG) score += 3;
  if (volumeSurge) score += 5;
  if (liquiditySweep === "BULLISH") score += 5;
  else if (liquiditySweep === "BEARISH") score -= 5;

  const signal: "BUY" | "SELL" | "HOLD" =
    score >= 65 ? "BUY" : score <= 35 ? "SELL" : "HOLD";

  const indicators = { sma20, ema50, rsi, changePercent, hasFVG, orderBlock, volumeSurge, liquiditySweep, bos, choch, mitigation, breaker };
  return { signal, confidence: Math.min(Math.max(score, 0), 100), indicators, reasons };
}

/**
 * Compute SMC across multiple timeframes
 */
export function computeMultiTimeframeSMC(stock: StockData, timeframes: string[] = ["5m","15m","30m","1h","2h","4h","1d"]): OptimizedSMCResult {
  let best: { signal: "BUY" | "SELL" | "HOLD"; confidence: number; timeframe: string; indicators: any; reasons: string[] } = {
    signal: "HOLD",
    confidence: 0,
    timeframe: "N/A",
    indicators: {},
    reasons: [],
  };

  for (const tf of timeframes) {
    // Assume prices/highs/lows/volumes for timeframe are already filled in stock object externally
    const result = computeSMCForTimeframe({ ...stock, timeframe: tf });
    if (result.confidence > best.confidence) {
      best = { ...result, timeframe: tf };
    }
  }

  // Stoploss and targets
  const entryPrice = stock.current ?? stock.previousClose ?? stock.prices[stock.prices.length - 1];
  let stoploss = entryPrice;
  let targets: number[] = [entryPrice];
  if (best.signal === "BUY") stoploss = entryPrice * 0.9922, targets = [entryPrice * 1.01, entryPrice * 1.01216, entryPrice * 1.01618];
  else if (best.signal === "SELL") stoploss = entryPrice * 1.0078, targets = [entryPrice * 0.99, entryPrice * 0.98784, entryPrice * 0.98382];

  return {
    symbol: stock.symbol,
    signal: best.signal,
    baseConfidence: 50,
    optimizedConfidence: best.confidence,
    bestTimeframe: best.timeframe,
    reasons: best.reasons,
    indicators: best.indicators,
    stoploss,
    targets,
    entryPrice,
  };
}
