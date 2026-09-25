"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarChart } from "@/components/admin/BarChart";
import { DailyChart } from "@/components/admin/DailyChart";
import { StatCard } from "@/components/admin/StatCard";
import { AdminAccessMessage } from "@/components/admin/AdminAccessMessage";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminDashboardPage() {
  const { isAuthenticated } = useConvexAuth();
  const dashboard = useQuery(api.admin.getDashboard, isAuthenticated ? {} : "skip");
  const roleResult = useQuery(api.admin.getPortalRole, isAuthenticated ? {} : "skip");
  const startRebuild = useMutation(api.admin.startStatsRebuild);
  const rebuildStarted = useRef(false);

  useEffect(() => {
    if (!dashboard?.authorized || !dashboard.needsRebuild || rebuildStarted.current) return;
    rebuildStarted.current = true;
    void startRebuild({});
  }, [dashboard, startRebuild]);
  const viewerHasNoAccess =
    roleResult?.authorized &&
    roleResult.role === "viewer" &&
    "associationIds" in roleResult &&
    roleResult.associationIds.length === 0;

  if (dashboard === undefined) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (!dashboard.authorized) {
    return <AdminAccessMessage reason={dashboard.reason} />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0A1121] sm:text-2xl">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {roleResult?.authorized && roleResult.role === "viewer"
            ? "Overview for your assigned associations"
            : "Overview of member registrations and association activity"}
        </p>
      </div>

      {viewerHasNoAccess && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your viewer account does not have any associations assigned yet. Ask an admin to grant
          access from the Viewer access page.
        </div>
      )}

      {dashboard.needsRebuild && (
        <p className="text-sm text-slate-500">Calculating totals from existing registrations…</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total members" value={dashboard.totals.all} />
        <StatCard label="Today" value={dashboard.totals.today} hint="Registrations today" />
        <StatCard label="This week" value={dashboard.totals.thisWeek} />
        <StatCard
          label="Active associations"
          value={dashboard.totals.associations}
          hint={`${dashboard.totals.thisMonth} this month`}
        />
      </div>

      <DailyChart data={dashboard.dailyRegistrations} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="By association" items={dashboard.byAssociation} />
        <BarChart title="By state" items={dashboard.byState} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[#0A1121]">Recent registrations</h2>
        </div>

        {dashboard.recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400 sm:px-5">No registrations yet</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {dashboard.recent.map((member) => (
                <div key={member.id} className="space-y-2 px-4 py-4">
                  <p className="font-mono text-xs font-semibold text-[#0A1121]">{member.generatedId}</p>
                  <p className="font-medium text-slate-800">{member.fullName}</p>
                  <p className="text-sm text-slate-600">{member.associationName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{member.state}</span>
                    <span>{formatDate(member.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Member ID</th>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Association</th>
                    <th className="px-5 py-3 font-semibold">State</th>
                    <th className="px-5 py-3 font-semibold">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent.map((member) => (
                    <tr key={member.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{member.generatedId}</td>
                      <td className="px-5 py-3">{member.fullName}</td>
                      <td className="px-5 py-3 text-slate-600">{member.associationName}</td>
                      <td className="px-5 py-3 text-slate-600">{member.state}</td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(member.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
