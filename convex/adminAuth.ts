import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

export async function requireAdmin(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("You must be signed in to access the admin dashboard.");
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const email = identity.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    throw new Error("You are not authorized to access the admin dashboard.");
  }

  return identity;
}

export async function getAdminIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { authorized: false as const, reason: "signed_out" as const };

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const email = identity.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    return { authorized: false as const, reason: "forbidden" as const };
  }

  return { authorized: true as const, identity };
}
