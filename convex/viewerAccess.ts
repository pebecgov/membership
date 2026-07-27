import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export function parseEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function listViewerEmailsFromEnv() {
  return parseEmailList(process.env.VIEWER_EMAILS);
}

export async function getViewerAssociationIds(
  ctx: QueryCtx,
  email: string
): Promise<Id<"associations">[]> {
  const row = await ctx.db
    .query("viewer_access")
    .withIndex("byEmail", (q) => q.eq("email", email.toLowerCase()))
    .unique();
  return row?.associationIds ?? [];
}
