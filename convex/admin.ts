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
const SCAN_BATCH = 80;
const MAX_SCAN = 2000;
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

async function takeByCreatedAt(
  ctx: QueryCtx,
  filters: MemberFilters,
  before: number | undefined,
  limit: number
) {
  return await ctx.db
    .query("members")
    .withIndex("byCreatedAt", (q) => {
      const upper = upperCreatedAt(before, filters.toDate);
      if (filters.fromDate !== undefined && upper) {
        return upper.op === "lt"
          ? q.gte("createdAt", filters.fromDate).lt("createdAt", upper.value)
          : q.gte("createdAt", filters.fromDate).lte("createdAt", upper.value);
      }
      if (filters.fromDate !== undefined) return q.gte("createdAt", filters.fromDate);
      if (upper?.op === "lt") return q.lt("createdAt", upper.value);
      if (upper?.op === "lte") return q.lte("createdAt", upper.value);
      return q;
    })
    .order("desc")
    .take(limit);
}

async function takeByAssociation(
  ctx: QueryCtx,
  associationId: Id<"associations">,
  filters: MemberFilters,
  before: number | undefined,
  limit: number
) {
  return await ctx.db
    .query("members")
    .withIndex("byAssociationCreatedAt", (q) => {
      const base = q.eq("associationId", associationId);
      const upper = upperCreatedAt(before, filters.toDate);
      if (filters.fromDate !== undefined && upper) {
        return upper.op === "lt"
          ? base.gte("createdAt", filters.fromDate).lt("createdAt", upper.value)
          : base.gte("createdAt", filters.fromDate).lte("createdAt", upper.value);
      }
      if (filters.fromDate !== undefined) return base.gte("createdAt", filters.fromDate);
      if (upper?.op === "lt") return base.lt("createdAt", upper.value);
      if (upper?.op === "lte") return base.lte("createdAt", upper.value);
      return base;
    })
    .order("desc")
    .take(limit);
}

async function takeByState(
  ctx: QueryCtx,
  state: string,
  filters: MemberFilters,
  before: number | undefined,
  limit: number
) {
  return await ctx.db
    .query("members")
    .withIndex("byStateCreatedAt", (q) => {
      const base = q.eq("state", state);
      const upper = upperCreatedAt(before, filters.toDate);
      if (filters.fromDate !== undefined && upper) {
        return upper.op === "lt"
          ? base.gte("createdAt", filters.fromDate).lt("createdAt", upper.value)
          : base.gte("createdAt", filters.fromDate).lte("createdAt", upper.value);
      }
      if (filters.fromDate !== undefined) return base.gte("createdAt", filters.fromDate);
      if (upper?.op === "lt") return base.lt("createdAt", upper.value);
      if (upper?.op === "lte") return base.lte("createdAt", upper.value);
      return base;
    })
    .order("desc")
    .take(limit);
}

function upperCreatedAt(before: number | undefined, toDate: number | undefined) {
  if (before !== undefined && (toDate === undefined || before <= toDate)) {
    return { op: "lt" as const, value: before };
  }
  if (toDate !== undefined) return { op: "lte" as const, value: toDate };
  return undefined;
}

function createdAtCursor(cursor: string | undefined) {
  if (!cursor?.startsWith("t:")) return undefined;
  const value = Number(cursor.slice(2));
  return Number.isFinite(value) ? value : undefined;
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

  const before = createdAtCursor(cursor);
  const singleAssociation =
    filters.associationId ??
    (allowedAssociationIds?.length === 1 ? allowedAssociationIds[0] : undefined);

  if (singleAssociation) {
    return await pageByScan(
      (limit, startBefore) => takeByAssociation(ctx, singleAssociation, filters, startBefore, limit),
      (member) =>
        (!filters.state || member.state === filters.state) && withinDates(member, filters),
      before,
      pageSize
    );
  }

  if (filters.state) {
    return await pageByScan(
      (limit, startBefore) => takeByState(ctx, filters.state!, filters, startBefore, limit),
      (member) => allowedAssociation(member, allowedAssociationIds, filters.associationId),
      before,
      pageSize
    );
  }

  if (allowedAssociationIds && allowedAssociationIds.length > 1) {
    return await pageAcrossAssociations(ctx, allowedAssociationIds, filters, before, pageSize);
  }

  return await pageByScan(
    (limit, startBefore) => takeByCreatedAt(ctx, filters, startBefore, limit),
    () => true,
    before,
    pageSize
  );
}

async function pageByScan(
  take: (limit: number, before: number | undefined) => Promise<Doc<"members">[]>,
  keep: (member: Doc<"members">) => boolean,
  before: number | undefined,
  pageSize: number
) {
  const members: Doc<"members">[] = [];
  let scanned = 0;
  let cursorBefore = before;
  let exhausted = false;

  while (members.length < pageSize && scanned < MAX_SCAN) {
    const batch = await take(Math.min(SCAN_BATCH, MAX_SCAN - scanned), cursorBefore);
    if (batch.length === 0) {
      exhausted = true;
      break;
    }
    scanned += batch.length;
    for (const member of batch) {
      cursorBefore = member.createdAt;
      if (!keep(member)) continue;
      members.push(member);
      if (members.length === pageSize) break;
    }
    if (members.length === pageSize) break;
    if (batch.length < SCAN_BATCH) {
      exhausted = true;
      break;
    }
  }

  const isDone = exhausted && members.length < pageSize;
  const boundary = members.at(-1)?.createdAt ?? cursorBefore;
  return {
    members,
    isDone,
    continueCursor: isDone || boundary === undefined ? "" : `t:${boundary}`,
  };
}

async function pageAcrossAssociations(
  ctx: QueryCtx,
  associationIds: Id<"associations">[],
  filters: MemberFilters,
  before: number | undefined,
  pageSize: number
) {
  const lists = await Promise.all(
    associationIds.map((associationId) =>
      takeByAssociation(ctx, associationId, filters, before, pageSize)
    )
  );
  const merged = lists
    .flat()
    .filter((member) => !filters.state || member.state === filters.state)
    .sort((a, b) => b.createdAt - a.createdAt);
  const members = merged.slice(0, pageSize);
  const isDone = members.length < pageSize && lists.every((list) => list.length < pageSize);
  const boundary =
    members.at(-1)?.createdAt ??
    lists.flat().reduce<number | undefined>((oldest, member) => {
      if (oldest === undefined || member.createdAt < oldest) return member.createdAt;
      return oldest;
    }, undefined);

  return {
    members,
    isDone,
    continueCursor: isDone || boundary === undefined ? "" : `t:${boundary}`,
  };
}

async function pageBySearch(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null,
  cursor: string | undefined,
  pageSize: number
) {
  let searchCursor = cursor?.startsWith("s:") ? cursor.slice(2) : null;
  let matches: Doc<"members">[] = [];
  let isDone = false;
  let continueCursor = "";
  let scanned = 0;

  while (matches.length === 0 && scanned < MAX_SCAN) {
    const page = await ctx.db
      .query("members")
      .withSearchIndex("search_members", (q) => {
        let search = q.search("searchText", filters.search!);
        if (filters.associationId) search = search.eq("associationId", filters.associationId);
        if (filters.state) search = search.eq("state", filters.state);
        return search;
      })
      .paginate({ numItems: pageSize, cursor: searchCursor });

    scanned += page.page.length;
    matches = page.page.filter(
      (member) =>
        allowedAssociation(member, allowedAssociationIds, filters.associationId) &&
        withinDates(member, filters)
    );
    isDone = page.isDone;
    continueCursor = page.continueCursor;
    searchCursor = page.continueCursor;
    if (page.isDone) break;
  }

  return {
    members: matches,
    isDone,
    continueCursor: isDone ? "" : `s:${continueCursor}`,
  };
}

async function visibleTotal(
  ctx: QueryCtx,
  filters: MemberFilters,
  allowedAssociationIds: Id<"associations">[] | null
) {
  if (filters.search || filters.state || filters.fromDate || filters.toDate) return null;

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
