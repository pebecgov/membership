import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

type ClerkUserData = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: { email_address: string }[];
};

export const current = query({
  args: {},
  handler: async (ctx) => getCurrentUser(ctx),
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const clerkUser = data as ClerkUserData;
    const name =
      [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || "User";
    const email = clerkUser.email_addresses?.[0]?.email_address;

    const userAttributes = {
      name,
      email,
      externalId: clerkUser.id,
    };

    const user = await userByExternalId(ctx, clerkUser.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await userByExternalId(ctx, clerkUserId);
    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(`Can't delete user, there is none for Clerk user ID: ${clerkUserId}`);
    }
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
