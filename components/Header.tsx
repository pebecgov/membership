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

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B8E6C8] text-[#0A1121]"
          aria-label="Profile"
        >
          <UserIcon />
        </button>
      </div>
    </header>
  );
}
