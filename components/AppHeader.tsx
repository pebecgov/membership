"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";

export function AppHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/sign-in")) {
    return null;
  }
  const active = pathname === "/verify" ? "verify" : "register";
  return <Header active={active} />;
}
