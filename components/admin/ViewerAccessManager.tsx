"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AdminAccessMessage } from "@/components/admin/AdminAccessMessage";

export function ViewerAccessManager() {
  const result = useQuery(api.viewers.listViewerAssignments);
  const setViewerAssociations = useMutation(api.viewers.setViewerAssociations);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Id<"associations">[]>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (result === undefined) {
    return <p className="text-sm text-slate-500">Loading viewer access…</p>;
  }

  if (!result.authorized) {
    return <AdminAccessMessage reason="forbidden" />;
  }

  function getDraft(email: string, current: Id<"associations">[]) {
    return drafts[email] ?? current;
  }

  function toggleAssociation(email: string, current: Id<"associations">[], associationId: Id<"associations">) {
    const selected = new Set(getDraft(email, current));
    if (selected.has(associationId)) {
      selected.delete(associationId);
    } else {
      selected.add(associationId);
    }
    setDrafts((prev) => ({ ...prev, [email]: [...selected] }));
    setSuccess("");
    setError("");
  }

  async function handleSave(email: string, current: Id<"associations">[]) {
    setSavingEmail(email);
    setError("");
    setSuccess("");
    try {
      await setViewerAssociations({
        email,
        associationIds: getDraft(email, current),
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[email];
        return next;
      });
      setSuccess(`Saved access for ${email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save viewer access.");
    } finally {
      setSavingEmail(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Viewer emails must first be added to <code className="rounded bg-white px-1">VIEWER_EMAILS</code>{" "}
        in the Convex dashboard. Then choose which associations each viewer can see in the members
        list and dashboard.
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
      )}

      {result.viewers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No viewer emails configured yet. Add addresses to{" "}
          <code className="rounded bg-slate-100 px-1">VIEWER_EMAILS</code> in Convex.
        </div>
      ) : (
        result.viewers.map((viewer) => {
          const selectedIds = getDraft(viewer.email, viewer.associationIds);
          const hasChanges =
            selectedIds.length !== viewer.associationIds.length ||
            selectedIds.some((id) => !viewer.associationIds.includes(id));

          return (
            <div
              key={viewer.email}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-[#0A1121]">{viewer.email}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedIds.length === 0
                      ? "No associations assigned — viewer will see an empty portal."
                      : `${selectedIds.length} association${selectedIds.length === 1 ? "" : "s"} selected`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(viewer.email, viewer.associationIds)}
                  disabled={savingEmail === viewer.email || !hasChanges}
                  className="w-full rounded-md bg-[#0A1121] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2235] disabled:opacity-50 sm:w-auto"
                >
                  {savingEmail === viewer.email ? "Saving…" : "Save access"}
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.associations.map((assoc) => {
                  const checked = selectedIds.includes(assoc.id);
                  return (
                    <label
                      key={assoc.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
                        checked
                          ? "border-[#0A1121] bg-slate-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleAssociation(viewer.email, viewer.associationIds, assoc.id)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#0A1121] focus:ring-[#0A1121]"
                      />
                      <span>
                        <span className="font-medium text-slate-800">{assoc.name}</span>
                        <span className="ml-2 font-mono text-xs text-slate-500">{assoc.code}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
