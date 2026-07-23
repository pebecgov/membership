"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AdminAccessMessage } from "@/components/admin/AdminAccessMessage";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0A1121] placeholder:text-slate-400 outline-none transition focus:border-[#0A1121] focus:ring-1 focus:ring-[#0A1121]";

export function AssociationsManager() {
  const result = useQuery(api.admin.listAssociations);
  const createAssociation = useMutation(api.admin.createAssociation);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await createAssociation({ name, code, logoUrl });
      setName("");
      setCode("");
      setLogoUrl("");
      setSuccess("Association added successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add association.");
    } finally {
      setLoading(false);
    }
  }

  if (result === undefined) {
    return <p className="text-sm text-slate-500">Loading associations…</p>;
  }

  if (!result.authorized) {
    return <AdminAccessMessage reason={result.reason} />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0A1121]">Add association</h2>
        <p className="mt-1 text-sm text-slate-500">
          New associations appear in the public registration dropdown immediately.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#0A1121]">
                Name
              </label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NACCIMA"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#0A1121]">
                Code
              </label>
              <input
                className={inputClass}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. NACCIMA"
                required
              />
              <p className="mt-1 text-xs text-slate-400">Used in generated IDs</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#0A1121]">
              Logo URL
            </label>
            <input
              className={inputClass}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              type="url"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              Public HTTPS image URL (PNG/SVG, ~120×120px or larger)
            </p>
          </div>

          {logoUrl && (
            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-white">
                <Image
                  src={logoUrl}
                  alt="Logo preview"
                  fill
                  className="object-contain p-1"
                  unoptimized
                  onError={() => {}}
                />
              </div>
              <p className="text-xs text-slate-500">Logo preview</p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[#0A1121] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2235] disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add association"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0A1121]">
            All associations ({result.associations.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Logo</th>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-5 py-3 font-semibold">Members</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.associations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No associations yet. Add one above.
                  </td>
                </tr>
              ) : (
                result.associations.map((assoc) => (
                  <tr key={assoc.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-md bg-slate-50">
                        <Image
                          src={assoc.logoUrl}
                          alt={assoc.name}
                          fill
                          className="object-contain p-0.5"
                          unoptimized
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">{assoc.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{assoc.code}</td>
                    <td className="px-5 py-3 text-slate-600">{assoc.memberCount}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          assoc.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {assoc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
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
