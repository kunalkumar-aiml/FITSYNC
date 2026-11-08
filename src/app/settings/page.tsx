import { requirePageUser } from "@/lib/auth";
import { SettingsClient } from "@/components/settings-client";
export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requirePageUser();
  return <SettingsClient email={user.email} />;
}
