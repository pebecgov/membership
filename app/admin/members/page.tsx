"use client";

import { SignIn } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { MembersTable } from "@/components/admin/MembersTable";

export default function AdminMembersPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <SignIn routing="hash" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A1121]">Members</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search, filter, and export all registered members
        </p>
      </div>
      <MembersTable />
    </div>
  );
}
