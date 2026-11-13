import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { HistoryClient } from "@/components/history-client";
import { EmptyState, PageHeader } from "@/components/ui";
export const metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser("/history");
  const rows = await db.recommendation.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100,
    include: { chartVersion: { include: { chart: { include: { brand: true, category: true, product: true } } } }, feedback: { where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const items = rows.map((r) => ({
    id: r.id, createdAt: r.createdAt.toISOString(), brand: r.chartVersion.chart.brand.name, isDemo: r.chartVersion.chart.brand.isDemo,
    category: r.chartVersion.chart.category.name, product: r.chartVersion.chart.product?.name ?? null, fitPreference: r.fitPreference, recommendedSize: r.recommendedSize,
    score: r.confidence, insufficientData: r.insufficientData, dataStatus: r.chartVersion.status,
    feedback: r.feedback[0] ? { purchasedSize: r.feedback[0].purchasedSize, outcome: r.feedback[0].outcome, review: r.feedback[0].review } : null,
  }));
  return (
    <div className="container-x pb-16">
      <PageHeader title="History" lede="Your saved recommendations. Once you’ve worn something, tell us how it actually fit. Reports are stored separately from what we predicted." />
      {items.length === 0
        ? <EmptyState title="No saved recommendations" action={<Link href="/recommend" className="btn btn-primary">Find my size</Link>}>Save a recommendation from Find my size and it will appear here.</EmptyState>
        : <HistoryClient items={items} />}
    </div>
  );
}
