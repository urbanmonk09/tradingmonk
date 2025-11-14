import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a trade (one document per signal event)
export const saveTrade = mutation({
  args: {
    userEmail: v.string(),
    symbol: v.string(),
    direction: v.string(),
    entryPrice: v.number(),
    stopLoss: v.optional(v.number()),
    targets: v.optional(v.array(v.number())),
    confidence: v.number(),
    status: v.string(),
    provider: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("trades", { ...args, timestamp: Date.now() });
  },
});

// Get all user trades for today
export const getUserTrades = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const since = startOfDay.getTime();

    return await ctx.db
      .query("trades")
      .filter((q) =>
        q.and(
          q.eq(q.field("userEmail"), email),
          q.gte(q.field("timestamp"), since)
        )
      )
      .collect();
  },
});

// Update trade status (target hit / stoploss hit)
export const updateTradeStatus = mutation({
  args: { tradeId: v.id("trades"), status: v.string(), note: v.optional(v.string()) },
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
