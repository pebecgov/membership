"use client";

import { AssociationsManager } from "@/components/admin/AssociationsManager";

export default function AdminAssociationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A1121]">Associations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add professional associations and logos for the registration form
        </p>
      </div>
      <AssociationsManager />
    </div>
  );
}
