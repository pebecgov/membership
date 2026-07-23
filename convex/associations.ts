import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAssociationLogoUrl } from "./associationUtils";

const SAMPLE_ASSOCIATIONS = [
  {
    name: "NACCIMA",
    code: "NACCIMA",
    logoUrl: "https://placehold.co/120x120/0f766e/ffffff?text=NACCIMA",
  },
  {
    name: "MAN",
    code: "MAN",
    logoUrl: "https://placehold.co/120x120/1d4ed8/ffffff?text=MAN",
  },
  {
    name: "NACCI",
    code: "NACCI",
    logoUrl: "https://placehold.co/120x120/7c3aed/ffffff?text=NACCI",
  },
];

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("associations")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .collect();

    const associations = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        logoUrl: (await getAssociationLogoUrl(ctx, row)) ?? "",
      }))
    );

    return associations.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Run once after deploy: npx convex run associations:seed */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("associations").first();
    if (existing) {
      return { seeded: false, message: "Associations already exist." };
    }

    const now = Date.now();
    for (const assoc of SAMPLE_ASSOCIATIONS) {
      await ctx.db.insert("associations", {
        ...assoc,
        isActive: true,
        createdAt: now,
      });
    }

    return { seeded: true, count: SAMPLE_ASSOCIATIONS.length };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    logoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const existing = await ctx.db
      .query("associations")
      .withIndex("byCode", (q) => q.eq("code", code))
      .first();
    if (existing) {
      throw new Error("Association code already exists.");
    }

    return await ctx.db.insert("associations", {
      name: args.name,
      code,
      logoUrl: args.logoUrl,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});
