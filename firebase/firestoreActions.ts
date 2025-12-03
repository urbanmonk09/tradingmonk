// /firebase/firestoreActions.ts
import { db } from "./firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export const saveTradeToFirestore = async (trade: any) => {
  try {
    await addDoc(collection(db, "trades"), {
      ...trade,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    console.error("Error saving trade:", err);
  }
};

export const getUserTrades = async (userEmail: string) => {
  try {
    const q = query(
      collection(db, "trades"),
      where("userEmail", "==", userEmail)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error loading trades:", err);
    return [];
  }
};
