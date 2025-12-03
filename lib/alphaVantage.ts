// lib/alphaVantage.ts
import axios from "axios";

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "BXLPMWZIQZSNVQXL";
const BASE_URL = "https://www.alphavantage.co/query";

/** Get intraday or daily candles */
export async function fetchCandles(symbol: string) {
  try {
    const url = `${BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${API_KEY}`;
    const r = await axios.get(url, { validateStatus: (s) => s < 500 });
    const data = r.data["Time Series (Daily)"];
    if (!data) throw new Error("No candle data");

    const dates = Object.keys(data).reverse().slice(-100);
    const c = dates.map((d) => parseFloat(data[d]["4. close"]));
    const h = dates.map((d) => parseFloat(data[d]["2. high"]));
    const l = dates.map((d) => parseFloat(data[d]["3. low"]));
    const v = dates.map((d) => parseFloat(data[d]["6. volume"]));

    return { c, h, l, v };
  } catch (err) {
    console.error("AlphaVantage candle error:", err);
    return { c: [], h: [], l: [], v: [] };
  }
}

/** Get latest quote (current price, open, high, low) */
export async function fetchQuote(symbol: string) {
  try {
    const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
    const r = await axios.get(url, { validateStatus: (s) => s < 500 });
    const q = r.data["Global Quote"];
    if (!q) throw new Error("No quote data");

    return {
      c: parseFloat(q["05. price"]),
      o: parseFloat(q["02. open"]),
      h: parseFloat(q["03. high"]),
      l: parseFloat(q["04. low"]),
      pc: parseFloat(q["08. previous close"]),
    };
  } catch (err) {
    console.error("AlphaVantage quote error:", err);
    return {};
  }
}
