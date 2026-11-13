import { requirePageAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
export const dynamic = "force-dynamic";

/** Server-side admin gate for every admin page. Each page and every admin API route checks again on its own. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageAdmin();
  return (
    <div className="container-x pt-8 pb-16">
      <div className="grid lg:grid-cols-[13rem_1fr] gap-8 lg:gap-12">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
