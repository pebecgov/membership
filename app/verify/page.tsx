import { Suspense } from "react";
import { VerifyIdForm } from "@/components/VerifyIdForm";

export const metadata = {
  title: "Verify ID | Member Portal",
  description: "Verify your association member ID",
};

export default function VerifyPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 md:py-16">
      <div className="w-full max-w-lg">
        <Suspense fallback={<p className="text-center text-sm text-slate-500">Loading…</p>}>
          <VerifyIdForm />
        </Suspense>
      </div>
    </main>
  );
}
