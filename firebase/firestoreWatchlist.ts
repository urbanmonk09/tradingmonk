// /firebase/firestoreWatchlist.ts
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export const addToWatchlist = async (
  userEmail: string,
  symbol: string,
  type: "stock" | "crypto" | "index"
) => {
  try {
    await addDoc(collection(db, "watchlist"), {
      userEmail,
      symbol,
      type,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    console.error("Error saving watchlist symbol:", err);
  }
};

export const getUserWatchlist = async (userEmail: string) => {
  try {
    const q = query(
      collection(db, "watchlist"),
      where("userEmail", "==", userEmail)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error loading watchlist:", err);
    return [];
  }
};

export const removeFromWatchlist = async (id: string) => {
  try {
    await deleteDoc(doc(db, "watchlist", id));
  } catch (err) {
    console.error("Error removing watchlist item:", err);
  }
};
