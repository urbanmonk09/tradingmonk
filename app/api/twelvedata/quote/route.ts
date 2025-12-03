// app/api/twelvedata/quote/route.ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

const API_KEY = process.env.TWELVEDATA_API_KEY;
const CACHE = new Map<string, { ts: number; data: any }>();
const THROTTLE_MS = 30_000; // 30 sec
const TIMEOUT_MS = 12_000;  // 12 sec
const RETRIES = 3;

const agent = new https.Agent({ minVersion: "TLSv1.2" });

async function safeFetch(url: string): Promise<any> {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const response = await axios.get(url, {
        httpsAgent: agent,
        timeout: TIMEOUT_MS,
      });
      return response.data;
    } catch (err) {
      if (attempt === RETRIES - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol parameter is required" }, { status: 400 });

  const now = Date.now();
  const cached = CACHE.get(symbol);
  if (cached && now - cached.ts < THROTTLE_MS) return NextResponse.json(cached.data);

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
    const data = await safeFetch(url);

    if (data.status === "error" || data.code) {
      return NextResponse.json({ error: "Twelvedata API error", details: data }, { status: 500 });
    }

    const stockData = {
      symbol: data.symbol,
      current: parseFloat(data.close),
      previousClose: parseFloat(data.previous_close),
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      volume: parseInt(data.volume, 10),
      fiftyTwoWeek: {
        low: parseFloat(data.fifty_two_week.low),
        high: parseFloat(data.fifty_two_week.high),
        lowChange: parseFloat(data.fifty_two_week.low_change),
        highChange: parseFloat(data.fifty_two_week.high_change),
        lowChangePercent: parseFloat(data.fifty_two_week.low_change_percent),
        highChangePercent: parseFloat(data.fifty_two_week.high_change_percent),
      },
    };

    CACHE.set(symbol, { ts: Date.now(), data: stockData });
    return NextResponse.json(stockData);
  } catch (err) {
    console.error("[TwelveData] fetch failed:", err);
    return NextResponse.json({ error: "Internal server error", details: err }, { status: 500 });
  }
}
