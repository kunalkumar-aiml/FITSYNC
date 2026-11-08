import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { HistoryClient } from "@/components/history-client";
export const metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser();
  const rows = await db.recommendation.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    include: { chartVersion: { include: { chart: { include: { brand: true, category: true } } } }, feedback: { take: 1 } },
  });
  const items = rows.map((r) => ({
    id: r.id, createdAt: r.createdAt.toISOString(), brand: r.chartVersion.chart.brand.name, isDemo: r.chartVersion.chart.brand.isDemo,
    category: r.chartVersion.chart.category.name, fitPreference: r.fitPreference, recommendedSize: r.recommendedSize,
    confidence: r.confidence, insufficientData: r.insufficientData, dataStatus: r.chartVersion.status,
    feedback: r.feedback[0] ? { purchasedSize: r.feedback[0].purchasedSize, outcome: r.feedback[0].outcome } : null,
  }));
  return (
    <div className="container-x py-8 sm:py-12 max-w-3xl">
      <h1 className="text-3xl sm:text-4xl font-semibold">History</h1>
      <p className="mt-2 text-muted">Saved recommendations. After you buy and try something on, tell us how it fit. That’s how FITSYNC gets better.</p>
      {items.length === 0 ? (
        <div className="card mt-8 p-8 text-center"><p className="text-muted">You haven’t saved any recommendations yet.</p><Link href="/recommend" className="btn btn-primary mt-4">Find a size</Link></div>
      ) : <HistoryClient items={items} />}
    </div>
  );
}
