"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DataIssuesPanel() {
  const issuesResult = useQuery(api.admin.listDataIssues);
  const deleteMember = useMutation(api.admin.deleteMember);
  const [deletingId, setDeletingId] = useState<Id<"members"> | null>(null);
  const [error, setError] = useState("");

  if (issuesResult === undefined) return null;
  if (!issuesResult.authorized || issuesResult.issues.length === 0) return null;

  async function handleDelete(memberId: Id<"members">, generatedId: string) {
    if (
      !window.confirm(
        `Delete registration ${generatedId}? This frees the phone/NIN for a fresh registration.`
      )
    ) {
      return;
    }

    setDeletingId(memberId);
    setError("");
    try {
      await deleteMember({ memberId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete member.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-amber-900">Duplicate data issues</h2>
      <p className="mt-1 text-sm text-amber-800">
        These records share the same phone, NIN, or ID among the most recent registrations and can
        block new signups. Delete mistaken or test entries to allow a fresh signup.
      </p>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 space-y-4">
        {issuesResult.issues.map((issue) => (
          <div key={`${issue.type}-${issue.label}`} className="rounded-md border border-amber-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {issue.label}
            </p>
            <ul className="mt-3 space-y-2">
              {issue.members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 rounded-md bg-slate-50 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono font-semibold text-[#0A1121]">{member.generatedId}</p>
                    <p className="text-slate-600">
                      {member.fullName} · {member.associationName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {member.phone} · NIN {member.nin} · {formatDate(member.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(member.id, member.generatedId)}
                    disabled={deletingId === member.id}
                    className="w-full shrink-0 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:w-auto sm:py-1.5"
                  >
                    {deletingId === member.id ? "Deleting…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
