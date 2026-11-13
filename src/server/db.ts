import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single Prisma client for the process. In development it is kept on
 * globalThis so hot reloads do not open a new connection pool each time.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Read lazily by the pool: importing this module must not require the
  // variable (e.g. during `next build`); a missing URL fails on first query.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) console.warn("[db] DATABASE_URL is not set; database queries will fail");
  // DATABASE_URL is Neon's pooled (PgBouncer) endpoint, so a small per-instance
  // pool is enough; idle connections are closed quickly so the compute can
  // scale to zero.
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  // On Vercel Fluid compute this keeps the function instance alive just long
  // enough to close idle connections before it is suspended. Elsewhere it does nothing.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** The transaction client type, for service helpers that run inside `db.$transaction`. */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
