import Link from "next/link";
import { db } from "@/lib/db";
import { DataBadge } from "@/components/badges";
import { showDemoBrands } from "@/lib/chart-select";
export const metadata = { title: "Brands" };
export const dynamic = "force-dynamic";

export default async function Brands() {
  const brands = await db.brand.findMany({
    where: { active: true, ...(showDemoBrands() ? {} : { isDemo: false }) }, orderBy: { name: "asc" },
    include: { sizeCharts: { where: { active: true }, include: { category: true, versions: { where: { status: { not: "DEPRECATED" } }, select: { status: true } } } } },
  });
  const groups = [
    { title: "International", items: brands.filter((b) => b.region === "INTERNATIONAL" && !b.isDemo) },
    { title: "Indian", items: brands.filter((b) => b.region === "INDIAN") },
    { title: "Sample data for trying FITSYNC", items: brands.filter((b) => b.isDemo) },
  ].filter((g) => g.items.length);

  return (
    <div className="container-x py-8 sm:py-12">
      <h1 className="text-3xl sm:text-4xl font-semibold">Brands</h1>
      <p className="mt-2 text-muted max-w-xl">Every size chart shows its source. Where we couldn’t get an official chart, the brand says <strong className="text-ink">Data unavailable</strong>. We never fill the gap with a guess.</p>
      {groups.map((g) => (
        <section key={g.title} className="mt-10">
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.items.map((b) => {
              const charts = b.sizeCharts.filter((c) => c.versions.length);
              const verified = charts.some((c) => c.versions.some((v) => v.status === "VERIFIED"));
              const sets = [...new Set(charts.map((c) => `${c.category.name} · ${c.gender === "MEN" ? "Men" : c.gender === "WOMEN" ? "Women" : "Unisex"}`))];
              return (
                <li key={b.id}>
                  <Link href={`/brands/${b.slug}`} className="card block p-5 h-full hover:border-ink/40 transition">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid place-items-center size-10 rounded-xl bg-ink text-paper font-semibold">{b.name[0]}</span>
                      {charts.length > 0 ? <DataBadge status={verified ? "VERIFIED" : "UNVERIFIED"} demo={b.isDemo} /> : <span className="chip">Data unavailable</span>}
                    </div>
                    <div className="mt-3 font-semibold">{b.name}</div>
                    <div className="mt-1 text-sm text-muted">{sets.length ? sets.join(", ") : "No official chart added yet"}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
