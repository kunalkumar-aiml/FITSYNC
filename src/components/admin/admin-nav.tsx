"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/charts", label: "Size charts" },
  { href: "/admin/research", label: "Research jobs" },
  { href: "/admin/verification", label: "Source verification" },
  { href: "/admin/quality", label: "Data quality" },
  { href: "/admin/feedback", label: "Feedback analytics" },
  { href: "/admin/audit", label: "Security audit log" },
  { href: "/admin/health", label: "System health" },
];

export function AdminNav() {
  const path = usePathname();
  const on = (h: string) => (h === "/admin" ? path === "/admin" : path === h || path.startsWith(h + "/"));
  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24">
      <ul className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 -mx-1 px-1">
        {ADMIN_SECTIONS.map((s) => (
          <li key={s.href} className="shrink-0">
            <Link href={s.href} aria-current={on(s.href) ? "page" : undefined}
              className={`block rounded-sm px-3 py-2 text-sm whitespace-nowrap ${on(s.href) ? "bg-ink text-paper" : "text-muted hover:text-ink hover:bg-surface"}`}>{s.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
