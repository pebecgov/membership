import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function getAssociationLogoUrl(
  ctx: Ctx,
  association: Doc<"associations">
): Promise<string | null> {
  if (association.logoStorageId) {
    return await ctx.storage.getUrl(association.logoStorageId);
  }
  return association.logoUrl ?? null;
}
