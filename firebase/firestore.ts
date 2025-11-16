// /firebase/firestore.ts
import { db } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

// Save trade
export const saveTrade = async (userEmail: string, trade: any) => {
  const ref = doc(collection(db, "users", userEmail, "trades"));
  return setDoc(ref, trade, { merge: true });
};

// Get trades
export const getTrades = async (userEmail: string) => {
  const ref = collection(db, "users", userEmail, "trades");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Save watchlist symbol
export const saveWatchlistItem = async (userEmail: string, symbol: string) => {
  const ref = doc(db, "users", userEmail, "watchlist", symbol);
  return setDoc(ref, { symbol });
};

// Get watchlist
export const getWatchlist = async (userEmail: string) => {
  const ref = collection(db, "users", userEmail, "watchlist");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => d.id);
};

// Remove watchlist item
export const removeWatchlistItem = async (userEmail: string, symbol: string) => {
  const ref = doc(db, "users", userEmail, "watchlist", symbol);
  return deleteDoc(ref);
};
