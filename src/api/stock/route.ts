import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const provider = searchParams.get("provider") || "finnhub";

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  try {
    if (provider === "finnhub") {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
      const res = await axios.get(url, { timeout: 8000 });
      const data = res.data;

      return NextResponse.json({
        symbol,
        current: data.c ?? null,
        high: data.h ?? null,
        low: data.l ?? null,
        open: data.o ?? null,
        previousClose: data.pc ?? null,
        prices: [],
        highs: [],
        lows: [],
        volumes: [],
        lastUpdated: Date.now(),
        source: "finnhub",
      });
    } else {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
      const res = await axios.get(url, { timeout: 8000 });
      const result = res.data.chart.result[0];
      const meta = result.meta;
      const indicators = result.indicators?.quote?.[0] ?? {};

      return NextResponse.json({
        symbol,
        current: meta.regularMarketPrice ?? null,
        high: meta.chartHigh ?? null,
        low: meta.chartLow ?? null,
        open: meta.chartOpen ?? null,
        previousClose: meta.chartPreviousClose ?? null,
        prices: indicators.close ?? [],
        highs: indicators.high ?? [],
        lows: indicators.low ?? [],
        volumes: indicators.volume ?? [],
        lastUpdated: Date.now(),
        source: "yahoo",
      });
    }
  } catch (err) {
    console.warn("fetchStockData API route failed", symbol, err);
    return NextResponse.json({
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
    });
  }
}
