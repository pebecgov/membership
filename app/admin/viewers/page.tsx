"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ViewerAccessManager } from "@/components/admin/ViewerAccessManager";
import { api } from "@/convex/_generated/api";

export default function AdminViewersPage() {
  const router = useRouter();
  const roleResult = useQuery(api.admin.getPortalRole);
  const isViewer = roleResult?.authorized && roleResult.role === "viewer";

  useEffect(() => {
    if (isViewer) {
      router.replace("/admin");
    }
  }, [isViewer, router]);

  if (roleResult === undefined || isViewer) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0A1121] sm:text-2xl">Viewer access</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose which association members each viewer account can see
        </p>
      </div>
      <ViewerAccessManager />
    </div>
  );
}
