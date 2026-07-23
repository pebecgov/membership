"use client";

import { useQuery } from "convex/react";
import { AssociationsManager } from "@/components/admin/AssociationsManager";
import { api } from "@/convex/_generated/api";

export default function AdminAssociationsPage() {
  const roleResult = useQuery(api.admin.getPortalRole);
  const isViewer = roleResult?.authorized && roleResult.role === "viewer";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A1121]">Associations</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isViewer
            ? "View registered professional associations and member counts"
            : "Add professional associations and logos for the registration form"}
        </p>
      </div>
      <AssociationsManager />
    </div>
  );
}
