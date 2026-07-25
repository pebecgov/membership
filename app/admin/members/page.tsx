"use client";

import { MembersTable } from "@/components/admin/MembersTable";

export default function AdminMembersPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0A1121] sm:text-2xl">Members</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search, filter, and export all registered members
        </p>
      </div>
      <MembersTable />
    </div>
  );
}
