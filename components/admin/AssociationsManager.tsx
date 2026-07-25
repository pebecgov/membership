"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AdminAccessMessage } from "@/components/admin/AdminAccessMessage";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0A1121] placeholder:text-slate-400 outline-none transition focus:border-[#0A1121] focus:ring-1 focus:ring-[#0A1121]";

const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function uploadLogoFile(
  file: File,
  generateUploadUrl: () => Promise<string>
): Promise<Id<"_storage">> {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new Error("Logo must be a PNG, JPG, WebP, or SVG image.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be 2MB or smaller.");
  }

  const postUrl = await generateUploadUrl();
  const response = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Logo upload failed. Please try again.");
  }

  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}

export function AssociationsManager() {
  const result = useQuery(api.admin.listAssociations);
  const createAssociation = useMutation(api.admin.createAssociation);
  const generateLogoUploadUrl = useMutation(api.files.generateLogoUploadUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      return;
    }

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setError("Logo must be a PNG, JPG, WebP, or SVG image.");
      setLogoFile(null);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be 2MB or smaller.");
      setLogoFile(null);
      e.target.value = "";
      return;
    }

    setLogoFile(file);
  }

  function resetForm() {
    setName("");
    setCode("");
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!logoFile) {
      setError("Please upload an association logo.");
      return;
    }

    setLoading(true);
    try {
      const logoStorageId = await uploadLogoFile(logoFile, () => generateLogoUploadUrl());
      await createAssociation({ name, code, logoStorageId });
      resetForm();
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

  const isAdmin = result.role === "admin";

  return (
    <div className="space-y-6">
      {isAdmin && (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-[#0A1121] sm:text-lg">Add association</h2>
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
              Logo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_LOGO_TYPES.join(",")}
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-[#0A1121] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#1a2235]"
              required={!logoFile}
            />
            <p className="mt-1 text-xs text-slate-400">
              PNG, JPG, WebP, or SVG · max 2MB · square logos work best (~120×120px)
            </p>
          </div>

          {logoPreviewUrl && (
            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-white">
                <Image
                  src={logoPreviewUrl}
                  alt="Logo preview"
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Logo preview</p>
                <p className="text-xs text-slate-500">{logoFile?.name}</p>
              </div>
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
            {loading ? "Uploading…" : "Add association"}
          </button>
        </form>
      </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[#0A1121]">
            All associations ({result.associations.length})
          </h2>
        </div>

        {result.associations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400 sm:px-5">
            No associations yet.{isAdmin ? " Add one above." : ""}
          </p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {result.associations.map((assoc) => (
                <div key={assoc.id} className="flex items-center gap-3 px-4 py-4">
                  {assoc.logoUrl ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-50">
                      <Image
                        src={assoc.logoUrl}
                        alt={assoc.name}
                        fill
                        className="object-contain p-0.5"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-400">
                      No logo
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{assoc.name}</p>
                    <p className="font-mono text-xs text-slate-500">{assoc.code}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-600">{assoc.memberCount} members</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          assoc.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {assoc.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
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
                  {result.associations.map((assoc) => (
                    <tr key={assoc.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        {assoc.logoUrl ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-md bg-slate-50">
                            <Image
                              src={assoc.logoUrl}
                              alt={assoc.name}
                              fill
                              className="object-contain p-0.5"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No logo</span>
                        )}
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
