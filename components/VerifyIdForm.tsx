"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VerifyIdForm() {
  const [memberId, setMemberId] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const result = useQuery(
    api.members.verifyMember,
    submittedId ? { memberId: submittedId } : "skip"
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedId(memberId.trim());
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-8 py-10 shadow-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#0A1121]">Verify ID</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your network member ID or association member ID to confirm registration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#0A1121]">Member ID</label>
          <input
            className={inputClass}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value.toUpperCase())}
            placeholder="e.g. NAC-LAG-123456"
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Use your network member ID or your association&apos;s member ID
          </p>
        </div>

        <button type="submit" className={btnPrimary}>
          Verify ID
        </button>
      </form>

      {submittedId && result === undefined && (
        <p className="mt-6 text-center text-sm text-slate-500">Checking registration…</p>
      )}

      {result?.status === "not_found" && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          No registration found for <span className="font-mono font-medium">{submittedId}</span>.
        </div>
      )}

      {result?.status === "ambiguous" && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          Multiple members share this association ID. Please use your network member ID instead.
        </div>
      )}

      {result?.status === "found" && result.member && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-6">
          <div className="flex flex-col items-center text-center">
            {result.member.associationLogoUrl && (
              <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white">
                <Image
                  src={result.member.associationLogoUrl}
                  alt={result.member.associationName}
                  width={64}
                  height={64}
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <p className="text-sm font-semibold text-emerald-800">✓ Verified registration</p>
            <p className="mt-2 font-mono text-lg font-bold text-[#0A1121]">
              {result.member.generatedId}
            </p>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-slate-500">Full name</dt>
              <dd className="font-medium text-slate-800">{result.member.fullName}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-slate-500">Association</dt>
              <dd className="font-medium text-slate-800">{result.member.associationName}</dd>
            </div>
            {result.member.memberIdNumber && (
              <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
                <dt className="text-slate-500">Association ID</dt>
                <dd className="font-mono font-medium text-slate-800">
                  {result.member.memberIdNumber}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-slate-500">State</dt>
              <dd className="font-medium text-slate-800">{result.member.state}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Registered</dt>
              <dd className="text-slate-700">{formatDate(result.member.createdAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0A1121] placeholder:text-slate-400 outline-none transition focus:border-[#0A1121] focus:ring-1 focus:ring-[#0A1121]";

const btnPrimary =
  "flex w-full items-center justify-center rounded-md bg-[#0A1121] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2235]";
