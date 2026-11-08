import Link from "next/link";
import { ArrowRight, Heart, Ruler, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { DataBadge, FIT_NAMES } from "@/components/badges";
export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const KEYS = ["heightCm", "weightKg", "chestCm", "waistCm", "hipsCm", "shoulderCm", "armLengthCm", "inseamCm", "neckCm", "thighCm"] as const;

export default async function Dashboard() {
  const user = await requirePageUser();
  const [m, profile, recs, saved] = await Promise.all([
    db.bodyMeasurement.findUnique({ where: { userId: user.id } }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.recommendation.findMany({
      where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4,
      include: { chartVersion: { include: { chart: { include: { brand: true, category: true } } } } },
    }),
    db.savedBrand.findMany({ where: { userId: user.id }, include: { brand: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const done = m ? KEYS.filter((k) => m[k] !== null).length : 0;
  const pct = Math.round((done / KEYS.length) * 100);
  const hasBasics = !!m && (m.chestCm !== null || m.waistCm !== null);
  const unitIn = profile?.preferredUnit === "IN";
  const show = (cm: number | null) => (cm === null ? "–" : unitIn ? `${(cm / 2.54).toFixed(1)} in` : `${cm} cm`);

  return (
    <div className="container-x py-8 sm:py-12 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold">Hi{user.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1>
        <p className="mt-1 text-muted">{hasBasics ? "Your fit profile is ready. Find your size in any brand." : "Add your measurements to start getting recommendations."}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <section className="card p-6 md:col-span-2" aria-labelledby="profile-h">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="profile-h" className="font-semibold flex items-center gap-2"><Ruler size={18} className="text-accent" />Fit profile</h2>
              <p className="text-sm text-muted mt-1">{done} of {KEYS.length} measurements · {FIT_NAMES[profile?.fitPreference ?? "REGULAR"]} fit</p>
            </div>
            <Link href="/profile" className="btn btn-ghost !h-9">{done ? "Update" : "Start"}</Link>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
          {m ? (
            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {([["Chest", m.chestCm], ["Waist", m.waistCm], ["Hips", m.hipsCm], ["Shoulders", m.shoulderCm]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-muted">{k}</dt><dd className="text-lg font-medium tabular-nums">{show(v)}</dd></div>
              ))}
            </dl>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-line p-5 text-sm text-muted">
              No measurements yet. It takes about two minutes, and you can skip anything you don’t know.
            </div>
          )}
        </section>

        <section className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><Sparkles size={18} className="text-accent" />Find a size</h2>
            <p className="text-sm text-muted mt-1">Pick a brand and a type of clothing.</p>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Link href={hasBasics ? "/recommend" : "/profile"} className="btn btn-primary">{hasBasics ? "Get a recommendation" : "Add measurements first"}</Link>
            {hasBasics && <Link href="/compare" className="btn btn-ghost">Compare brands</Link>}
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <section className="card p-6" aria-labelledby="recent-h">
          <div className="flex items-center justify-between"><h2 id="recent-h" className="font-semibold">Recent recommendations</h2>{recs.length > 0 && <Link href="/history" className="text-sm text-muted hover:text-ink">See all</Link>}</div>
          {recs.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing saved yet. When you save a recommendation, it shows up here so you can report how it fit.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recs.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.chartVersion.chart.brand.name}</div>
                    <div className="text-xs text-muted">{r.chartVersion.chart.category.name} · {FIT_NAMES[r.fitPreference]}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <DataBadge status={r.chartVersion.status} demo={r.chartVersion.chart.brand.isDemo} />
                    <span className="text-xl font-semibold w-10 text-right">{r.recommendedSize ?? "–"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6" aria-labelledby="fav-h">
          <div className="flex items-center justify-between"><h2 id="fav-h" className="font-semibold flex items-center gap-2"><Heart size={18} className="text-accent" />Favourite brands</h2><Link href="/brands" className="text-sm text-muted hover:text-ink">Browse</Link></div>
          {saved.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Save brands you shop at, and they’ll be here for quick access.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {saved.map((s) => (
                <li key={s.brandId}><Link href={`/brands/${s.brand.slug}`} className="chip !text-ink hover:border-ink/40 !text-sm !px-3 !py-1.5">{s.brand.name}<ArrowRight size={12} /></Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
