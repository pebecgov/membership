import Link from "next/link";
import { HeaderAuth } from "./HeaderAuth";

export function Header({ active }: { active: "register" | "verify" }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-[#0A1121]">
          Member Portal
        </Link>

        <nav className="absolute left-1/2 flex -translate-x-1/2 gap-8">
          <Link
            href="/"
            className={`text-sm ${
              active === "register"
                ? "font-semibold text-[#0A1121]"
                : "font-medium text-slate-500 hover:text-[#0A1121]"
            }`}
          >
            Register
          </Link>
          <Link
            href="/verify"
            className={`text-sm ${
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
