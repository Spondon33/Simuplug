import { Pool } from "pg";

// Pooled Neon connection (DATABASE_URL), reused across requests in the long-running Node server.
// Tables (chunks, simulations) are created by rag/embed.py.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: { rejectUnauthorized: true } });
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const vecLiteral = (v: number[]) => "[" + v.map((x) => x.toFixed(6)).join(",") + "]";
