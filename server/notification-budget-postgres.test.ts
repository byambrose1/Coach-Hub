import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { createNotificationBudgetStore } from "./email-notification-budget";
import { createPlatformStaffStore } from "./platform-staff";

test("Postgres enforces the weekly cap under concurrent reservations and persists staff revocation", async () => {
  const namespace = `notification_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8, options: `-c search_path=${namespace}` });
  try {
    await pool.query(`CREATE SCHEMA "${namespace}"`);
    await pool.query(`CREATE TABLE users (id varchar PRIMARY KEY);
      INSERT INTO users VALUES ('coach'), ('other');
      CREATE TABLE email_notification_usage (
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start date NOT NULL, used_count integer NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, week_start), CHECK(used_count >= 0 AND used_count <= 10));
      CREATE TABLE platform_staff (
        user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        active boolean NOT NULL DEFAULT true, granted_by varchar NOT NULL,
        updated_at timestamp with time zone NOT NULL DEFAULT now());`);
    const database = drizzle(pool, { schema });
    const budget = createNotificationBudgetStore(database);
    const results = await Promise.all(Array.from({ length: 40 }, () => budget.reserve("coach", "2026-10-05")));
    assert.equal(results.filter(Boolean).length, 10);
    assert.equal(await budget.used("coach", "2026-10-05"), 10);
    assert.equal(await budget.reserve("other", "2026-10-05"), true);
    assert.equal(await budget.reserve("coach", "2026-10-12"), true);
    await budget.releaseRejected("coach", "2026-10-05");
    assert.equal(await budget.used("coach", "2026-10-05"), 9);
    assert.equal(await budget.reserve("coach", "2026-10-05"), true);
    const staff = createPlatformStaffStore(database);
    await staff.setAccess("coach", true, "owner");
    assert.equal((await staff.get("coach"))?.active, true);
    await staff.setAccess("coach", false, "owner");
    assert.equal((await staff.get("coach"))?.active, false);
    assert.equal((await staff.list()).length, 1);
  } finally {
    try { await pool.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`); }
    finally { await pool.end(); }
  }
});
