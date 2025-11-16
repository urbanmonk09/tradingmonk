// /firebase/watchlistTypes.ts

export interface WatchlistItem {
  id: string;
  userEmail: string;
  symbol: string;
  type: "stock" | "crypto" | "index";
  createdAt: any;
}
