import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const GLOBAL_STATS_KEY = "global";

export type CountPair = { name: string; count: number };
export type AssociationCount = { id: string; count: number };
export type DailyCount = { date: string; count: number };

export type StatsSnapshot = {
  total: number;
  byState: Record<string, number>;
  byAssociation: Record<string, number>;
  daily: Record<string, number>;
  perAssociation: Record<
    string,
    { total: number; byState: Record<string, number>; daily: Record<string, number> }
  >;
};

export function emptyStats(): StatsSnapshot {
  return { total: 0, byState: {}, byAssociation: {}, daily: {}, perAssociation: {} };
}

export function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function buildSearchText(member: {
  fullName: string;
  generatedId: string;
  memberIdNumber?: string;
  phone: string;
  nin: string;
  state: string;
  associationCode: string;
}) {
  return [
    member.fullName,
    member.generatedId,
    member.memberIdNumber ?? "",
    member.phone,
    member.nin,
    member.state,
    member.associationCode,
  ]
    .join(" ")
    .trim();
}

export function pairsToRecord(pairs: CountPair[]) {
  return Object.fromEntries(pairs.map((pair) => [pair.name, pair.count]));
}

export function recordToPairs(record: Record<string, number>): CountPair[] {
  return Object.entries(record)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, count }));
}

export function recordToAssociationCounts(record: Record<string, number>): AssociationCount[] {
  return Object.entries(record)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count }));
}

export function recordToDaily(record: Record<string, number>): DailyCount[] {
  return Object.entries(record)
    .filter(([, count]) => count > 0)
    .map(([date, count]) => ({ date, count }));
}

function bump(record: Record<string, number>, key: string, delta: number) {
  const next = (record[key] ?? 0) + delta;
  if (next <= 0) delete record[key];
  else record[key] = next;
}

export function applyStatsDelta(
  stats: StatsSnapshot,
  member: { associationId: Id<"associations">; state: string; createdAt: number },
  delta: 1 | -1
) {
  const associationId = member.associationId as string;
  stats.total += delta;
  bump(stats.byState, member.state, delta);
  bump(stats.byAssociation, associationId, delta);
  bump(stats.daily, dayKey(member.createdAt), delta);

  const bucket = stats.perAssociation[associationId] ?? {
    total: 0,
    byState: {},
    daily: {},
  };
  bucket.total += delta;
  bump(bucket.byState, member.state, delta);
  bump(bucket.daily, dayKey(member.createdAt), delta);
  if (bucket.total <= 0) delete stats.perAssociation[associationId];
  else stats.perAssociation[associationId] = bucket;
}

export function snapshotFromDocs(global: Doc<"dashboard_stats"> | null, associationDocs: Doc<"dashboard_stats">[]) {
  const stats = emptyStats();
  if (!global) return stats;
  stats.total = global.total;
  stats.byState = pairsToRecord(global.byState);
  stats.byAssociation = Object.fromEntries(global.byAssociation.map((row) => [row.id, row.count]));
  stats.daily = Object.fromEntries(global.daily.map((row) => [row.date, row.count]));
  for (const doc of associationDocs) {
    const id = doc.key.startsWith("assoc:") ? doc.key.slice("assoc:".length) : doc.key;
    stats.perAssociation[id] = {
      total: doc.total,
      byState: pairsToRecord(doc.byState),
      daily: Object.fromEntries(doc.daily.map((row) => [row.date, row.count])),
    };
  }
  return stats;
}

export function periodCounts(daily: Record<string, number>, now = Date.now()) {
  const today = dayKey(now);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekStart = todayStart.getTime() - 6 * 24 * 60 * 60 * 1000;
  const monthKey = today.slice(0, 7);

  let todayCount = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  for (const [date, count] of Object.entries(daily)) {
    const ts = new Date(`${date}T00:00:00.000Z`).getTime();
    if (date === today) todayCount += count;
    if (ts >= weekStart) thisWeek += count;
    if (date.startsWith(monthKey)) thisMonth += count;
  }
  return { today: todayCount, thisWeek, thisMonth };
}

async function statsByKey(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("dashboard_stats")
    .withIndex("byKey", (q) => q.eq("key", key))
    .unique();
}

async function saveStatsDoc(
  ctx: MutationCtx,
  key: string,
  data: {
    total: number;
    byState: CountPair[];
    byAssociation: AssociationCount[];
    daily: DailyCount[];
    ready: boolean;
    rebuilding: boolean;
  }
) {
  const existing = await statsByKey(ctx, key);
  const payload = { key, ...data, updatedAt: Date.now() };
  if (existing) await ctx.db.patch(existing._id, payload);
  else await ctx.db.insert("dashboard_stats", payload);
}

export async function writeStatsSnapshot(ctx: MutationCtx, stats: StatsSnapshot) {
  await saveStatsDoc(ctx, GLOBAL_STATS_KEY, {
    total: Math.max(0, stats.total),
    byState: recordToPairs(stats.byState),
    byAssociation: recordToAssociationCounts(stats.byAssociation),
    daily: recordToDaily(stats.daily),
    ready: true,
    rebuilding: false,
  });

  const seen = new Set<string>();
  for (const [associationId, bucket] of Object.entries(stats.perAssociation)) {
    seen.add(associationId);
    await saveStatsDoc(ctx, `assoc:${associationId}`, {
      total: Math.max(0, bucket.total),
      byState: recordToPairs(bucket.byState),
      byAssociation: [],
      daily: recordToDaily(bucket.daily),
      ready: true,
      rebuilding: false,
    });
  }
}

export async function markRebuildStarted(ctx: MutationCtx) {
  const existing = await statsByKey(ctx, GLOBAL_STATS_KEY);
  if (existing) {
    await ctx.db.patch(existing._id, { rebuilding: true, updatedAt: Date.now() });
    return;
  }
  await ctx.db.insert("dashboard_stats", {
    key: GLOBAL_STATS_KEY,
    total: 0,
    byState: [],
    byAssociation: [],
    daily: [],
    ready: false,
    rebuilding: true,
    updatedAt: Date.now(),
  });
}

export async function getGlobalStats(ctx: QueryCtx | MutationCtx) {
  return await statsByKey(ctx, GLOBAL_STATS_KEY);
}

async function patchCountDoc(
  ctx: MutationCtx,
  doc: Doc<"dashboard_stats">,
  member: { associationId: Id<"associations">; state: string; createdAt: number },
  delta: 1 | -1,
  includeAssociation: boolean
) {
  const byState = pairsToRecord(doc.byState);
  const daily = Object.fromEntries(doc.daily.map((row) => [row.date, row.count]));
  const byAssociation = Object.fromEntries(doc.byAssociation.map((row) => [row.id, row.count]));
  bump(byState, member.state, delta);
  bump(daily, dayKey(member.createdAt), delta);
  if (includeAssociation) bump(byAssociation, member.associationId as string, delta);
  await ctx.db.patch(doc._id, {
    total: Math.max(0, doc.total + delta),
    byState: recordToPairs(byState),
    byAssociation: recordToAssociationCounts(byAssociation),
    daily: recordToDaily(daily),
    updatedAt: Date.now(),
  });
}

export async function adjustMemberStats(
  ctx: MutationCtx,
  member: { associationId: Id<"associations">; state: string; createdAt: number },
  delta: 1 | -1
) {
  const global = await getGlobalStats(ctx);
  if (!global?.ready || global.rebuilding) return;

  await patchCountDoc(ctx, global, member, delta, true);

  const associationKey = `assoc:${member.associationId}`;
  const associationDoc = await statsByKey(ctx, associationKey);
  if (associationDoc) {
    await patchCountDoc(ctx, associationDoc, member, delta, false);
    return;
  }
  if (delta < 0) return;
  await ctx.db.insert("dashboard_stats", {
    key: associationKey,
    total: 1,
    byState: [{ name: member.state, count: 1 }],
    byAssociation: [],
    daily: [{ date: dayKey(member.createdAt), count: 1 }],
    ready: true,
    rebuilding: false,
    updatedAt: Date.now(),
  });
}
