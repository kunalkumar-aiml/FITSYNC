/** Run the retention cleanup by hand:  npm run db:cleanup  (the same job runs daily via /api/cron/cleanup on Vercel). */
import { loadDotEnv } from "./load-env";
loadDotEnv();

async function main() {
  const { runRetentionCleanup } = await import("../src/lib/retention");
  console.log(await runRetentionCleanup());
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
