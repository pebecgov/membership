"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NIGERIAN_STATES } from "@/lib/nigerianStates";
import { AdminAccessMessage } from "@/components/admin/AdminAccessMessage";
import { DataIssuesPanel } from "@/components/admin/DataIssuesPanel";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MembersTable() {
  const roleResult = useQuery(api.admin.getPortalRole);
  const isAdmin = roleResult?.authorized && roleResult.role === "admin";

  const associationsResult = useQuery(api.admin.listAssociations);
  const associations = associationsResult?.authorized ? associationsResult.associations : [];
  const [search, setSearch] = useState("");
  const [associationId, setAssociationId] = useState<Id<"associations"> | "">("");
  const [state, setState] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deletingId, setDeletingId] = useState<Id<"members"> | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const deleteMember = useMutation(api.admin.deleteMember);

  const fromTs = fromDate ? new Date(fromDate).getTime() : undefined;
  const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : undefined;

  const membersResult = useQuery(api.admin.listMembers, {
    search: search || undefined,
    associationId: associationId || undefined,
    state: state || undefined,
    fromDate: fromTs,
    toDate: toTs,
  });
  const members = membersResult?.authorized ? membersResult.members : [];

  const exportCsv = useMemo(() => {
    if (!members?.length) return "";
    const headers = [
      "Network Member ID",
      "Association Member ID",
      "Full Name",
      "State",
      "Association",
      "Phone",
      "NIN",
      "Registered",
    ];
    const rows = members.map((m) => [
      m.generatedId,
      m.memberIdNumber,
      m.fullName,
      m.state,
      m.associationName,
      m.phone,
      m.nin,
      formatDate(m.createdAt),
    ]);
    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }, [members]);

  function handleExport() {
    if (!exportCsv) return;
    const blob = new Blob([exportCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(memberId: Id<"members">, generatedId: string, fullName: string) {
    if (
      !window.confirm(
        `Delete ${fullName} (${generatedId})? This frees their phone/NIN for a new registration.`
      )
    ) {
      return;
    }

    setDeletingId(memberId);
    setDeleteError("");
    try {
      await deleteMember({ memberId });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete member.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {membersResult && !membersResult.authorized && (
        <AdminAccessMessage reason={membersResult.reason} />
      )}

      {isAdmin && <DataIssuesPanel />}

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Someone stuck on &quot;already registered&quot;? Search their phone or NIN below and delete
          the old test record so they can register again.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0A1121] sm:text-lg">Member registry</h2>
            <p className="text-sm text-slate-500">Filter and export registered members</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!members?.length}
            className="w-full rounded-md border border-[#0A1121] px-4 py-2 text-sm font-medium text-[#0A1121] transition hover:bg-slate-50 disabled:opacity-40 sm:w-auto"
          >
            Export CSV
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <input
            className={inputClass}
            placeholder="Search name, ID, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={inputClass}
            value={associationId}
            onChange={(e) => setAssociationId(e.target.value as Id<"associations"> | "")}
          >
            <option value="">All associations</option>
            {associations?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className={inputClass} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            className={inputClass}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            className={inputClass}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {deleteError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {membersResult === undefined ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400 sm:px-5">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400 sm:px-5">
            No members match your filters.
          </p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {members.map((member) => (
                <div key={member.id} className="space-y-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-[#0A1121]">{member.generatedId}</p>
                    {member.memberIdNumber && (
                      <p className="shrink-0 font-mono text-[10px] text-slate-500">{member.memberIdNumber}</p>
                    )}
                  </div>
                  <p className="font-medium text-slate-800">{member.fullName}</p>
                  <p className="text-sm text-slate-600">{member.associationName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{member.state}</span>
                    <span>{member.phone}</span>
                    <span className="font-mono">NIN {member.nin}</span>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(member.createdAt)}</p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id, member.generatedId, member.fullName)}
                      disabled={deletingId === member.id}
                      className="mt-1 w-full rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                    >
                      {deletingId === member.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Network ID</th>
                    <th className="px-4 py-3 font-semibold">Association ID</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Association</th>
                    <th className="px-4 py-3 font-semibold">State</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">NIN</th>
                    <th className="px-4 py-3 font-semibold">Registered</th>
                    {isAdmin && <th className="px-4 py-3 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0A1121]">
                        {member.generatedId}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {member.memberIdNumber || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{member.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">{member.associationName}</td>
                      <td className="px-4 py-3 text-slate-600">{member.state}</td>
                      <td className="px-4 py-3 text-slate-600">{member.phone}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{member.nin}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(member.createdAt)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(member.id, member.generatedId, member.fullName)
                            }
                            disabled={deletingId === member.id}
                            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === member.id ? "Deleting…" : "Delete"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {membersResult && membersResult.authorized && (
          <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            Showing {members.length} member{members.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A1121] outline-none focus:border-[#0A1121] focus:ring-1 focus:ring-[#0A1121]";
