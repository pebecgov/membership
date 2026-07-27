import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getPortalAccess, requireAdmin } from "./adminAuth";
import { getViewerAssociationIds, listViewerEmailsFromEnv } from "./viewerAccess";

export const listViewerAssignments = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized || access.role !== "admin") {
      return { authorized: false as const, reason: "forbidden" as const, viewers: [] as const };
    }

    const associations = await ctx.db.query("associations").collect();
    const viewerEmails = listViewerEmailsFromEnv();

    const viewers = await Promise.all(
      viewerEmails.map(async (email) => {
        const associationIds = await getViewerAssociationIds(ctx, email);
        const assignedAssociations = associations
          .filter((assoc) => associationIds.includes(assoc._id))
          .map((assoc) => ({ id: assoc._id, name: assoc.name, code: assoc.code }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return { email, associationIds, assignedAssociations };
      })
    );

    return {
      authorized: true as const,
      viewers,
      associations: associations
        .map((assoc) => ({ id: assoc._id, name: assoc.name, code: assoc.code }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const setViewerAssociations = mutation({
  args: {
    email: v.string(),
    associationIds: v.array(v.id("associations")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("Viewer email is required.");
    }

    const viewerEmails = listViewerEmailsFromEnv();
    if (!viewerEmails.includes(email)) {
      throw new Error("Email must be listed in VIEWER_EMAILS before assigning associations.");
    }

    const associations = await ctx.db.query("associations").collect();
    const validIds = new Set(associations.map((assoc) => assoc._id));
    for (const associationId of args.associationIds) {
      if (!validIds.has(associationId)) {
        throw new Error("One or more associations are invalid.");
      }
    }

    const existing = await ctx.db
      .query("viewer_access")
      .withIndex("byEmail", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        associationIds: args.associationIds,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("viewer_access", {
      email,
      associationIds: args.associationIds,
      updatedAt: Date.now(),
    });
  },
});
