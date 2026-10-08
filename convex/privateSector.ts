import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getPortalAccess, requireAdmin } from "./adminAuth";
import { BUSINESS_SECTORS } from "../lib/businessSectors";
import { LOCAL_GOVERNMENTS } from "../lib/nigerianLgas";
import { NIGERIAN_STATES } from "../lib/nigerianStates";
import { isValidNigerianPhone, normalizePhone } from "./utils";

const SETTINGS_KEY = "private_sector";

async function sectorSectionEnabled(ctx: QueryCtx | MutationCtx) {
  const row = await ctx.db
    .query("portal_settings")
    .withIndex("byKey", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
  return row?.showSectors ?? true;
}

const coverageValidator = v.array(
  v.object({
    state: v.string(),
    lgas: v.array(v.string()),
  })
);

function normalizeCoverage(
  coverage: { state: string; lgas: string[] }[]
) {
  const seen = new Set<string>();
  const normalized = coverage.map((entry) => {
    const state = entry.state.trim();
    if (!NIGERIAN_STATES.includes(state)) {
      throw new Error(`Unknown state: ${entry.state}`);
    }
    if (seen.has(state)) {
      throw new Error(`State listed more than once: ${state}`);
    }
    seen.add(state);

    const allowed = new Set(LOCAL_GOVERNMENTS[state] ?? []);
    const lgas = [...new Set(entry.lgas.map((lga) => lga.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    if (lgas.length === 0) {
      throw new Error(`Select at least one local government in ${state}.`);
    }
    for (const lga of lgas) {
      if (!allowed.has(lga)) {
        throw new Error(`${lga} is not a local government in ${state}.`);
      }
    }
    return { state, lgas };
  });

  if (normalized.length === 0) {
    throw new Error("Add coverage for at least one state.");
  }

  return normalized.sort((a, b) => a.state.localeCompare(b.state));
}

export const submit = mutation({
  args: {
    organizationName: v.string(),
    focalPerson: v.string(),
    cac: v.string(),
    phone: v.string(),
    email: v.string(),
    coverage: coverageValidator,
    sectors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const organizationName = args.organizationName.trim();
    const focalPerson = args.focalPerson.trim();
    const cac = args.cac.trim().toUpperCase().replace(/\s+/g, "");
    const phone = normalizePhone(args.phone);
    const email = args.email.trim().toLowerCase();

    if (!organizationName) throw new Error("Organization name is required.");
    if (!focalPerson) throw new Error("Focal person is required.");
    if (!/^[A-Z0-9-]{3,20}$/.test(cac)) {
      throw new Error("Enter a valid CAC number.");
    }
    if (!isValidNigerianPhone(phone)) {
      throw new Error("Enter a valid Nigerian phone number.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid organization email.");
    }

    const existingEmail = await ctx.db
      .query("private_sector_engagements")
      .withIndex("byEmail", (q) => q.eq("email", email))
      .first();
    if (existingEmail) {
      throw new Error("This organization email is already registered.");
    }

    const existingCac = await ctx.db
      .query("private_sector_engagements")
      .withIndex("byCac", (q) => q.eq("cac", cac))
      .first();
    if (existingCac) {
      throw new Error("This CAC number is already registered.");
    }

    const coverage = normalizeCoverage(args.coverage);
    const lgaCount = coverage.reduce((sum, entry) => sum + entry.lgas.length, 0);
    const showSectors = await sectorSectionEnabled(ctx);
    const allowedSectors = new Set<string>(BUSINESS_SECTORS);
    const sectors = showSectors
      ? [...new Set((args.sectors ?? []).map((sector) => sector.trim()).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        )
      : [];

    if (showSectors && sectors.length === 0) {
      throw new Error("Select at least one sector.");
    }
    for (const sector of sectors) {
      if (!allowedSectors.has(sector)) {
        throw new Error(`Unknown sector: ${sector}`);
      }
    }

    const id = await ctx.db.insert("private_sector_engagements", {
      organizationName,
      focalPerson,
      cac,
      phone,
      email,
      coverage,
      stateCount: coverage.length,
      lgaCount,
      sectors,
      createdAt: Date.now(),
    });

    return {
      id,
      organizationName,
      stateCount: coverage.length,
      lgaCount,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized || access.role !== "admin") {
      return {
        authorized: false as const,
        reason: access.authorized ? ("forbidden" as const) : access.reason,
        engagements: [] as const,
      };
    }

    const rows = await ctx.db
      .query("private_sector_engagements")
      .withIndex("byCreatedAt")
      .order("desc")
      .take(200);

    return {
      authorized: true as const,
      engagements: rows.map((row) => ({
        id: row._id,
        organizationName: row.organizationName,
        focalPerson: row.focalPerson,
        cac: row.cac,
        phone: row.phone,
        email: row.email,
        coverage: row.coverage,
        stateCount: row.stateCount,
        lgaCount: row.lgaCount,
        sectors: row.sectors ?? [],
        createdAt: row.createdAt,
      })),
    };
  },
});

export const getFormSettings = query({
  args: {},
  handler: async (ctx) => {
    return { showSectors: await sectorSectionEnabled(ctx) };
  },
});

export const setShowSectors = mutation({
  args: { showSectors: v.boolean() },
  handler: async (ctx, { showSectors }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("portal_settings")
      .withIndex("byKey", (q) => q.eq("key", SETTINGS_KEY))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { showSectors, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("portal_settings", {
      key: SETTINGS_KEY,
      showSectors,
      updatedAt: Date.now(),
    });
  },
});
