import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAssociationLogoUrl } from "./associationUtils";
import { getPortalAccess, requireAdmin } from "./adminAuth";
import type { Id } from "./_generated/dataModel";

function maskNin(nin: string) {
  if (nin.length <= 4) return "****";
  return `*******${nin.slice(-4)}`;
}

function maskPhone(phone: string) {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 4)} *** ${phone.slice(-4)}`;
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const getPortalRole = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return { authorized: false as const, reason: access.reason };
    }
    return { authorized: true as const, role: access.role };
  },
});

export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return { authorized: false as const, reason: access.reason };
    }

    const members = await ctx.db.query("members").collect();
    const associations = await ctx.db.query("associations").collect();
    const associationMap = new Map(associations.map((a) => [a._id, a.name]));

    const now = Date.now();
    const todayStart = startOfDay(now);
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

    const byAssociation: Record<string, number> = {};
    const byState: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    for (const member of members) {
      const assocName = associationMap.get(member.associationId) ?? member.associationCode;
      byAssociation[assocName] = (byAssociation[assocName] ?? 0) + 1;
      byState[member.state] = (byState[member.state] ?? 0) + 1;

      const dayKey = new Date(member.createdAt).toISOString().slice(0, 10);
      dailyCounts[dayKey] = (dailyCounts[dayKey] ?? 0) + 1;

      if (member.createdAt >= todayStart) today += 1;
      if (member.createdAt >= weekStart) thisWeek += 1;
      if (member.createdAt >= monthStart) thisMonth += 1;
    }

    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(todayStart - (13 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      return {
        date: key,
        label: d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
        count: dailyCounts[key] ?? 0,
      };
    });

    const recent = [...members]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((m) => ({
        id: m._id,
        generatedId: m.generatedId,
        fullName: m.fullName,
        state: m.state,
        associationName: associationMap.get(m.associationId) ?? m.associationCode,
        createdAt: m.createdAt,
      }));

    return {
      authorized: true as const,
      role: access.role,
      totals: {
        all: members.length,
        today,
        thisWeek,
        thisMonth,
        associations: associations.filter((a) => a.isActive).length,
      },
      byAssociation: Object.entries(byAssociation)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      byState: Object.entries(byState)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      dailyRegistrations: last14Days,
      recent,
    };
  },
});

export const listMembers = query({
  args: {
    search: v.optional(v.string()),
    associationId: v.optional(v.id("associations")),
    state: v.optional(v.string()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return { authorized: false as const, reason: access.reason, members: [] as const };
    }

    const associations = await ctx.db.query("associations").collect();
    const associationMap = new Map(
      associations.map((a) => [a._id, { name: a.name, code: a.code }])
    );

    let members = await ctx.db.query("members").collect();
    const search = args.search?.trim().toLowerCase();

    members = members.filter((member) => {
      if (args.associationId && member.associationId !== args.associationId) {
        return false;
      }
      if (args.state && member.state !== args.state) {
        return false;
      }
      if (args.fromDate && member.createdAt < args.fromDate) {
        return false;
      }
      if (args.toDate && member.createdAt > args.toDate) {
        return false;
      }
      if (search) {
        const haystack = [
          member.fullName,
          member.generatedId,
          member.memberIdNumber,
          member.phone,
          member.state,
          member.associationCode,
          associationMap.get(member.associationId)?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return {
      authorized: true as const,
      role: access.role,
      members: members
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((member) => {
          const assoc = associationMap.get(member.associationId);
          return {
            id: member._id,
            generatedId: member.generatedId,
            memberIdNumber: member.memberIdNumber ?? "",
            fullName: member.fullName,
            state: member.state,
            phone: maskPhone(member.phone),
            nin: maskNin(member.nin),
            associationId: member.associationId,
            associationName: assoc?.name ?? member.associationCode,
            associationCode: assoc?.code ?? member.associationCode,
            phoneVerified: member.phoneVerified,
            createdAt: member.createdAt,
          };
        }),
    };
  },
});

export const listAssociations = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return { authorized: false as const, reason: access.reason, associations: [] as const };
    }

    const rows = await ctx.db.query("associations").collect();
    const members = await ctx.db.query("members").collect();
    const memberCounts = new Map<string, number>();
    for (const member of members) {
      memberCounts.set(member.associationId, (memberCounts.get(member.associationId) ?? 0) + 1);
    }

    return {
      authorized: true as const,
      role: access.role,
      associations: await Promise.all(
        rows
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (a) => ({
            id: a._id,
            name: a.name,
            code: a.code,
            logoUrl: (await getAssociationLogoUrl(ctx, a)) ?? "",
            isActive: a.isActive,
            memberCount: memberCounts.get(a._id) ?? 0,
            createdAt: a.createdAt,
          }))
      ),
    };
  },
});

export const createAssociation = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    logoStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    const code = args.code.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (!name) throw new Error("Association name is required.");
    if (!code) throw new Error("Association code is required.");

    const logoUrl = await ctx.storage.getUrl(args.logoStorageId);
    if (!logoUrl) {
      throw new Error("Logo upload is invalid. Please upload the image again.");
    }

    const existing = await ctx.db
      .query("associations")
      .withIndex("byCode", (q) => q.eq("code", code))
      .first();
    if (existing) {
      throw new Error("Association code already exists.");
    }

    return await ctx.db.insert("associations", {
      name,
      code,
      logoStorageId: args.logoStorageId,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const deleteMember = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    await requireAdmin(ctx);
    const member = await ctx.db.get(memberId);
    if (!member) {
      throw new Error("Member not found.");
    }
    await ctx.db.delete(memberId);
    return { deleted: true, generatedId: member.generatedId };
  },
});

export const listDataIssues = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized || access.role !== "admin") {
      return { authorized: false as const, reason: access.authorized ? "forbidden" as const : access.reason, issues: [] as const };
    }

    const members = await ctx.db.query("members").collect();
    const associations = await ctx.db.query("associations").collect();
    const associationMap = new Map(associations.map((a) => [a._id, a.name]));

    type IssueMember = {
      id: Id<"members">;
      generatedId: string;
      fullName: string;
      phone: string;
      nin: string;
      associationName: string;
      createdAt: number;
    };

    function toIssueMember(member: (typeof members)[number]): IssueMember {
      return {
        id: member._id,
        generatedId: member.generatedId,
        fullName: member.fullName,
        phone: maskPhone(member.phone),
        nin: maskNin(member.nin),
        associationName: associationMap.get(member.associationId) ?? member.associationCode,
        createdAt: member.createdAt,
      };
    }

    function findDuplicateGroups(
      keyFn: (member: (typeof members)[number]) => string | null | undefined
    ) {
      const groups = new Map<string, typeof members>();
      for (const member of members) {
        const key = keyFn(member);
        if (!key) continue;
        const list = groups.get(key) ?? [];
        list.push(member);
        groups.set(key, list);
      }
      return [...groups.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ key, members: list.map(toIssueMember) }));
    }

    const issues = [
      ...findDuplicateGroups((m) => m.phone).map((g) => ({
        type: "duplicate_phone" as const,
        label: `Duplicate phone: ${maskPhone(g.key)}`,
        members: g.members,
      })),
      ...findDuplicateGroups((m) => m.nin).map((g) => ({
        type: "duplicate_nin" as const,
        label: `Duplicate NIN: ${maskNin(g.key)}`,
        members: g.members,
      })),
      ...findDuplicateGroups((m) => m.generatedId).map((g) => ({
        type: "duplicate_network_id" as const,
        label: `Duplicate network ID: ${g.key}`,
        members: g.members,
      })),
      ...findDuplicateGroups((m) =>
        m.memberIdNumber ? `${m.associationId}:${m.memberIdNumber.toUpperCase()}` : null
      ).map((g) => ({
        type: "duplicate_association_id" as const,
        label: `Duplicate association member ID in same association`,
        members: g.members,
      })),
    ];

    return { authorized: true as const, issues };
  },
});
