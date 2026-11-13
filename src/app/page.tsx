import Link from "next/link";
import { FitDemo } from "@/components/fit-demo";
import { HeroTitle } from "@/components/hero-title";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Measure once", body: "Chest, waist, hips and a few more, in centimetres or inches. Skip anything you can’t measure; we tell you what each result needs." },
  { title: "Pick a brand and a garment", body: "Choose the brand, the type of clothing and, where we have it, the exact product." },
  { title: "See the size and the reason", body: "Each recommendation shows how every measurement compares, which chart it came from and how sure we can be." },
  { title: "Tell us how it fit", body: "After you buy, report too tight, perfect or too loose. Your report is kept separate from the prediction." },
];

const FAQ: [string, string][] = [
  ["Is my weight enough to find my size?", "No. Weight says little about shape, so FITSYNC uses body measurements and treats weight as optional context only."],
  ["Where do the size charts come from?", "From the brands’ own size guides and, for single products, from the product listing. Each chart records its source and date. A person has to check a chart before it is marked verified."],
  ["What happens when a brand has no chart?", "We say “Data unavailable” and don’t show a size. We never fill the gap with an average or a guess."],
  ["How accurate is it?", "It’s an explainable estimate, not a guarantee. The Fit Match Score is experimental and is not a probability. It will improve as people report how clothes actually fit."],
  ["Do I have to upload photos?", "No. FITSYNC never asks for photos. A tape measure is all you need."],
  ["Who can see my measurements?", "Only you. They’re never shown publicly or used in public statistics. You can download or delete them, or your whole account, from Settings."],
];

const STATUSES: [string, string][] = [
  ["Verified", "A person compared the chart with the brand’s published guide."],
  ["Unverified", "Collected from the source, not yet checked. Results are marked provisional."],
  ["Awaiting review", "The source left something unclear, such as the unit or whether numbers describe the body or the garment. Not used until a person resolves it."],
  ["Data unavailable", "We looked and found no usable official chart. You see that, not a guess."],
];

async function brandIndex() {
  try {
    const brands = await db.brand.findMany({
      where: { active: true, isDemo: false }, orderBy: { name: "asc" },
      select: { slug: true, name: true, region: true, sizeCharts: { where: { active: true }, select: { productId: true, versions: { where: { status: { in: ["VERIFIED", "UNVERIFIED"] } }, select: { status: true } } } } },
    });
    return brands.map((b) => {
      const charts = b.sizeCharts.filter((c) => c.versions.length);
      return { slug: b.slug, name: b.name, region: b.region, brand: charts.some((c) => !c.productId), product: charts.some((c) => c.productId), verified: charts.some((c) => c.versions.some((v) => v.status === "VERIFIED")) };
    });
  } catch { return []; }
}

export default async function Landing() {
  const [user, brands] = await Promise.all([getUser().catch(() => null), brandIndex()]);
  const cta = user ? { href: "/recommend", label: "Find my size" } : { href: "/signup", label: "Create your fit profile" };
  return (
    <>
      <section className="container-x pt-14 sm:pt-20">
        <div className="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-end">
          <div className="lg:col-span-7"><HeroTitle /></div>
          <div className="lg:col-span-5 lg:pb-3">
            <p className="text-lg max-w-md">One personal fit profile. Better size recommendations across the brands you shop.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={cta.href} className="btn btn-primary h-12 px-6">{cta.label}</Link>
              <Link href="/brands" className="btn btn-secondary h-12 px-6">Browse brands</Link>
            </div>
            <p className="mt-4 text-sm text-muted">Free to use. No photos, ever.</p>
          </div>
        </div>
        <div className="mt-12 sm:mt-16"><FitDemo /></div>
      </section>

      <section className="container-x mt-24 sm:mt-32 grid lg:grid-cols-12 gap-10">
        <h2 className="display-lg lg:col-span-5">A medium is not a medium.</h2>
        <div className="lg:col-span-6 lg:col-start-7 space-y-5 text-lg text-muted">
          <p>The same label can mean a chest several centimetres wider at one brand than at the next. So people order two sizes and send one back.</p>
          <p>FITSYNC compares your measurements with each brand’s own chart, adds the room each fit needs, and tells you which size lands closest, and why.</p>
        </div>
      </section>

      <section id="how" className="container-x mt-24 sm:mt-32 scroll-mt-24">
        <h2 className="display-lg max-w-xl">How FITSYNC works</h2>
        <ol className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rule pt-5">
              <span className="font-display text-d-sm text-accent-text num" aria-hidden>{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x mt-24 sm:mt-32 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <h2 className="display-md">What you get</h2>
        </div>
        <dl className="lg:col-span-8 grid sm:grid-cols-2 gap-x-10 gap-y-8">
          <div><dt className="font-semibold">One profile for every brand</dt><dd className="mt-1.5 text-muted">Enter your measurements once and reuse them for any brand and garment we cover.</dd></div>
          <div><dt className="font-semibold">Your size in every brand at once</dt><dd className="mt-1.5 text-muted">Compare shows your size across brands side by side, only where real data exists.</dd></div>
          <div><dt className="font-semibold">The reasoning, not just a letter</dt><dd className="mt-1.5 text-muted">See chest, waist and shoulders measured against each size, and which one fits snug or loose.</dd></div>
          <div><dt className="font-semibold">Product-level charts</dt><dd className="mt-1.5 text-muted">When a product publishes its own chart, it’s used in place of the brand’s general one once checked.</dd></div>
        </dl>
      </section>

      {brands.length > 0 && (
        <section className="container-x mt-24 sm:mt-32">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display-md">Brands we track</h2>
            <Link href="/brands" className="link text-sm">Open the brand explorer</Link>
          </div>
          <p className="mt-3 text-muted max-w-prose">Names only, never logos. Each brand shows what we actually have for it today.</p>
          <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 border-t border-line">
            {brands.map((b) => (
              <li key={b.slug} className="border-b border-line">
                <Link href={`/brands/${b.slug}`} className="flex items-baseline justify-between gap-4 py-4 pr-4 hover:text-primary">
                  <span className="font-display text-xl">{b.name}</span>
                  <span className="text-xs text-muted text-right">{b.brand ? (b.verified ? "Verified chart" : "Brand chart, unverified") : b.product ? "Product charts only" : "Data unavailable"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="data" className="container-x mt-24 sm:mt-32 scroll-mt-24 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <h2 className="display-md">Every chart shows where it came from</h2>
          <p className="mt-4 text-muted max-w-md">Brand charts describe either your body or the garment, in centimetres or inches. We record which, from the source itself, and never guess it from the numbers.</p>
        </div>
        <dl className="lg:col-span-7 divide-y divide-line border-y border-line">
          {STATUSES.map(([k, v]) => (
            <div key={k} className="grid sm:grid-cols-[11rem_1fr] gap-1 sm:gap-6 py-4">
              <dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="container-x mt-24 sm:mt-32">
        <div className="rounded-md bg-primary text-primary-ink px-6 py-10 sm:px-12 sm:py-14 grid lg:grid-cols-12 gap-8">
          <h2 className="display-md lg:col-span-5">Your measurements stay yours</h2>
          <ul className="lg:col-span-7 space-y-3 text-primary-ink/85">
            <li>Only you can see your body measurements. They’re never public and never part of public statistics.</li>
            <li>No photos, no body scans. Every measurement is optional.</li>
            <li>Download everything we hold about you, delete your measurements, or delete your account, any time from Settings.</li>
            <li>Sessions can be signed out from every device at once.</li>
          </ul>
        </div>
      </section>

      <section id="faq" className="container-x mt-24 sm:mt-32 grid lg:grid-cols-12 gap-10 scroll-mt-24">
        <h2 className="display-md lg:col-span-4">Questions</h2>
        <div className="lg:col-span-8 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                {q}<span aria-hidden className="text-muted text-2xl leading-none transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-muted max-w-prose">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container-x mt-24 sm:mt-32 text-center">
        <h2 className="display-lg">Measure once.</h2>
        <p className="mt-4 text-lg text-muted">It takes about five minutes with a soft tape measure.</p>
        <Link href={cta.href} className="btn btn-primary h-12 px-7 mt-8">{cta.label}</Link>
      </section>
    </>
  );
}
