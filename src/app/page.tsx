import Link from "next/link";
import { ArrowRight, Check, Layers, Ruler, ShieldCheck } from "lucide-react";
import { FitDemo } from "@/components/fit-demo";
import { getUser } from "@/lib/auth";

const STEPS = [
  { icon: Ruler, title: "Measure once", body: "Chest, waist, shoulders and more. Use cm or inches, skip what you don’t know." },
  { icon: Layers, title: "We compare real charts", body: "Brand size charts describe the garment, not you. We add the ease each fit needs before comparing." },
  { icon: Check, title: "See the size and the reason", body: "Every result shows what is tight, loose or good, and how sure we are." },
];

const FAQ = [
  ["Is my weight enough to find my size?", "No. Weight says little about shape. FITSYNC uses body measurements and treats weight as optional context."],
  ["Where do the size charts come from?", "From the brands themselves. Each chart stores its source and date, and anything unconfirmed is labelled unverified. We never fill gaps with guesses."],
  ["How accurate is it?", "It is an explainable estimate, not a guarantee. Accuracy improves as people tell us how items actually fit. We will not claim more until we can show it."],
  ["Who can see my measurements?", "Only you. They are never public, you can edit or delete them any time, and deleting your account removes everything."],
];

export default async function Landing() {
  const user = await getUser().catch(() => null);
  const cta = user ? { href: "/dashboard", label: "Open your dashboard" } : { href: "/signup", label: "Create your fit profile" };
  return (
    <>
      <section className="container-x pt-14 sm:pt-24 pb-12">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div>
            <h1 className="text-[2.6rem] leading-[1.02] sm:text-6xl font-semibold">Your body.<br />Every brand.<br />The right size.</h1>
            <p className="mt-5 text-lg text-muted max-w-md">Stop guessing your clothing size. Create one universal fit profile and discover your perfect size across fashion brands.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={cta.href} className="btn btn-primary h-12 px-6">{cta.label} <ArrowRight size={16} /></Link>
              <a href="#how" className="btn btn-ghost h-12 px-6">Explore how it works</a>
            </div>
            <p className="mt-4 text-sm text-muted">Free. Works on any phone or laptop, and installs like an app.</p>
          </div>
          <FitDemo />
        </div>
      </section>

      <section className="container-x py-14 border-t border-line/70">
        <h2 className="text-3xl sm:text-4xl font-semibold max-w-xl">A medium isn’t a medium.</h2>
        <div className="mt-6 grid md:grid-cols-2 gap-8 text-muted max-w-3xl">
          <p>The same label can mean a chest that differs by several centimetres from one brand to the next. So people order two sizes and send one back.</p>
          <p>That costs shoppers time, brands money, and everyone confidence. The fix isn’t a better guess. It’s comparing your measurements with how each garment is actually cut.</p>
        </div>
      </section>

      <section id="how" className="container-x py-14 border-t border-line/70 scroll-mt-16">
        <h2 className="text-3xl sm:text-4xl font-semibold">How FITSYNC works</h2>
        <ol className="mt-8 grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <s.icon size={22} className="text-accent" />
              <h3 className="mt-4 text-lg font-semibold">{i + 1}. {s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x py-14 border-t border-line/70">
        <div className="card p-6 sm:p-8 flex gap-4 items-start">
          <ShieldCheck className="text-good shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xl font-semibold">Honest by design</h2>
            <p className="mt-2 text-muted max-w-2xl">Brand charts show their source and verification date. If a chart is missing a measurement we need, we tell you instead of guessing. Charts that aren’t confirmed yet are labelled, and their results carry lower confidence.</p>
            <Link href="/brands" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">Browse brands <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      <section className="container-x py-14 border-t border-line/70 max-w-3xl">
        <h2 className="text-3xl font-semibold">Questions</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">{q}<span className="text-muted transition group-open:rotate-45 text-xl leading-none">+</span></summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="container-x py-10 border-t border-line/70 text-sm text-muted flex flex-wrap gap-4 justify-between">
        <span>© {new Date().getFullYear()} FITSYNC. One body. Every brand. The perfect fit.</span>
        <span className="flex gap-4"><Link href="/privacy">Privacy</Link><Link href="/brands">Brands</Link></span>
      </footer>
    </>
  );
}
