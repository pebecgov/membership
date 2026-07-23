"use client";

import { MembersTable } from "@/components/admin/MembersTable";

export default function AdminMembersPage() {
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
