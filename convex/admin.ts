import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAssociationLogoUrl } from "./associationUtils";
import { getPortalAccess, requireAdmin } from "./adminAuth";
import { getViewerAssociationIds } from "./viewerAccess";
import type { Doc, Id } from "./_generated/dataModel";
import {
  adjustMemberStats,
  applyStatsDelta,
  buildSearchText,
  emptyStats,
  getGlobalStats,
  markRebuildStarted,
  periodCounts,
  writeStatsSnapshot,
  type StatsSnapshot,
} from "./memberStats";

function maskNin(nin: string) {
  if (nin.length <= 4) return "****";
  return `*******${nin.slice(-4)}`;
}

function maskPhone(phone: string) {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 4)} *** ${phone.slice(-4)}`;
}

type MemberFilters = {
  search?: string;
  associationId?: Id<"associations">;
  state?: string;
  fromDate?: number;
  toDate?: number;
};

const MAX_PAGE_SIZE = 200;

function paginationCursor(cursor: string | undefined) {
  if (!cursor || cursor === "") return null;
  if (cursor.startsWith("s:")) return cursor.slice(2);
  if (cursor.startsWith("c:")) return cursor.slice(2);
  return cursor;
}

function wrapCursor(kind: "c" | "s", continueCursor: string, isDone: boolean) {
  return {
    isDone,
    continueCursor: isDone || !continueCursor ? "" : `${kind}:${continueCursor}`,
  };
}

async function pageMembers(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null,
  cursor: string | undefined,
  pageSize: number
) {
  if (allowedAssociationIds && filters.associationId && !allowedAssociationIds.includes(filters.associationId)) {
    return { members: [] as Doc<"members">[], isDone: true, continueCursor: "" };
  }
  if (allowedAssociationIds?.length === 0) {
    return { members: [] as Doc<"members">[], isDone: true, continueCursor: "" };
  }

  if (filters.search) {
    return await pageBySearch(ctx, filters, allowedAssociationIds, cursor, pageSize);
  }

  const singleAssociation =
    filters.associationId ??
    (allowedAssociationIds?.length === 1 ? allowedAssociationIds[0] : undefined);

  // Prefer Convex native pagination so we never skip same-timestamp rows.
  if (singleAssociation && !filters.state && !filters.fromDate && !filters.toDate) {
    const page = await ctx.db
      .query("members")
      .withIndex("byAssociationCreatedAt", (q) => q.eq("associationId", singleAssociation))
      .order("desc")
      .paginate({ numItems: pageSize, cursor: paginationCursor(cursor) });
    return { members: page.page, ...wrapCursor("c", page.continueCursor, page.isDone) };
  }

  if (filters.state && !filters.fromDate && !filters.toDate && allowedAssociationIds === null && !filters.associationId) {
    const page = await ctx.db
      .query("members")
      .withIndex("byStateCreatedAt", (q) => q.eq("state", filters.state!))
      .order("desc")
      .paginate({ numItems: pageSize, cursor: paginationCursor(cursor) });
    return { members: page.page, ...wrapCursor("c", page.continueCursor, page.isDone) };
  }

  if (
    !filters.state &&
    !filters.fromDate &&
    !filters.toDate &&
    !filters.associationId &&
    allowedAssociationIds === null
  ) {
    const page = await ctx.db
      .query("members")
      .withIndex("byCreatedAt")
      .order("desc")
      .paginate({ numItems: pageSize, cursor: paginationCursor(cursor) });
    return { members: page.page, ...wrapCursor("c", page.continueCursor, page.isDone) };
  }

  // Mixed filters: native-paginate the best index, then filter in-page until full.
  return await pageByFilteredIndex(ctx, filters, allowedAssociationIds, cursor, pageSize);
}

async function pageByFilteredIndex(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null,
  cursor: string | undefined,
  pageSize: number
) {
  let nextCursor = paginationCursor(cursor);
  const members: Doc<"members">[] = [];
  let isDone = false;
  let continueCursor = "";
  let guard = 0;

  while (members.length < pageSize && guard < 20) {
    guard += 1;
    const page = await takeIndexedPage(ctx, filters, allowedAssociationIds, nextCursor, pageSize);
    for (const member of page.page) {
      if (!matchesFilters(member, filters, allowedAssociationIds)) continue;
      members.push(member);
      if (members.length === pageSize) break;
    }
    isDone = page.isDone;
    continueCursor = page.continueCursor;
    nextCursor = page.continueCursor;
    if (page.isDone) break;
    if (members.length === pageSize) break;
  }

  return { members, ...wrapCursor("c", continueCursor, isDone && members.length < pageSize) };
}

function matchesFilters(
  member: Doc<"members">,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null
) {
  if (!allowedAssociation(member, allowedAssociationIds, filters.associationId)) return false;
  if (filters.state && member.state !== filters.state) return false;
  return withinDates(member, filters);
}

async function takeIndexedPage(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null,
  cursor: string | null,
  pageSize: number
) {
  const singleAssociation =
    filters.associationId ??
    (allowedAssociationIds?.length === 1 ? allowedAssociationIds[0] : undefined);

  if (singleAssociation) {
    return await ctx.db
      .query("members")
      .withIndex("byAssociationCreatedAt", (q) => {
        const base = q.eq("associationId", singleAssociation);
        if (filters.fromDate !== undefined && filters.toDate !== undefined) {
          return base.gte("createdAt", filters.fromDate).lte("createdAt", filters.toDate);
        }
        if (filters.fromDate !== undefined) return base.gte("createdAt", filters.fromDate);
        if (filters.toDate !== undefined) return base.lte("createdAt", filters.toDate);
        return base;
      })
      .order("desc")
      .paginate({ numItems: pageSize, cursor });
  }

  if (filters.state) {
    return await ctx.db
      .query("members")
      .withIndex("byStateCreatedAt", (q) => {
        const base = q.eq("state", filters.state!);
        if (filters.fromDate !== undefined && filters.toDate !== undefined) {
          return base.gte("createdAt", filters.fromDate).lte("createdAt", filters.toDate);
        }
        if (filters.fromDate !== undefined) return base.gte("createdAt", filters.fromDate);
        if (filters.toDate !== undefined) return base.lte("createdAt", filters.toDate);
        return base;
      })
      .order("desc")
      .paginate({ numItems: pageSize, cursor });
  }

  if (allowedAssociationIds && allowedAssociationIds.length > 1) {
    // Fall back to createdAt scan and filter to allowed associations.
    return await ctx.db
      .query("members")
      .withIndex("byCreatedAt", (q) => {
        if (filters.fromDate !== undefined && filters.toDate !== undefined) {
          return q.gte("createdAt", filters.fromDate).lte("createdAt", filters.toDate);
        }
        if (filters.fromDate !== undefined) return q.gte("createdAt", filters.fromDate);
        if (filters.toDate !== undefined) return q.lte("createdAt", filters.toDate);
        return q;
      })
      .order("desc")
      .paginate({ numItems: pageSize, cursor });
  }

  return await ctx.db
    .query("members")
    .withIndex("byCreatedAt", (q) => {
      if (filters.fromDate !== undefined && filters.toDate !== undefined) {
        return q.gte("createdAt", filters.fromDate).lte("createdAt", filters.toDate);
      }
      if (filters.fromDate !== undefined) return q.gte("createdAt", filters.fromDate);
      if (filters.toDate !== undefined) return q.lte("createdAt", filters.toDate);
      return q;
    })
    .order("desc")
    .paginate({ numItems: pageSize, cursor });
}

async function pageBySearch(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null,
  cursor: string | undefined,
  pageSize: number
) {
  let searchCursor = paginationCursor(cursor);
  let matches: Doc<"members">[] = [];
  let isDone = false;
  let continueCursor = "";
  let guard = 0;

  while (matches.length < pageSize && guard < 20) {
    guard += 1;
    const page = await ctx.db
      .query("members")
      .withSearchIndex("search_members", (q) => {
        let search = q.search("searchText", filters.search!);
        if (filters.associationId) search = search.eq("associationId", filters.associationId);
        if (filters.state) search = search.eq("state", filters.state);
        return search;
      })
      .paginate({ numItems: pageSize, cursor: searchCursor });

    for (const member of page.page) {
      if (!matchesFilters(member, filters, allowedAssociationIds)) continue;
      matches.push(member);
      if (matches.length === pageSize) break;
    }
    isDone = page.isDone;
    continueCursor = page.continueCursor;
    searchCursor = page.continueCursor;
    if (page.isDone) break;
    if (matches.length === pageSize) break;
  }

  return {
    members: matches,
    ...wrapCursor("s", continueCursor, isDone && matches.length < pageSize),
  };
}

async function stateCountFromStats(
  ctx: QueryCtx,
  state: string,
  associationId: Id<"associations"> | undefined,
  allowedAssociationIds: Id<"associations">[] | null
) {
  if (associationId) {
    if (allowedAssociationIds && !allowedAssociationIds.includes(associationId)) return 0;
    const doc = await ctx.db
      .query("dashboard_stats")
      .withIndex("byKey", (q) => q.eq("key", `assoc:${associationId}`))
      .unique();
    if (!doc?.ready) return null;
    return doc.byState.find((row) => row.name === state)?.count ?? 0;
  }

  if (allowedAssociationIds === null) {
    const global = await getGlobalStats(ctx);
    if (!global?.ready) return null;
    return global.byState.find((row) => row.name === state)?.count ?? 0;
  }

  let total = 0;
  for (const id of allowedAssociationIds) {
    const doc = await ctx.db
      .query("dashboard_stats")
      .withIndex("byKey", (q) => q.eq("key", `assoc:${id}`))
      .unique();
    if (!doc?.ready) return null;
    total += doc.byState.find((row) => row.name === state)?.count ?? 0;
  }
  return total;
}

async function visibleTotal(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null
) {
  if (filters.search || filters.fromDate || filters.toDate) return null;

  if (filters.state) {
    return await stateCountFromStats(
      ctx,
      filters.state,
      filters.associationId,
      allowedAssociationIds
    );
  }

  if (filters.associationId) {
    if (allowedAssociationIds && !allowedAssociationIds.includes(filters.associationId)) return 0;
    const doc = await ctx.db
      .query("dashboard_stats")
      .withIndex("byKey", (q) => q.eq("key", `assoc:${filters.associationId}`))
      .unique();
    return doc?.ready ? doc.total : null;
  }

  if (allowedAssociationIds === null) {
    const global = await getGlobalStats(ctx);
    return global?.ready ? global.total : null;
  }

  let total = 0;
  for (const associationId of allowedAssociationIds) {
    const doc = await ctx.db
      .query("dashboard_stats")
      .withIndex("byKey", (q) => q.eq("key", `assoc:${associationId}`))
      .unique();
    if (!doc?.ready) return null;
    total += doc.total;
  }
  return total;
}
const REBUILD_STALE_MS = 15 * 60 * 1000;

function toMemberRow(
  member: Doc<"members">,
  associationMap: Map<string, { name: string; code: string }>
) {
  const assoc = associationMap.get(member.associationId as string);
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
}

async function associationMap(ctx: QueryCtx) {
  const associations = await ctx.db.query("associations").collect();
  return new Map(associations.map((association) => [association._id as string, association]));
}

async function getAllowedAssociationIds(
  ctx: QueryCtx,
  access: { role: "admin" | "viewer"; identity: { email?: string | null } }
): Promise<Id<"associations">[] | null> {
  if (access.role === "admin") return null;
  const email = access.identity.email?.toLowerCase();
  if (!email) return [];
  return await getViewerAssociationIds(ctx, email);
}

function withinDates(member: Doc<"members">, filters: MemberFilters) {
  if (filters.fromDate && member.createdAt < filters.fromDate) return false;
  if (filters.toDate && member.createdAt > filters.toDate) return false;
  return true;
}

function allowedAssociation(
  member: Doc<"members">,
  allowedAssociationIds: Id<"associations">[] | null,
  associationId?: Id<"associations">
) {
  if (associationId && member.associationId !== associationId) return false;
  if (allowedAssociationIds && !allowedAssociationIds.includes(member.associationId)) return false;
  return true;
}

async function recentMembers(
  ctx: QueryCtx,
  allowedAssociationIds: Id<"associations">[] | null,
  names: Map<string, { name: string }>
) {
  const rows =
    allowedAssociationIds === null
      ? await ctx.db.query("members").withIndex("byCreatedAt").order("desc").take(8)
      : (
          await Promise.all(
            allowedAssociationIds.map((associationId) =>
              ctx.db
                .query("members")
                .withIndex("byAssociationCreatedAt", (q) => q.eq("associationId", associationId))
                .order("desc")
                .take(8)
            )
          )
        )
          .flat()
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 8);

  return rows.map((member) => ({
    id: member._id,
    generatedId: member.generatedId,
    fullName: member.fullName,
    state: member.state,
    associationName: names.get(member.associationId as string)?.name ?? member.associationCode,
    createdAt: member.createdAt,
  }));
}

export const getPortalRole = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return { authorized: false as const, reason: access.reason };
    }
    if (access.role === "viewer") {
      const associationIds = await getViewerAssociationIds(
        ctx,
        access.identity.email?.toLowerCase() ?? ""
      );
      return { authorized: true as const, role: access.role, associationIds };
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

    const allowedAssociationIds = await getAllowedAssociationIds(ctx, access);
    const associations = await ctx.db.query("associations").collect();
    const names = new Map(associations.map((association) => [association._id as string, association]));
    const global = await getGlobalStats(ctx);
    const daily: Record<string, number> = {};
    const byState = new Map<string, number>();
    const byAssociation: { name: string; count: number }[] = [];
    let total = 0;
    let needsRebuild = false;

    if (allowedAssociationIds === null) {
      needsRebuild = !global?.ready;
      total = global?.total ?? 0;
      for (const row of global?.byState ?? []) byState.set(row.name, row.count);
      for (const row of global?.daily ?? []) daily[row.date] = row.count;
      for (const row of global?.byAssociation ?? []) {
        byAssociation.push({
          name: names.get(row.id)?.name ?? row.id,
          count: row.count,
        });
      }
    } else {
      const docs = await Promise.all(
        allowedAssociationIds.map((associationId) =>
          ctx.db
            .query("dashboard_stats")
            .withIndex("byKey", (q) => q.eq("key", `assoc:${associationId}`))
            .unique()
        )
      );
      needsRebuild = docs.some((doc) => !doc?.ready);
      docs.forEach((doc, index) => {
        const associationId = allowedAssociationIds[index];
        total += doc?.total ?? 0;
        byAssociation.push({
          name: names.get(associationId as string)?.name ?? associationId,
          count: doc?.total ?? 0,
        });
        for (const row of doc?.byState ?? []) {
          byState.set(row.name, (byState.get(row.name) ?? 0) + row.count);
        }
        for (const row of doc?.daily ?? []) {
          daily[row.date] = (daily[row.date] ?? 0) + row.count;
        }
      });
    }

    const periods = periodCounts(daily);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const last14Days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(todayStart.getTime() - (13 - index) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        label: date.toLocaleDateString("en-NG", { month: "short", day: "numeric", timeZone: "UTC" }),
        count: daily[key] ?? 0,
      };
    });
    const visibleAssociations =
      allowedAssociationIds === null
        ? associations
        : associations.filter((association) => allowedAssociationIds.includes(association._id));

    return {
      authorized: true as const,
      role: access.role,
      needsRebuild,
      totals: {
        all: total,
        today: periods.today,
        thisWeek: periods.thisWeek,
        thisMonth: periods.thisMonth,
        associations: visibleAssociations.filter((association) => association.isActive).length,
      },
      byAssociation: byAssociation.sort((a, b) => b.count - a.count),
      byState: [...byState.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      dailyRegistrations: last14Days,
      recent: await recentMembers(ctx, allowedAssociationIds, names),
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
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return {
        authorized: false as const,
        reason: access.reason,
        members: [] as const,
        total: null,
        pageSize: 25,
        isDone: true,
        continueCursor: "",
      };
    }

    const allowedAssociationIds = await getAllowedAssociationIds(ctx, access);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, args.pageSize ?? 25));
    const filters: MemberFilters = {
      search: args.search?.trim() || undefined,
      associationId: args.associationId,
      state: args.state || undefined,
      fromDate: args.fromDate,
      toDate: args.toDate,
    };
    const page = await pageMembers(ctx, filters, allowedAssociationIds, args.cursor, pageSize);
    const associations = await associationMap(ctx);

    return {
      authorized: true as const,
      role: access.role,
      members: page.members.map((member) => toMemberRow(member, associations)),
      total: await visibleTotal(ctx, filters, allowedAssociationIds),
      pageSize,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const startStatsRebuild = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      throw new Error("You are not authorized to access the portal.");
    }

    const existing = await getGlobalStats(ctx);
    if (existing?.ready && !existing.rebuilding) return { started: false };
    if (existing?.rebuilding && Date.now() - existing.updatedAt < REBUILD_STALE_MS) {
      return { started: false };
    }

    await markRebuildStarted(ctx);
    await ctx.scheduler.runAfter(0, internal.admin.rebuildStatsBatch, {
      cursor: null,
      stats: emptyStats(),
    });
    return { started: true };
  },
});

export const rebuildStatsBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    stats: v.any(),
  },
  handler: async (ctx, args) => {
    const stats = args.stats as StatsSnapshot;
    const page = await ctx.db.query("members").withIndex("byCreatedAt").paginate({
      numItems: 300,
      cursor: args.cursor,
    });

    for (const member of page.page) {
      applyStatsDelta(stats, member, 1);
      if (!member.searchText) {
        await ctx.db.patch(member._id, { searchText: buildSearchText(member) });
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.admin.rebuildStatsBatch, {
        cursor: page.continueCursor,
        stats,
      });
      return;
    }

    await writeStatsSnapshot(ctx, stats);
  },
});

export const listMemberFilterAssociations = query({
  args: {},
  handler: async (ctx) => {
    const access = await getPortalAccess(ctx);
    if (!access.authorized) {
      return { authorized: false as const, reason: access.reason, associations: [] as const };
    }

    const allowedAssociationIds = await getAllowedAssociationIds(ctx, access);
    const rows = await ctx.db.query("associations").collect();
    const allowedSet =
      allowedAssociationIds === null ? null : new Set(allowedAssociationIds);

    return {
      authorized: true as const,
      associations: rows
        .filter((assoc) => allowedSet === null || allowedSet.has(assoc._id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((assoc) => ({ id: assoc._id, name: assoc.name, code: assoc.code })),
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
    if (access.role !== "admin") {
      return { authorized: false as const, reason: "forbidden" as const, associations: [] as const };
    }

    const rows = await ctx.db.query("associations").collect();
    const global = await getGlobalStats(ctx);
    const memberCounts = new Map((global?.byAssociation ?? []).map((row) => [row.id, row.count]));

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
            memberCount: memberCounts.get(a._id as string) ?? 0,
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

export const setAssociationActive = mutation({
  args: {
    associationId: v.id("associations"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const association = await ctx.db.get(args.associationId);
    if (!association) {
      throw new Error("Association not found.");
    }
    await ctx.db.patch(args.associationId, { isActive: args.isActive });
    return { id: args.associationId, isActive: args.isActive };
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
    await adjustMemberStats(ctx, member, -1);
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

    const members = await ctx.db.query("members").withIndex("byCreatedAt").order("desc").take(2000);
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
