import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

export type PortalRole = "admin" | "viewer";

function parseEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getPortalAccess(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return { authorized: false as const, reason: "signed_out" as const };
  }

  const email = identity.email?.toLowerCase();
  if (!email) {
    return { authorized: false as const, reason: "forbidden" as const };
  }

  const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
  const viewerEmails = parseEmailList(process.env.VIEWER_EMAILS);

  if (adminEmails.includes(email)) {
    return { authorized: true as const, role: "admin" as const, identity };
  }

  if (viewerEmails.includes(email)) {
    return { authorized: true as const, role: "viewer" as const, identity };
  }

  return { authorized: false as const, reason: "forbidden" as const };
}

export async function requireAdmin(ctx: AuthCtx) {
  const access = await getPortalAccess(ctx);
  if (!access.authorized) {
    throw new Error("You must be signed in as an admin.");
  }
  if (access.role !== "admin") {
    throw new Error("You are not authorized to perform this action.");
  }
  return access.identity;
}

export async function requirePortalAccess(ctx: AuthCtx) {
  const access = await getPortalAccess(ctx);
  if (!access.authorized) {
    throw new Error("You are not authorized to access the portal.");
  }
  return access;
}

/** @deprecated Use getPortalAccess */
export async function getAdminIdentity(ctx: AuthCtx) {
  const access = await getPortalAccess(ctx);
  if (!access.authorized) {
    return { authorized: false as const, reason: access.reason };
  }
  if (access.role !== "admin") {
    return { authorized: false as const, reason: "forbidden" as const };
  }
  return { authorized: true as const, identity: access.identity };
}
