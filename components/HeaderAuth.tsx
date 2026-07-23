"use client";

import { SignInButton, useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function HeaderAuth() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <div className="h-9 w-24" aria-hidden />;
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="redirect" forceRedirectUrl="/admin">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-[#B8E6C8] px-4 text-sm font-semibold text-[#0A1121] transition hover:bg-[#a3d9b5]"
        >
          <UserIcon />
          Sign in
        </button>
      </SignInButton>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/admin"
        className="text-sm font-medium text-slate-600 transition hover:text-[#0A1121]"
      >
        Admin
      </Link>
      <UserButton />
    </div>
  );
}
