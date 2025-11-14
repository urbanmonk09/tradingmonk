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
    type: v.union(v.literal("stock"), v.literal("index"), v.literal("crypto")),
    direction: v.union(v.literal("long"), v.literal("short")),
    entryPrice: v.number(),
    stopLoss: v.optional(v.number()),
    targets: v.optional(v.array(v.number())),
    confidence: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("target_hit"),
      v.literal("stopped_out")
    ),
    provider: v.optional(v.string()),
    timestamp: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_userEmail", ["userEmail"]),
});