import { sql } from "drizzle-orm";
import { db } from "./db";

// Additive and idempotent: never use a schema push that could drop legacy data.
export async function ensureCustomFormsSchema() {
  await db.transaction(async tx => {
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS form_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL, title text NOT NULL,
        description text NOT NULL DEFAULT '', questions jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS form_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        template_id varchar REFERENCES form_templates(id) ON DELETE SET NULL,
        client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        title text NOT NULL, description text NOT NULL DEFAULT '', questions jsonb NOT NULL,
        token_hash text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending',
        expires_at timestamptz NOT NULL, completed_at timestamptz,
        client_form_id varchar REFERENCES client_forms(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS form_templates_owner_idx ON form_templates(user_id);
      CREATE INDEX IF NOT EXISTS form_requests_client_owner_idx ON form_requests(user_id, client_id);
    `));
  });
}