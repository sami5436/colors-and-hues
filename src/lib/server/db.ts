import "server-only";

import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;

// Created on first use: `next build` imports modules without runtime env vars.
export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({
      connectionString: url.replace("sslmode=require", "sslmode=verify-full"),
      max: 5,
    });
    pool.on("error", (error) => console.error("[pg]", error.message));
  }
  return pool;
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
