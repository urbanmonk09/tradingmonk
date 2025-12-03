// app/api/finnhub/quote/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import https from "https";

const API_KEY = process.env.FINNHUB_API_KEY;
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
      await new Promise((r) => setTimeout(r, 500)); // small delay between retries
    }
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

    const now = Date.now();
    const cached = CACHE.get(symbol);
    if (cached && now - cached.ts < THROTTLE_MS) return NextResponse.json(cached.data);

    const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
    const data = await safeFetch(apiUrl);

    CACHE.set(symbol, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[Finnhub] fetch failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
