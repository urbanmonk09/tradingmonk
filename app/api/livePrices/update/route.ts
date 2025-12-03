// app/api/livePrices/update/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";
import * as admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      symbol,
      price,
      timestamp,
      exchange,
      signal,
      indicators,
      reasons,
      stoploss,
      targets,
    } = body;

    if (!symbol || price === undefined || price === null) {
      return NextResponse.json(
        { error: "Missing symbol or price" },
        { status: 400 }
      );
    }

    const ts = timestamp ?? Date.now();

    // ---------------------------
    // 1. UPDATE LIVE PRICE DOC
    // ---------------------------
    await adminDb
      .collection("livePrices")
      .doc(symbol)
      .set(
        {
          symbol,
          price,
          timestamp: ts,
          exchange: exchange ?? "unknown",
          signal: signal ?? "HOLD",
          indicators: indicators ?? {},
          reasons: reasons ?? [],
          stoploss: stoploss ?? null,
          targets: targets ?? [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    // ---------------------------
    // 2. APPEND TICK HISTORY
    // ---------------------------
    await adminDb
      .collection("livePrices")
      .doc(symbol)
      .collection("ticks")
      .doc(ts.toString())
      .set({
        price,
        timestamp: ts,
        signal: signal ?? "HOLD",
        indicators: indicators ?? {},
        reasons: reasons ?? [],
        stoploss: stoploss ?? null,
        targets: targets ?? [],
      });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error updating live price:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
