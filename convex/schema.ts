// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    isPro: v.boolean(),
    createdAt: v.number(),
  }),

  trades: defineTable({
    userEmail: v.string(),
    symbol: v.string(),
    direction: v.string(), // "long" or "short"
    entryPrice: v.number(),
    stopLoss: v.optional(v.number()),
    targets: v.optional(v.array(v.number())),
    confidence: v.number(),
    status: v.string(), // "active" | "target_hit" | "stopped_out"
    provider: v.optional(v.string()), // "finnhub" or "yahoo"
    timestamp: v.number(),
    note: v.optional(v.string()),
  }),
});
