import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a trade (one document per signal event)
export const saveTrade = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("trades", args);
  },
});

// Get all user trades for today
export const getUserTrades = query({
  args: { userEmail: v.string() },
  handler: async (ctx, { userEmail }) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_userEmail", (q) => q.eq("userEmail", userEmail))
      .collect();
  },
});

// Update trade status (target hit / stoploss hit)
export const updateTradeStatus = mutation({
  args: {
    tradeId: v.id("trades"),
    status: v.union(
      v.literal("active"),
      v.literal("target_hit"),
      v.literal("stopped_out")
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { tradeId, status, note }) => {
    await ctx.db.patch(tradeId, { status, note });
  },
});

export const getDailyTrades = query({
  args: { email: v.string(), since: v.number() },
  handler: async (ctx, { email, since }) => {
    return await ctx.db
      .query("trades")
      .filter(q =>
        q.and(
          q.eq(q.field("userEmail"), email),
          q.gte(q.field("timestamp"), since)
        )
      )
      .collect();
  },
});