// src/utils/indicatorUtils.ts

export function calculateSMA(data: number[], period: number): number | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length < period) return data[data.length - 1] ?? null;
  const slice = data.slice(-period);
  let sum = 0;
  for (let i = 0; i < slice.length; i++) sum += slice[i];
  return sum / slice.length;
}

export function calculateEMA(data: number[], period: number): number | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length < period) return data[data.length - 1] ?? null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateRSI(data: number[], period = 14): number | null {
  if (!Array.isArray(data) || data.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const diff = data[i] - (data[i - 1] ?? data[i]);
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateVWAP(candles: { h: number; l: number; c: number; v?: number }[]): number | null {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const t = (candles[i].h + candles[i].l + candles[i].c) / 3;
    const v = candles[i].v ?? 1;
    pv += t * v;
    vol += v;
  }
  if (vol === 0) return null;
  return pv / vol;
}
