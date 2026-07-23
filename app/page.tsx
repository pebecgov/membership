import { RegistrationForm } from "@/components/RegistrationForm";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 md:py-16">
      <div className="w-full max-w-lg">
        <RegistrationForm />
      </div>
    </main>
  );
}
