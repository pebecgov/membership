import { mutation } from "./_generated/server";
import { getAdminIdentity } from "./adminAuth";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await getAdminIdentity(ctx);
    if (!access.authorized) {
      throw new Error("You are not authorized to upload association logos.");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export { MAX_LOGO_BYTES };
