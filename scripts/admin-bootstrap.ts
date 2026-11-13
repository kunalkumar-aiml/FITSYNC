/**
 * One-time administrator bootstrap (server-side provisioning). Replaces the unsafe ADMIN_EMAILS auto-promotion.
 *
 *   npm run admin:bootstrap -- --email you@yourdomain.com
 *       Creates a NEW administrator account. The password is read from ADMIN_BOOTSTRAP_PASSWORD or asked for
 *       interactively (hidden). The email is marked verified because the operator with database access asserts it.
 *   npm run admin:bootstrap -- --email you@yourdomain.com --promote-existing
 *       Promotes an account that already exists (only if you control it).
 *
 * It refuses to do anything once ANY administrator exists, so it cannot be used to take over a running site.
 * From then on, administrators are added in Admin → Users, which only promotes accounts with a confirmed email.
 * Needs DATABASE_URL (shell environment or .env). Run it from a trusted machine, never from a web request.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";
import { passwordProblem } from "../src/lib/security/password-policy";
import { planBootstrap } from "../src/lib/admin-policy";
import { loadDotEnv } from "./load-env";

loadDotEnv();

function arg(name: string) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }

async function askHidden(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => { if (!muted || s.includes("\n")) out.output.write(muted ? "\n" : s); };
  return new Promise((resolve) => { rl.question(q, (a) => { rl.close(); resolve(a); }); muted = true; });
}

async function main() {
  const email = arg("--email")?.normalize("NFKC").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Pass --email you@example.com");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const [adminCount, existing] = await Promise.all([
      db.user.count({ where: { role: "ADMIN" } }),
      db.user.findUnique({ where: { email }, select: { id: true, role: true } }),
    ]);
    const plan = planBootstrap({ adminCount, existing, confirmExisting: process.argv.includes("--promote-existing") });
    if (plan.action === "refuse") { console.error(`Refused: ${plan.reason}`); process.exitCode = 1; return; }
    if (plan.action === "promote") {
      await db.user.update({ where: { id: plan.userId }, data: { role: "ADMIN", emailVerifiedAt: new Date() } });
      await db.adminAuditLog.create({ data: { actorEmail: "cli:admin-bootstrap", action: "user.role.bootstrap", targetType: "User", targetId: plan.userId, details: { mode: "promote-existing" } } });
      console.log(`Promoted ${email} to ADMIN. Bootstrap is now closed.`);
      return;
    }
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? (await askHidden(`Password for ${email}: `));
    const problem = passwordProblem(password, { email });
    if (problem) throw new Error(problem);
    const now = new Date();
    const user = await db.user.create({
      data: { email, passwordHash: await hashPassword(password), role: "ADMIN", emailVerifiedAt: now, passwordChangedAt: now, profile: { create: {} } },
    });
    await db.adminAuditLog.create({ data: { actorEmail: "cli:admin-bootstrap", action: "user.role.bootstrap", targetType: "User", targetId: user.id, details: { mode: "create" } } });
    console.log(`Created administrator ${email}. Bootstrap is now closed. Unset ADMIN_BOOTSTRAP_PASSWORD if you used it.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
