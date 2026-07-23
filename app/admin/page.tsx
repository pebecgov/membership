"use client";

import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
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

  if (dashboard === undefined) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (!dashboard.authorized) {
    return <AdminAccessMessage reason={dashboard.reason} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A1121]">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of member registrations and association activity
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 xl:grid-cols-2">
        <BarChart title="By association" items={dashboard.byAssociation} />
        <BarChart title="By state" items={dashboard.byState} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0A1121]">Recent registrations</h2>
        </div>
        <div className="overflow-x-auto">
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
              {dashboard.recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No registrations yet
                  </td>
                </tr>
              ) : (
                dashboard.recent.map((member) => (
                  <tr key={member.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-mono text-xs font-semibold">{member.generatedId}</td>
                    <td className="px-5 py-3">{member.fullName}</td>
                    <td className="px-5 py-3 text-slate-600">{member.associationName}</td>
                    <td className="px-5 py-3 text-slate-600">{member.state}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(member.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
