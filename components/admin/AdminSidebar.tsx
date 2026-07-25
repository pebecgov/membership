"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/associations", label: "Associations" },
];

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function SidebarContent({
  role,
  pathname,
  onNavigate,
}: {
  role: "admin" | "viewer" | null;
  pathname: string;
  onNavigate?: () => void;
}) {
  const title = role === "viewer" ? "Viewer Portal" : "Admin Portal";
  const subtitle = role === "viewer" ? "Read-only access" : "Member registrations";

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-5">
        <div className="min-w-0">
          <Link href="/admin" className="text-lg font-bold text-[#0A1121]" onClick={onNavigate}>
            {title}
          </Link>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          {role && (
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                role === "admin" ? "bg-[#0A1121] text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {role}
            </span>
          )}
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`block rounded-md px-3 py-2.5 text-sm font-medium transition ${
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

      <div className="border-t border-slate-200 px-5 py-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="mb-4 block text-xs text-slate-500 hover:text-[#0A1121]"
        >
          ← Back to public site
        </Link>
        <UserButton />
      </div>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const roleResult = useQuery(api.admin.getPortalRole);
  const role = roleResult?.authorized ? roleResult.role : null;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const portalTitle = role === "viewer" ? "Viewer Portal" : "Admin Portal";

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-md p-2 text-[#0A1121] hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </button>
        <p className="truncate text-sm font-semibold text-[#0A1121]">{portalTitle}</p>
        <UserButton />
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(100%,18rem)] flex-col bg-white shadow-xl">
            <SidebarContent
              role={role}
              pathname={pathname}
              onNavigate={() => setMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:min-h-[calc(100vh-0px)]">
        <SidebarContent role={role} pathname={pathname} />
      </aside>
    </>
  );
}
