"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AdminAccessMessage } from "@/components/admin/AdminAccessMessage";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminPrivateSectorPage() {
  const router = useRouter();
  const roleResult = useQuery(api.admin.getPortalRole);
  const result = useQuery(api.privateSector.list);
  const settings = useQuery(api.privateSector.getFormSettings);
  const setShowSectors = useMutation(api.privateSector.setShowSectors);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);
  const [toggleError, setToggleError] = useState("");
  const isViewer = roleResult?.authorized && roleResult.role === "viewer";

  useEffect(() => {
    if (isViewer) router.replace("/admin");
  }, [isViewer, router]);

  if (roleResult === undefined || isViewer || result === undefined) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (!result.authorized) {
    return <AdminAccessMessage reason={result.reason} />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0A1121] sm:text-2xl">Private sector</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organizations and the local governments they cover, state by state
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-semibold text-[#0A1121]">Sector checkboxes</p>
          <p className="mt-1 text-sm text-slate-500">
            {settings?.showSectors
              ? "Organizations can select the sectors they work in."
              : "The sector section is hidden on the public form."}
          </p>
        </div>
        <button
          type="button"
          disabled={savingToggle || settings === undefined}
          onClick={async () => {
            if (!settings) return;
            setSavingToggle(true);
            setToggleError("");
            try {
              await setShowSectors({ showSectors: !settings.showSectors });
            } catch (error) {
              setToggleError(error instanceof Error ? error.message : "Could not update the setting.");
            } finally {
              setSavingToggle(false);
            }
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
            settings?.showSectors ? "bg-amber-700 hover:bg-amber-800" : "bg-[#0A1121] hover:bg-[#1a2235]"
          }`}
        >
          {savingToggle ? "Saving…" : settings?.showSectors ? "Hide sector section" : "Show sector section"}
        </button>
      </div>
      {toggleError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{toggleError}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {result.engagements.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No submissions yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {result.engagements.map((entry) => {
              const open = openId === entry.id;
              return (
                <li key={entry.id} className="px-4 py-4 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-start sm:justify-between"
                  >
                    <span>
                      <span className="block font-semibold text-[#0A1121]">
                        {entry.organizationName}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {entry.focalPerson} · {entry.cac}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {entry.email} · {entry.phone}
                      </span>
                      {entry.sectors.length > 0 && (
                        <span className="mt-1 block text-xs text-slate-500">
                          Sectors: {entry.sectors.join(", ")}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-slate-600">
                      {entry.stateCount} state{entry.stateCount === 1 ? "" : "s"} · {entry.lgaCount}{" "}
                      LGAs
                      <span className="mt-1 block text-xs text-slate-400">
                        {formatDate(entry.createdAt)}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <ul className="mt-3 space-y-2">
                      {entry.coverage.map((row) => (
                        <li key={row.state} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                          <p className="font-medium text-slate-800">
                            {row.state} · {row.lgas.length} local government
                            {row.lgas.length === 1 ? "" : "s"}
                          </p>
                          <p className="mt-1 text-slate-600">{row.lgas.join(", ")}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
