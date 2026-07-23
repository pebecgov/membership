import { mutation } from "./_generated/server";
import { requireAdmin } from "./adminAuth";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export { MAX_LOGO_BYTES };
