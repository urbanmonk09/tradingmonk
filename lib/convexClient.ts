// src/lib/convexClient.ts
"use client";

import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.warn("NEXT_PUBLIC_CONVEX_URL not set — Convex client will not connect.");
}

export const convex = new ConvexReactClient(url ?? "");
