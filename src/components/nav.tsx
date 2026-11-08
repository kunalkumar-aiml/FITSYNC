"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, Ruler, Scale, Settings, Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { api } from "@/lib/client";

type U = { name: string | null; email: string; role: string } | null;

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/recommend", label: "Find size", icon: Sparkles },
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/brands", label: "Brands", icon: LayoutGrid },
  { href: "/profile", label: "Fit profile", icon: Ruler },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-[17px]" aria-label="FITSYNC home">
      <span className="grid place-items-center size-7 rounded-lg bg-ink text-paper">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 8h16M4 12h10M4 16h16"/><circle cx="19" cy="12" r="1.2" fill="rgb(139 124 255)" stroke="none"/></svg>
      </span>
      FITSYNC
    </Link>
  );
}

export function Nav({ user }: { user: U }) {
  const path = usePathname();
  const router = useRouter();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="container-x flex h-14 items-center justify-between">
          <Logo />
          {user && (
            <nav aria-label="Main" className="hidden md:flex items-center gap-1">
              {TABS.map((t) => (
                <Link key={t.href} href={t.href} aria-current={path.startsWith(t.href) ? "page" : undefined}
                  className={`px-3.5 py-1.5 rounded-full text-sm transition ${path.startsWith(t.href) ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
                  {t.label}
                </Link>
              ))}
              {user.role === "ADMIN" && (
                <Link href="/admin" className={`px-3.5 py-1.5 rounded-full text-sm ${path.startsWith("/admin") ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>Admin</Link>
              )}
            </nav>
          )}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/settings" className="btn btn-quiet !px-2.5 !h-9" aria-label="Settings"><Settings size={18} /></Link>
                <button onClick={logout} className="btn btn-ghost !h-9 hidden sm:inline-flex">Log out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-quiet !h-9">Log in</Link>
                <Link href="/signup" className="btn btn-primary !h-9">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>
      {user && (
        <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-paper/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <ul className="grid grid-cols-5">
            {TABS.map((t) => {
              const active = path.startsWith(t.href);
              return (
                <li key={t.href}>
                  <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${active ? "text-ink" : "text-muted"}`}>
                    <t.icon size={20} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-accent" : ""} />
                    {t.label}
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
