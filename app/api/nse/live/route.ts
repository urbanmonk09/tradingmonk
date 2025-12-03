// app/api/nse/live/route.ts
import { NextResponse } from "next/server";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 10 });

// NSE headers needed to prevent 401/403
const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nseindia.com/",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "X-Requested-With": "XMLHttpRequest",
};

// Detect indices
function isIndex(symbol: string) {
  const s = symbol.replace(/\s+/g, "").toUpperCase();
  return ["NIFTY50", "NIFTYBANK", "FINNIFTY"].includes(s);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let symbol = searchParams.get("symbol");

    if (!symbol)
      return NextResponse.json({ error: "Symbol required" }, { status: 400 });

    symbol = decodeURIComponent(symbol.trim().toUpperCase());
    const cacheKey = `nse:${symbol}`;

    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    /* ---------------- INDEX HANDLER ---------------- */
    if (isIndex(symbol)) {
      const indexName = symbol.replace(/\s+/g, " "); // normalize spaces

      const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(
        indexName
      )}`;

      // Initial request for cookies
      await fetch("https://www.nseindia.com", { headers: NSE_HEADERS });

      const res = await fetch(url, {
        headers: NSE_HEADERS,
        cache: "no-store",
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `NSE returned ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const item = data?.data?.[0];

      const response = {
        symbol: indexName,
        price:
          item?.last ??
          item?.lastPrice ??
          item?.close ??
          0,
        open: item?.open ?? null,
        high: item?.dayHigh ?? null,
        low: item?.dayLow ?? null,
        prevClose: item?.previousClose ?? null,
        change: item?.change ?? item?.netChange ?? null,
        pChange:
          item?.perChange ??
          item?.percentChange ??
          null,
        volume: item?.totalTradedVolume ?? null,
        value: item?.totalTradedValue ?? null,
        timestamp: Date.now(),
      };

      cache.set(cacheKey, response);
      return NextResponse.json(response);
    }

    /* ---------------- STOCK HANDLER ---------------- */
    // Pre-fetch cookies
    await fetch("https://www.nseindia.com", { headers: NSE_HEADERS });

    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(
      symbol
    )}`;

    const res = await fetch(url, {
      headers: NSE_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `NSE returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const priceInfo = data?.priceInfo ?? {};

    const response = {
      symbol,
      price:
        priceInfo?.lastPrice ??
        data?.lastPrice ??
        0,
      open: priceInfo?.open ?? null,
      high: priceInfo?.intraDayHighLow?.max ?? priceInfo?.high ?? null,
      low: priceInfo?.intraDayHighLow?.min ?? priceInfo?.low ?? null,
      prevClose:
        priceInfo?.previousClose ??
        priceInfo?.pClose ??
        null,
      change: priceInfo?.change ?? null,
      pChange: priceInfo?.pChange ?? null,
      volume: data?.securityInfo?.totalTradedVolume ?? null,
      value: data?.securityInfo?.totalTradedValue ?? null,
      timestamp: Date.now(),
    };

    cache.set(cacheKey, response);
    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: "NSE API failed", details: String(err) },
      { status: 500 }
    );
  }
}
