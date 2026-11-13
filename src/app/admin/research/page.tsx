import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { ResearchPanel } from "@/components/admin/research-panel";
import { CATEGORY_CONFIGS } from "@/lib/engine";
import { discoveryProvider } from "@/lib/research/discovery";
export const metadata = { title: "Research jobs · Admin" };
export const dynamic = "force-dynamic";

export default async function Research() {
  await requirePageAdmin();
  const [jobs, brands, marketplaces] = await Promise.all([
    db.researchJob.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { createdBy: { select: { email: true } }, sources: { orderBy: { retrievedAt: "desc" } } } }),
    db.brand.findMany({ where: { active: true, isDemo: false }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.marketplace.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return (
    <>
      <AdminHeader title="Research jobs" lede="Find official size guides and product charts, fetch them safely, and send what’s extracted to the verification queue." />
      <ResearchPanel brands={brands} marketplaces={marketplaces} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))} discoveryConfigured={!!discoveryProvider()}
        jobs={jobs.map((j) => ({ id: j.id, state: j.state, createdAt: j.createdAt.toISOString(), createdBy: j.createdBy?.email ?? null, summary: j.summary as never, sources: j.sources.map((s) => ({ id: s.id, url: s.url, status: s.status, note: s.note, httpStatus: s.httpStatus, chartVersionId: s.chartVersionId })) }))} />
    </>
  );
}
