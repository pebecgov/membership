"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/associations", label: "Associations" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const roleResult = useQuery(api.admin.getPortalRole);
  const role = roleResult?.authorized ? roleResult.role : null;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <Link href="/admin" className="text-lg font-bold text-[#0A1121]">
          {role === "viewer" ? "Viewer Portal" : "Admin Portal"}
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          {role === "viewer" ? "Read-only access" : "Member registrations"}
        </p>
        {role && (
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              role === "admin"
                ? "bg-[#0A1121] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {role}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[#0A1121] text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[#0A1121]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-6 py-4">
        <Link href="/" className="mb-4 block text-xs text-slate-500 hover:text-[#0A1121]">
          ← Back to public site
        </Link>
        <UserButton />
      </div>
    </aside>
  );
}
