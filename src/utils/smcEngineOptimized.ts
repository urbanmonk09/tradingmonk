import {
  StockData as CoreStockData,
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

export type StockData = CoreStockData;

export type OptimizedSMCResult = {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  baseConfidence: number;
  optimizedConfidence: number;
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
};

export function computeOptimizedSMC(
  stock: StockData,
  base?: { signal?: string; confidence?: number; stoploss?: number; targets?: number[]; explanation?: string }
): OptimizedSMCResult {
  const symbol = stock.symbol ?? "UNKNOWN";

  // --- LIVE price to show in UI
  const livePrice = stock.current ?? stock.previousClose ?? 0;

  // --- FIXED price for SL/Targets
  const entryPrice = stock.previousClose ?? livePrice;

  const prices = stock.prices ?? [];
  const highs = stock.highs ?? [];
  const lows = stock.lows ?? [];
  const volumes = stock.volumes ?? [];

  // Indicators
  const sma20 = calculateSMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const rsi = calculateRSI(prices, 14);
  const changePercent = entryPrice !== 0 ? ((livePrice - entryPrice) / entryPrice) * 100 : 0;

  const hasFVG = detectFairValueGap(highs, lows);
  const orderBlock = detectOrderBlock(prices);
  const volumeSurge = detectVolumeSurge(volumes);
  const liquiditySweep = detectLiquiditySweep(highs, lows, livePrice);
  const bos = detectBOS(highs, lows);
  const choch = detectCHoCH(highs, lows);
  const mitigation = detectMitigationBlock(prices);
  const breaker = detectBreakerBlock(prices);

  // Scoring
  let score = 0;
  const reasons: string[] = [];

  if (livePrice > sma20) { score += 8; reasons.push("Price above SMA20 (+8)"); } else { score -= 4; reasons.push("Price below SMA20 (-4)"); }
  if (livePrice > ema50) { score += 8; reasons.push("Price above EMA50 (+8)"); } else { score -= 4; reasons.push("Price below EMA50 (-4)"); }

  if (rsi < 30) { score += 6; reasons.push(`RSI ${rsi.toFixed(1)} (oversold) (+6)`); }
  else if (rsi > 70) { score -= 6; reasons.push(`RSI ${rsi.toFixed(1)} (overbought) (-6)`); }
  else { reasons.push(`RSI ${rsi.toFixed(1)} (neutral) (+0)`); }

  if (changePercent > 0.2) { score += 4; reasons.push(`Positive change ${changePercent.toFixed(2)}% (+4)`); }
  else if (changePercent < -0.2) { score -= 4; reasons.push(`Negative change ${changePercent.toFixed(2)}% (-4)`); }

  if (bos === "BULLISH") { score += 10; reasons.push("BOS bullish (+10)"); }
  if (bos === "BEARISH") { score -= 10; reasons.push("BOS bearish (-10)"); }

  if (choch === "BULLISH") { score += 8; reasons.push("CHOCH bullish (+8)"); }
  if (choch === "BEARISH") { score -= 8; reasons.push("CHOCH bearish (-8)"); }

  if (orderBlock === "BULLISH") { score += 6; reasons.push("Order block bullish (+6)"); }
  if (orderBlock === "BEARISH") { score -= 6; reasons.push("Order block bearish (-6)"); }
  if (mitigation === "BULLISH") { score += 5; reasons.push("Mitigation block bullish (+5)"); }
  if (mitigation === "BEARISH") { score -= 5; reasons.push("Mitigation block bearish (-5)"); }
  if (breaker === "BULLISH") { score += 4; reasons.push("Breaker bullish (+4)"); }
  if (breaker === "BEARISH") { score -= 4; reasons.push("Breaker bearish (-4)"); }

  if (hasFVG) { score += 3; reasons.push("Fair Value Gap detected (+3)"); }
  if (volumeSurge) { score += 5; reasons.push("Volume surge (+5)"); }
  if (liquiditySweep === "BULLISH") { score += 5; reasons.push("Liquidity sweep bullish (+5)"); }
  if (liquiditySweep === "BEARISH") { score -= 5; reasons.push("Liquidity sweep bearish (-5)"); }

  const baseConfidence = base?.confidence ?? 50;
  const rawOptimized = Math.max(0, Math.min(100, Math.round(baseConfidence * 0.35 + (50 + score * 1.8) * 0.65)));
  const optimizedConfidence = Math.max(0, Math.min(100, rawOptimized));

  let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (optimizedConfidence >= 65 && (bos === "BULLISH" || choch === "BULLISH" || livePrice > sma20 && livePrice > ema50)) {
    signal = "BUY";
    reasons.unshift("Optimized engine suggests BUY");
  } else if (optimizedConfidence >= 65 && (bos === "BEARISH" || choch === "BEARISH" || livePrice < sma20 && livePrice < ema50)) {
    signal = "SELL";
    reasons.unshift("Optimized engine suggests SELL");
  } else {
    reasons.unshift("Market indecisive (HOLD). Waiting for BOS/CHOCH confirmation.");
  }

  // Fixed SL/Targets using previous close (entryPrice)
  let stoploss = 0;
  let targets: number[] = [];
  if (signal === "BUY") {
    stoploss = entryPrice * 0.9922;
    targets = [entryPrice * 1.01, entryPrice * 1.01216, entryPrice * 1.01618];
  } else if (signal === "SELL") {
    stoploss = entryPrice * 1.0078;
    targets = [entryPrice * 0.99, entryPrice * 0.98784, entryPrice * 0.98382];
  }

  return {
    symbol,
    signal,
    baseConfidence,
    optimizedConfidence,
    reasons,
    indicators: {
      sma20: isFinite(sma20) ? +sma20 : undefined,
      ema50: isFinite(ema50) ? +ema50 : undefined,
      rsi: isFinite(rsi) ? +rsi : undefined,
      changePercent: +changePercent,
      hasFVG: !!hasFVG,
      orderBlock,
      volumeSurge: !!volumeSurge,
      liquiditySweep,
      bos,
      choch,
      mitigation,
      breaker,
    },
    stoploss,
    targets,
    entryPrice,
    
  };
}
