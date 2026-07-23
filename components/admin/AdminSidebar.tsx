"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/associations", label: "Associations" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <Link href="/admin" className="text-lg font-bold text-[#0A1121]">
          Admin Portal
        </Link>
        <p className="mt-1 text-xs text-slate-500">Member registrations</p>
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
