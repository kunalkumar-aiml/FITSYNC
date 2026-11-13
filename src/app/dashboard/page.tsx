import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { DataBadge, FIT_NAMES, GENDER_NAMES } from "@/components/badges";
import { VerifyBanner } from "@/components/verify-banner";
import { EmptyState } from "@/components/ui";
export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const KEYS = ["heightCm", "weightKg", "chestCm", "waistCm", "hipsCm", "shoulderCm", "armLengthCm", "inseamCm", "neckCm", "thighCm"] as const;
const OUTCOME = { TOO_TIGHT: "Too tight", PERFECT: "Perfect", TOO_LOOSE: "Too loose" } as const;
const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function Dashboard() {
  const user = await requirePageUser("/dashboard");
  const [m, profile, recs, saved, feedback] = await Promise.all([
    db.bodyMeasurement.findUnique({ where: { userId: user.id } }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.recommendation.findMany({
      where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5,
      include: { chartVersion: { include: { chart: { include: { brand: true, category: true } } } } },
    }),
    db.savedBrand.findMany({ where: { userId: user.id }, include: { brand: true }, orderBy: { createdAt: "desc" } }),
    db.userFitFeedback.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4, include: { recommendation: { include: { chartVersion: { include: { chart: { include: { brand: true, category: true } } } } } } } }),
  ]);
  const done = m ? KEYS.filter((k) => m[k] !== null).length : 0;
  const pct = Math.round((done / KEYS.length) * 100);
  const hasBasics = !!m && (m.chestCm !== null || m.waistCm !== null);
  const unitIn = profile?.preferredUnit === "IN";
  const show = (cm: number | null) => (cm === null ? "Not added" : unitIn ? `${(cm / 2.54).toFixed(1)} in` : `${cm} cm`);
  const first = user.name?.split(" ")[0];

  return (
    <div className="container-x">
      <header className="pt-10 sm:pt-14 pb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display-lg">{first ? `Hello, ${first}.` : "Hello."}</h1>
          <p className="mt-3 lede">{hasBasics ? "Your fit profile is ready. Pick a brand to find your size." : "Start by adding your measurements. You can skip any you don’t know."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hasBasics ? "/recommend" : "/profile?welcome=1"} className="btn btn-primary">{hasBasics ? "Find my size" : "Add measurements"}</Link>
          {hasBasics && <Link href="/compare" className="btn btn-secondary">Compare brands</Link>}
        </div>
      </header>

      {!user.emailVerifiedAt && <div className="mb-10"><VerifyBanner email={user.email} /></div>}

      <div className="grid lg:grid-cols-12 gap-x-10 gap-y-12">
        <section aria-labelledby="profile-h" className="lg:col-span-7 rule pt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="profile-h" className="text-lg font-semibold">Fit profile</h2>
            <Link href="/profile" className="text-sm link">{done ? "Edit measurements" : "Start"}</Link>
          </div>
          <p className="mt-1 text-sm text-muted">{done} of {KEYS.length} measurements, {FIT_NAMES[profile?.fitPreference ?? "REGULAR"].toLowerCase()} fit{profile?.fitCategory ? `, ${GENDER_NAMES[profile.fitCategory].toLowerCase()} sizing` : ", sizing type not chosen"}</p>
          <div className="mt-4 h-1 bg-line" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-4">
            {([["Chest", m?.chestCm ?? null], ["Waist", m?.waistCm ?? null], ["Hips", m?.hipsCm ?? null], ["Shoulders", m?.shoulderCm ?? null]] as const).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className={`mt-1 num ${v === null ? "text-muted text-sm" : "font-display text-d-sm"}`}>{show(v)}</dd></div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="actions-h" className="lg:col-span-5 rule pt-6">
          <h2 id="actions-h" className="text-lg font-semibold">Quick actions</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {[
              { href: "/recommend", t: "Find my size in a brand", d: "Brand, garment, fit" },
              { href: "/compare", t: "See my size across brands", d: "Only where real data exists" },
              { href: "/brands", t: "Explore brands", d: "Charts, sources and coverage" },
              { href: "/history", t: "Report how something fit", d: "Improves future results" },
            ].map((a) => (
              <li key={a.href}><Link href={a.href} className="flex items-center justify-between gap-4 py-3.5 hover:text-primary"><span className="font-medium">{a.t}</span><span className="text-xs text-muted text-right">{a.d}</span></Link></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="recent-h" className="lg:col-span-7 rule pt-6">
          <div className="flex items-baseline justify-between"><h2 id="recent-h" className="text-lg font-semibold">Recent recommendations</h2>{recs.length > 0 && <Link href="/history" className="text-sm link">All history</Link>}</div>
          {recs.length === 0 ? (
            <div className="mt-4"><EmptyState title="Nothing saved yet">Save a recommendation and it appears here, ready for you to report how it fit.</EmptyState></div>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {recs.map((r) => (
                <li key={r.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.chartVersion.chart.brand.name}</p>
                    <p className="text-xs text-muted">{r.chartVersion.chart.category.name}, {FIT_NAMES[r.fitPreference].toLowerCase()} fit, {date(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <DataBadge status={r.chartVersion.status} demo={r.chartVersion.chart.brand.isDemo} />
                    <span className="font-display text-d-sm w-12 text-right">{r.recommendedSize ?? "None"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="lg:col-span-5 space-y-12">
          <section aria-labelledby="fav-h" className="rule pt-6">
            <div className="flex items-baseline justify-between"><h2 id="fav-h" className="text-lg font-semibold">Saved brands</h2><Link href="/brands" className="text-sm link">Browse</Link></div>
            {saved.length === 0 ? <p className="mt-3 text-sm text-muted">Save the brands you shop at to reach them quickly.</p> : (
              <ul className="mt-4 flex flex-wrap gap-2">{saved.map((s) => <li key={s.brandId}><Link href={`/brands/${s.brand.slug}`} className="tag !text-sm !text-ink !px-3 !py-1.5 hover:border-ink/50">{s.brand.name}</Link></li>)}</ul>
            )}
          </section>
          <section aria-labelledby="fb-h" className="rule pt-6">
            <h2 id="fb-h" className="text-lg font-semibold">Your fit reports</h2>
            {feedback.length === 0 ? <p className="mt-3 text-sm text-muted">After you buy something, tell us how it actually fit. Reports are kept apart from predictions.</p> : (
              <ul className="mt-4 space-y-3 text-sm">
                {feedback.map((f) => (
                  <li key={f.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{f.recommendation.chartVersion.chart.brand.name}, size {f.purchasedSize}</span>
                    <span className={f.outcome === "PERFECT" ? "text-good" : "text-warn"}>{OUTCOME[f.outcome]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
