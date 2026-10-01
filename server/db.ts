import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Keep advisory-lock waiters off the application query pool. A waiter holds a
// connection until the current lock holder finishes, while the holder may need
// application-pool connections for its storage reads and writes.
const billingLockPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

export async function withBillingCheckoutLock<T>(
  userId: string,
  action: () => Promise<T>,
): Promise<T> {
  const connection = await billingLockPool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL lock_timeout = '30s'");
    await connection.query("SET LOCAL idle_in_transaction_session_timeout = '5min'");
    await connection.query(
      "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
      [`billing-checkout:${userId}`],
    );
    const result = await action();
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
