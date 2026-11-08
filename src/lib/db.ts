import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Lazy so that `next build` does not need a database connection. */
export const db = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = (globalForPrisma.prisma ??= create());
    return Reflect.get(client, prop);
  },
});
