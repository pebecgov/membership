import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-0px)] flex-1 bg-[#F8F9FB]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">{children}    </main>
  </div>
  );
}
