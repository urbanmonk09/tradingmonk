import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { symbol, provider } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    if (provider === "finnhub") {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
      const response = await axios.get(url as string);
      const data = response.data;
      res.status(200).json({
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
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const response = await axios.get(url as string);
      const result = response.data.chart.result[0];
      const meta = result.meta;
      const indicators = result.indicators?.quote?.[0] ?? {};
      res.status(200).json({
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
    console.error(err);
    res.status(500).json({
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
