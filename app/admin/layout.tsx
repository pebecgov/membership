"use client";

import { SignIn } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-0px)] flex-1 items-center justify-center bg-[#F8F9FB]">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-0px)] flex-1 items-center justify-center bg-[#F8F9FB] px-4">
        <SignIn routing="hash" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-0px)] flex-1 bg-[#F8F9FB]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
