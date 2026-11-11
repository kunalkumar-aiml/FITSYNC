/** Import prisma/data/charts.json into the database (idempotent, all UNVERIFIED): npm run research:import */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { importCharts } from "../prisma/lib/import";

if (!process.env.DATABASE_URL) {
  try { for (const l of readFileSync(join(__dirname, "..", ".env"), "utf8").split("\n")) { const m = /^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch { /* no .env */ }
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
importCharts(db).catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
