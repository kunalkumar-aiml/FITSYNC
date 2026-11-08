import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { MeasurementForm } from "@/components/measurement-form";
export const metadata = { title: "Fit profile" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { welcome?: string } }) {
  const user = await requirePageUser();
  const [m, p] = await Promise.all([
    db.bodyMeasurement.findUnique({ where: { userId: user.id } }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <MeasurementForm welcome={searchParams.welcome === "1" && !m}
      initial={{
        unit: p?.preferredUnit ?? "CM", fitPreference: p?.fitPreference ?? "REGULAR",
        heightCm: m?.heightCm, weightKg: m?.weightKg, chestCm: m?.chestCm, waistCm: m?.waistCm, hipsCm: m?.hipsCm,
        shoulderCm: m?.shoulderCm, armLengthCm: m?.armLengthCm, inseamCm: m?.inseamCm, neckCm: m?.neckCm, thighCm: m?.thighCm,
      }} />
  );
}
