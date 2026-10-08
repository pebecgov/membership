"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BUSINESS_SECTORS } from "@/lib/businessSectors";
import { LOCAL_GOVERNMENTS, localGovernmentsFor } from "@/lib/nigerianLgas";
import { NIGERIAN_STATES } from "@/lib/nigerianStates";

type Coverage = Record<string, string[]>;

export function PrivateSectorForm() {
  const submit = useMutation(api.privateSector.submit);
  const settings = useQuery(api.privateSector.getFormSettings);
  const showSectors = settings?.showSectors ?? false;
  const [organizationName, setOrganizationName] = useState("");
  const [focalPerson, setFocalPerson] = useState("");
  const [cac, setCac] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [activeState, setActiveState] = useState("");
  const [coverage, setCoverage] = useState<Coverage>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    organizationName: string;
    stateCount: number;
    lgaCount: number;
  } | null>(null);

  const activeLgas = activeState ? localGovernmentsFor(activeState) : [];
  const selectedForActive = activeState ? coverage[activeState] ?? [] : [];
  const savedStates = useMemo(
    () =>
      NIGERIAN_STATES.filter((state) => (coverage[state]?.length ?? 0) > 0).map((state) => ({
        state,
        selected: coverage[state].length,
        total: LOCAL_GOVERNMENTS[state].length,
      })),
    [coverage]
  );
  const totalLgas = savedStates.reduce((sum, entry) => sum + entry.selected, 0);

  function setStateSelection(state: string, lgas: string[]) {
    setCoverage((current) => {
      const next = { ...current };
      if (lgas.length === 0) delete next[state];
      else next[state] = lgas;
      return next;
    });
  }

  function toggleSector(sector: string) {
    setSectors((current) =>
      current.includes(sector) ? current.filter((item) => item !== sector) : [...current, sector]
    );
  }

  function toggleLga(lga: string) {
    if (!activeState) return;
    const selected = new Set(selectedForActive);
    if (selected.has(lga)) selected.delete(lga);
    else selected.add(lga);
    setStateSelection(activeState, [...selected]);
  }

  function removeState(state: string) {
    setCoverage((current) => {
      const next = { ...current };
      delete next[state];
      return next;
    });
    if (activeState === state) setActiveState("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (savedStates.length === 0) {
      setError("Select at least one state and the local governments you cover.");
      return;
    }

    if (showSectors && sectors.length === 0) {
      setError("Select at least one sector.");
      return;
    }

    setLoading(true);
    try {
      const result = await submit({
        organizationName,
        focalPerson,
        cac,
        phone,
        email,
        coverage: savedStates.map((entry) => ({
          state: entry.state,
          lgas: coverage[entry.state],
        })),
        sectors: showSectors ? sectors : [],
      });
      setSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the form.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-8">
        <p className="text-sm font-medium text-slate-500">Submission received</p>
        <h2 className="mt-2 text-2xl font-bold text-[#0A1121]">{success.organizationName}</h2>
        <p className="mt-4 text-sm text-slate-600">
          Coverage recorded for {success.stateCount} state{success.stateCount === 1 ? "" : "s"} and{" "}
          {success.lgaCount} local government{success.lgaCount === 1 ? "" : "s"}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0A1121]">Private Sector Engagement</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tell us where your organization operates. Choose one state at a time, then select the
          local governments you cover.
        </p>
      </div>

      <div className="space-y-5">
        <Field label="Name of organization">
          <input
            className={inputClass}
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="Registered organization name"
            required
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Focal person">
            <input
              className={inputClass}
              value={focalPerson}
              onChange={(e) => setFocalPerson(e.target.value)}
              placeholder="Primary contact name"
              required
            />
          </Field>
          <Field label="CAC">
            <input
              className={inputClass}
              value={cac}
              onChange={(e) => setCac(e.target.value.toUpperCase())}
              placeholder="e.g. RC123456"
              required
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone number">
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="0800 000 0000"
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="Email of organization">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.com"
              required
            />
          </Field>
        </div>

        {showSectors && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#0A1121]">Sectors</p>
              <p className="text-xs text-slate-500">
                {sectors.length} selected
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUSINESS_SECTORS.map((sector) => {
                const checked = sectors.includes(sector);
                return (
                  <label
                    key={sector}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm ${
                      checked
                        ? "border-[#0A1121] bg-white"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSector(sector)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0A1121] focus:ring-[#0A1121]"
                    />
                    <span className="text-slate-800">{sector}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Field label="State">
              <select
                className={inputClass}
                value={activeState}
                onChange={(e) => setActiveState(e.target.value)}
              >
                <option value="">Select a state</option>
                {NIGERIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                    {(coverage[state]?.length ?? 0) > 0
                      ? ` · ${coverage[state].length} selected`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            {activeState && (
              <p className="pb-2 text-sm font-semibold text-[#0A1121]">
                {selectedForActive.length} of {activeLgas.length} local governments covered
              </p>
            )}
          </div>

          {activeState && (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStateSelection(activeState, [...activeLgas])}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setStateSelection(activeState, [])}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeLgas.map((lga) => {
                  const checked = selectedForActive.includes(lga);
                  return (
                    <label
                      key={lga}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm ${
                        checked
                          ? "border-[#0A1121] bg-white"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLga(lga)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0A1121] focus:ring-[#0A1121]"
                      />
                      <span className="text-slate-800">{lga}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {savedStates.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-[#0A1121]">
              Coverage so far · {savedStates.length} state{savedStates.length === 1 ? "" : "s"} ·{" "}
              {totalLgas} local government{totalLgas === 1 ? "" : "s"}
            </p>
            <ul className="mt-3 space-y-2">
              {savedStates.map((entry) => (
                <li
                  key={entry.state}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-800">{entry.state}</p>
                    <p className="text-xs text-slate-500">
                      {entry.selected} of {entry.total} local governments covered
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveState(entry.state)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeState(entry.state)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={loading || settings === undefined} className={btnPrimary}>
          {loading ? "Submitting…" : "Submit engagement"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <label className="mb-1.5 block text-sm font-semibold text-[#0A1121]">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0A1121] placeholder:text-slate-400 outline-none transition focus:border-[#0A1121] focus:ring-1 focus:ring-[#0A1121]";

const btnPrimary =
  "flex w-full items-center justify-center gap-2 rounded-md bg-[#0A1121] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2235] disabled:cursor-not-allowed disabled:opacity-50";
