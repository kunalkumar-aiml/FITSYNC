"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, Home, LayoutGrid, Ruler, Scale, Settings, Shirt } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./brand";
import { api } from "@/lib/client";

type U = { name: string | null; email: string; role: string } | null;

const TABS = [
  { href: "/dashboard", label: "Overview", short: "Home", icon: Home },
  { href: "/recommend", label: "Find my size", short: "Size", icon: Shirt },
  { href: "/compare", label: "Compare", short: "Compare", icon: Scale },
  { href: "/brands", label: "Brands", short: "Brands", icon: LayoutGrid },
  { href: "/profile", label: "Fit profile", short: "Profile", icon: Ruler },
  { href: "/history", label: "History", short: "History", icon: History },
];
const MOBILE = TABS.filter((t) => t.href !== "/history");

export function Nav({ user }: { user: U }) {
  const path = usePathname();
  const router = useRouter();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const logout = async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } finally { router.push("/"); router.refresh(); }
  };
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-sm print:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="container-x flex h-16 items-center justify-between gap-6">
          <Logo href={user ? "/dashboard" : "/"} />
          {user ? (
            <nav aria-label="Main" className="hidden lg:flex items-center gap-1 text-sm">
              {TABS.map((t) => (
                <Link key={t.href} href={t.href} aria-current={active(t.href) ? "page" : undefined}
                  className={`relative px-3 py-2 transition-colors ${active(t.href) ? "text-ink" : "text-muted hover:text-ink"}`}>
                  {t.label}
                  {active(t.href) && <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-ink" />}
                </Link>
              ))}
              {user.role === "ADMIN" && (
                <Link href="/admin" aria-current={active("/admin") ? "page" : undefined} className={`relative px-3 py-2 ${active("/admin") ? "text-ink" : "text-muted hover:text-ink"}`}>
                  Admin{active("/admin") && <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-ink" />}
                </Link>
              )}
            </nav>
          ) : (
            <nav aria-label="Main" className="hidden md:flex items-center gap-1 text-sm">
              <Link href="/brands" className={`px-3 py-2 ${active("/brands") ? "text-ink" : "text-muted hover:text-ink"}`}>Brands</Link>
              <Link href="/#how" className="px-3 py-2 text-muted hover:text-ink">How it works</Link>
              <Link href="/#data" className="px-3 py-2 text-muted hover:text-ink">Our data</Link>
              <Link href="/privacy" className="px-3 py-2 text-muted hover:text-ink">Privacy</Link>
            </nav>
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user ? (
              <>
                {user.role === "ADMIN" && <Link href="/admin" className="btn btn-quiet btn-sm lg:hidden">Admin</Link>}
                <Link href="/settings" className="btn btn-quiet btn-sm !px-2.5" aria-label="Settings" aria-current={active("/settings") ? "page" : undefined}><Settings size={17} strokeWidth={1.6} /></Link>
                <button type="button" onClick={logout} className="btn btn-ghost btn-sm hidden sm:inline-flex">Log out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-quiet btn-sm">Log in</Link>
                <Link href="/signup" className="btn btn-primary btn-sm">Create profile</Link>
              </>
            )}
          </div>
        </div>
      </header>
      {user && (
        <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-paper/95 backdrop-blur-sm print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <ul className="grid grid-cols-5">
            {MOBILE.map((t) => {
              const on = active(t.href);
              return (
                <li key={t.href}>
                  <Link href={t.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] ${on ? "text-ink" : "text-muted"}`}>
                    <t.icon size={20} strokeWidth={on ? 2 : 1.5} />
                    {t.short}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
