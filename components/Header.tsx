import Image from "next/image";
import Link from "next/link";
import { HeaderAuth } from "./HeaderAuth";

export function Header({ active }: { active: "register" | "verify" | "private-sector" }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Image
            src="/pebec-logo.png"
            alt="PEBEC — Presidential Enabling Business Environment Council"
            width={1008}
            height={268}
            priority
            className="h-10 w-auto sm:h-12"
            style={{ width: "auto", height: "2.5rem" }}
          />
        </Link>

        <nav className="order-3 flex w-full gap-5 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:justify-center sm:gap-8">
          <Link
            href="/"
            className={`shrink-0 text-sm ${
              active === "register"
                ? "font-semibold text-[#0A1121]"
                : "font-medium text-slate-500 hover:text-[#0A1121]"
            }`}
          >
            Register
          </Link>
          <Link
            href="/private-sector"
            className={`shrink-0 text-sm ${
              active === "private-sector"
                ? "font-semibold text-[#0A1121]"
                : "font-medium text-slate-500 hover:text-[#0A1121]"
            }`}
          >
            Private Sector
          </Link>
          <Link
            href="/verify"
            className={`shrink-0 text-sm ${
              active === "verify"
                ? "font-semibold text-[#0A1121]"
                : "font-medium text-slate-500 hover:text-[#0A1121]"
            }`}
          >
            Verify ID
          </Link>
        </nav>

        <HeaderAuth />
      </div>
    </header>
  );
}
