"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NIGERIAN_STATES } from "@/lib/nigerianStates";
import { buildMemberId } from "@/lib/memberId";

type Step = "form" | "success";

function IdCardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h.01" />
      <path d="M11 15h6" />
    </svg>
  );
}

export function RegistrationForm() {
  const associations = useQuery(api.associations.listActive);
  const register = useMutation(api.members.register);

  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [memberIdNumber, setMemberIdNumber] = useState("");
  const [associationId, setAssociationId] = useState<Id<"associations"> | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    generatedId: string;
    memberIdNumber: string;
    associationName: string;
    associationLogoUrl: string;
  } | null>(null);

  const selectedAssociation = associations?.find((assoc) => assoc._id === associationId);
  const previewMemberId =
    selectedAssociation && state && nin.length === 11
      ? buildMemberId({
          associationName: selectedAssociation.name,
          state,
          nin,
        })
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!associationId) {
      setError("Select your professional association.");
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        fullName,
        state,
        phone,
        nin,
        memberIdNumber,
        associationId,
      });
      setSuccess({
        generatedId: result.generatedId,
        memberIdNumber: result.memberIdNumber,
        associationName: result.associationName,
        associationLogoUrl: result.associationLogoUrl,
      });
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success" && success) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-50">
          <Image
            src={success.associationLogoUrl}
            alt={success.associationName}
            width={64}
            height={64}
            className="object-contain"
            unoptimized
          />
        </div>
        <p className="text-sm font-medium text-slate-500">Registration complete</p>
        <h2 className="mt-2 text-2xl font-bold text-[#0A1121]">Your Network Member ID</h2>
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 font-mono text-lg font-semibold text-[#0A1121]">
          {success.generatedId}
        </p>
        <p className="mt-4 text-sm text-slate-600">
          {success.associationName} · {fullName} · {state}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Association member ID:{" "}
          <span className="font-mono font-medium">{success.memberIdNumber}</span>
        </p>
        <p className="mt-6 text-xs text-slate-400">
          Save this ID. You can verify it anytime on the Verify ID page.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white px-8 py-10 shadow-sm"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0A1121]">Member Registration</h1>
        <p className="mt-2 text-sm text-slate-500">
          Complete your enrollment in the national association network.
        </p>
      </div>

      <div className="space-y-5">
        <Field label="Full Name">
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full legal name"
            required
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="State">
            <select
              className={inputClass}
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
            >
              <option value="">Select State</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Phone Number">
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="0800 000 0000"
              inputMode="numeric"
              required
            />
          </Field>
        </div>

        <Field label="National Identification Number (NIN)">
          <input
            className={inputClass}
            value={nin}
            onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="11-digit NIN"
            inputMode="numeric"
            required
          />
        </Field>

        <Field label="Professional Association">
          {associations === undefined ? (
            <p className="text-sm text-slate-400">Loading associations…</p>
          ) : associations.length === 0 ? (
            <p className="text-sm text-amber-700">
              No associations yet. Run{" "}
              <code className="rounded bg-slate-100 px-1">
                npx convex run associations:seed
              </code>
            </p>
          ) : (
            <select
              className={inputClass}
              value={associationId}
              onChange={(e) =>
                setAssociationId(e.target.value as Id<"associations"> | "")
              }
              required
            >
              <option value="">Select Association</option>
              {associations.map((assoc) => (
                <option key={assoc._id} value={assoc._id}>
                  {assoc.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Association Member ID">
          <input
            className={inputClass}
            value={memberIdNumber}
            onChange={(e) => setMemberIdNumber(e.target.value.toUpperCase())}
            placeholder="Enter your ID from your association"
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            The member ID issued to you by your professional association
          </p>
        </Field>

        {previewMemberId && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Your network member ID
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-[#0A1121]">
              {previewMemberId}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Generated from association, state, and the last 7 digits of your NIN. Assigned on
              submit after duplicate checks.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={loading} className={btnPrimary}>
          <span>{loading ? "Processing…" : "Generate My ID"}</span>
          {!loading && <IdCardIcon />}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#0A1121]">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0A1121] placeholder:text-slate-400 outline-none transition focus:border-[#0A1121] focus:ring-1 focus:ring-[#0A1121]";

const btnPrimary =
  "flex w-full items-center justify-center gap-2 rounded-md bg-[#0A1121] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2235] disabled:cursor-not-allowed disabled:opacity-50";
