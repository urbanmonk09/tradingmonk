// src/utils/priceUtils.ts
export function extractLivePrice(json: any): { current: number; previousClose: number; prices: number[] } {
  const pricesArr = Array.isArray(json.raw?.prices) && json.raw.prices.length ? [...json.raw.prices] : [];
  const prevClose = typeof json.raw?.previousClose === "number" ? json.raw.previousClose : 0;

  let current = 0;

  if (typeof json.ltp === "number") {
    current = json.ltp;
  } else if (pricesArr.length > 0) {
    current = pricesArr[pricesArr.length - 1];
  } else {
    current = prevClose;
  }

  return { current, previousClose: prevClose, prices: pricesArr.length ? pricesArr : [current] };
}
