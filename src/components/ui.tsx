import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/** Page title block: serif title, optional lede, optional actions on the right. */
export function PageHeader({ title, lede, actions, back }: { title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="pt-10 sm:pt-14 pb-8">
      {back && <Link href={back.href} className="text-sm text-muted hover:text-ink">← {back.label}</Link>}
      <div className={`flex flex-wrap items-end justify-between gap-6 ${back ? "mt-4" : ""}`}>
        <div className="min-w-0">
          <h1 className="display-lg">{title}</h1>
          {lede && <p className="mt-4 lede">{lede}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

const TONES = {
  info: { icon: Info, cls: "border-line bg-surface", ic: "text-muted" },
  success: { icon: CheckCircle2, cls: "border-good/40 bg-good/5", ic: "text-good" },
  warn: { icon: AlertTriangle, cls: "border-warn/40 bg-warn/5", ic: "text-warn" },
  error: { icon: XCircle, cls: "border-bad/40 bg-bad/5", ic: "text-bad" },
} as const;

export function Notice({ tone = "info", title, children, role }: { tone?: keyof typeof TONES; title?: React.ReactNode; children?: React.ReactNode; role?: "alert" | "status" }) {
  const t = TONES[tone];
  return (
    <div role={role} className={`flex gap-3 rounded-md border px-4 py-3 text-sm ${t.cls}`}>
      <t.icon size={18} strokeWidth={1.6} className={`mt-0.5 shrink-0 ${t.ic}`} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-muted" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-d-sm">{title}</p>
      {children && <p className="mt-2 text-sm text-muted max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A labelled section with a hairline rule above it, used instead of stacking boxes. */
export function Section({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rule pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {aside && <div className="text-sm">{aside}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
