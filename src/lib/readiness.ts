import { db } from "./db";
import { isProduction } from "./env";

/**
 * Deployment readiness: the configuration problems that make sign-up, login and every signed-in page fail.
 *
 * These checks exist because a misconfigured deployment used to surface only as
 * "Something went wrong on our side" at registration (see docs/AUDIT-V6.md):
 *  - AUTH_SECRET missing in production: every request that hashes the client IP threw.
 *  - The database schema behind the code (migrations not applied): Prisma failed on columns that did not exist yet.
 *
 * Results contain problem CODES only, never secret values, so /api/health can report them publicly.
 */

/** Name of the newest folder in prisma/migrations. A unit test keeps this in sync with the folder list. */
export const EXPECTED_LATEST_MIGRATION = "20261114000000_v5_identity_security";

export type ReadinessProblem =
  | "DATABASE_URL_MISSING"
  | "DATABASE_UNREACHABLE"
  | "DATABASE_SCHEMA_OUTDATED"
  | "AUTH_SECRET_MISSING";

export const PROBLEM_HELP: Record<ReadinessProblem, string> = {
  DATABASE_URL_MISSING: "DATABASE_URL is not set.",
  DATABASE_UNREACHABLE: "The database could not be reached with DATABASE_URL.",
  DATABASE_SCHEMA_OUTDATED: `Database migrations are not applied. Run \`npx prisma migrate deploy\` against this database (expected ${EXPECTED_LATEST_MIGRATION}).`,
  AUTH_SECRET_MISSING: "AUTH_SECRET is missing or shorter than 32 characters.",
};

/** Configuration-only checks (no I/O). */
export function configProblems(): ReadinessProblem[] {
  const out: ReadinessProblem[] = [];
  if (!process.env.DATABASE_URL) out.push("DATABASE_URL_MISSING");
  if (isProduction() && (process.env.AUTH_SECRET?.length ?? 0) < 32) out.push("AUTH_SECRET_MISSING");
  return out;
}

/**
 * True when the newest migration has been applied. Falls back to probing a column added by that migration when the
 * database was migrated by hand (no _prisma_migrations table).
 */
async function schemaCurrent(): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "_prisma_migrations"
      WHERE migration_name = ${EXPECTED_LATEST_MIGRATION} AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    const rows = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Session' AND column_name = 'tokenHash'`;
    return Number(rows[0]?.n ?? 0) > 0;
  }
}

let cached: { at: number; problems: ReadinessProblem[] } | null = null;
const CACHE_MS = 30_000;

/** Full readiness check, including the database. Cached for 30 s per server instance once everything is healthy. */
export async function readinessProblems(opts: { fresh?: boolean } = {}): Promise<ReadinessProblem[]> {
  if (!opts.fresh && cached && cached.problems.length === 0 && Date.now() - cached.at < CACHE_MS) return cached.problems;
  const problems = configProblems();
  if (!problems.includes("DATABASE_URL_MISSING")) {
    try {
      await db.$queryRaw`SELECT 1`;
      if (!(await schemaCurrent())) problems.push("DATABASE_SCHEMA_OUTDATED");
    } catch {
      problems.push("DATABASE_UNREACHABLE");
    }
  }
  cached = { at: Date.now(), problems };
  return problems;
}
