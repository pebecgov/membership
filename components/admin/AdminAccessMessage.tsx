"use client";

export function AdminAccessMessage({ reason }: { reason: "signed_out" | "forbidden" }) {
  if (reason === "signed_out") {
    return <p className="text-sm text-slate-500">Sign in to view admin data.</p>;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <p className="font-semibold">Access denied</p>
      <p className="mt-2">
        Your account is signed in, but it is not on the admin allowlist. Add your email to{" "}
        <code className="rounded bg-white px-1">ADMIN_EMAILS</code> in the Convex dashboard.
      </p>
    </div>
  );
}
