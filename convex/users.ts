import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getUser = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
  },
});

export const createOrEnsureUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (!existing) {
      await ctx.db.insert("users", {
        email,
        isPro: false,
        createdAt: Date.now(),
      });
    }
  },
});

export const upgradeToPro = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const u = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (u) {
      await ctx.db.patch(u._id, { isPro: true });
    }
  },
});
