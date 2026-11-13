import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { SettingsClient } from "@/components/settings-client";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser("/settings");
  const [profile, m] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.bodyMeasurement.findUnique({ where: { userId: user.id }, select: { updatedAt: true } }),
  ]);
  return (
    <div className="container-x pb-16">
      <PageHeader title="Settings" lede="Your account, your measurements and the devices signed in to FITSYNC." />
      <SettingsClient email={user.email} name={user.name} verified={!!user.emailVerifiedAt} unit={profile?.preferredUnit ?? "CM"}
        hasMeasurements={!!m} measurementsUpdated={m?.updatedAt.toISOString() ?? null} isAdmin={user.role === "ADMIN"} />
    </div>
  );
}
