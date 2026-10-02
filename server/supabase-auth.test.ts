import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "./db";
import { resolveCoach, AccountLinkError } from "./auth/identities";
import { AUTH_TTL, equalToken, validTransaction } from "./auth/supabase";
import { createSupabaseAuthentication } from "./auth/supabase-session";
import { supabaseClient, supabaseAdmin, getAuthProviders } from "./auth/supabase-client";

// Fixture configuration is isolated to this test worker. No provider calls.
process.env.SUPABASE_URL = "https://fixture.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-public";
process.env.SUPABASE_SECRET_KEY = "fixture-admin";
const provider: any = { id: "fixture-subject", email: "fixture@example.test", user_metadata: {} };
const identity = "supabase:fixture.supabase.co:fixture-subject";

test("the installed SDK constructs both clients on Node without a native WebSocket", () => {
  assert.equal(typeof supabaseClient().auth.getUser, "function");
  assert.equal(typeof supabaseAdmin().auth.admin.deleteUser, "function");
});

test("login availability follows actual provider settings rather than assuming GitHub is enabled", async () => {
  const available: any = async () => Response.json({ external: { github: false, email: true } });
  assert.deepEqual(await getAuthProviders(available), { github: false, email: true });
  const enabled: any = async () => Response.json({ external: { github: true, email: true } });
  assert.equal((await getAuthProviders(enabled)).github, true);
  const failed: any = async () => new Response("", { status: 503 });
  await assert.rejects(getAuthProviders(failed));
});

test("callbacks require a matching, unexpired transaction; malformed and reused state fails", () => {
  const pending = { state: "random-fixture-state", startedAt: 1_800_000_000_000 };
  assert.equal(validTransaction(pending, pending.state, pending.startedAt + 100), true);
  for (const state of [undefined, ["random-fixture-state"], "", "different", "x".repeat(257)]) {
    assert.equal(validTransaction(pending, state, pending.startedAt + 100), false);
  }
  assert.equal(validTransaction(undefined, pending.state), false);
  assert.equal(validTransaction(pending, pending.state, pending.startedAt + AUTH_TTL), false);
  assert.equal(validTransaction(pending, pending.state, pending.startedAt - 1), false);
  assert.equal(validTransaction({ ...pending, startedAt: 0 }, pending.state, pending.startedAt), false);
  assert.equal(equalToken("é", "aa"), false);
});

async function fixtureDatabase(options: { mapping?: string; existingEmail?: boolean; legacy?: boolean }, run: (writes: any[]) => Promise<void>) {
  const original = db.transaction;
  const writes: any[] = [];
  let userReads = 0;
  const coach = { id: "original-coach", email: "original@example.test" };
  (db as any).transaction = async (callback: any) => callback({
    execute: async (query: any) => {
      assert.match(new PgDialect().sqlToQuery(query).sql, /pg_advisory_xact_lock/);
    },
    select: () => ({
      from: (table: any) => ({ where: async () => {
        if (getTableName(table) === "auth_identities") return options.mapping ? [{ userId: options.mapping }] : [];
        userReads++;
        if (options.mapping || options.legacy) return [coach];
        return options.existingEmail ? [coach] : [];
      } }),
    }),
    insert: (table: any) => ({ values: (data: any) => {
      writes.push({ table: getTableName(table), data });
      if (getTableName(table) === "users") return { returning: async () => [{ ...data }] };
      return Promise.resolve();
    } }),
  });
  try { await run(writes); }
  finally { db.transaction = original; }
}

test("new Supabase users get a distinct account and explicit subject mapping", async () => {
  await fixtureDatabase({}, async writes => {
    const coach = await resolveCoach(provider);
    assert.equal(coach.id, identity);
    assert.deepEqual(writes.map(write => write.table), ["users", "auth_identities"]);
    assert.equal(writes[1].data.userId, identity);
  });
});
test("a verified legacy link preserves the original coach ID without rewriting billing or client records", async () => {
  await fixtureDatabase({ legacy: true }, async writes => {
    const coach = await resolveCoach(provider, "original-coach");
    assert.equal(coach.id, "original-coach");
    assert.deepEqual(writes, [{ table: "auth_identities", data: { identity, userId: "original-coach" } }]);
  });
});
test("matching email alone cannot link or take over an existing coach", async () => {
  await fixtureDatabase({ existingEmail: true }, async writes => {
    await assert.rejects(resolveCoach(provider), (error: any) => error instanceof AccountLinkError && error.code === "link_required");
    assert.equal(writes.length, 0);
  });
});
test("an identity already linked elsewhere cannot be reassigned", async () => {
  await fixtureDatabase({ mapping: "another-coach" }, async writes => {
    await assert.rejects(resolveCoach(provider, "original-coach"), (error: any) => error.code === "already_linked");
    assert.equal(writes.length, 0);
  });
});
test("returning Supabase login reuses the stored coach mapping", async () => {
  await fixtureDatabase({ mapping: "original-coach" }, async writes => {
    assert.equal((await resolveCoach(provider)).id, "original-coach");
    assert.equal(writes.length, 0);
  });
});

async function authenticate({ expired = false, wrongSubject = false, wrongMapping = false, deleted = false, rejected = false, saveFails = false } = {}) {
  const user: any = {
    auth_provider: "supabase", supabase_subject: "fixture-subject",
    claims: { sub: "original-coach", email: "original@example.test" }, access_token: "fixture-access", refresh_token: "fixture-refresh",
    expires_at: expired ? 99 : 5000,
  };
  let saved = false;
  const req: any = { user, isAuthenticated: () => true, session: {
    passport: { user }, save: (callback: any) => { saved = true; callback(saveFails ? new Error("Simulated save failure") : undefined); },
  } };
  let status: number | undefined;
  let passed = false;
  const res: any = { status: (code: number) => { status = code; return res; }, json: () => {} };
  const session: any = { access_token: "rotated-access", refresh_token: "rotated-refresh", expires_at: 3600,
    user: { id: wrongSubject ? "different-subject" : "fixture-subject" } };
  const client: any = { auth: {
    getUser: async () => ({ data: { user: { id: wrongSubject ? "different-subject" : "fixture-subject" } }, error: rejected ? new Error("Provider rejected token") : null }),
    refreshSession: async () => ({ data: { session }, error: rejected ? new Error("Provider rejected refresh") : null }),
  } };
  const middleware = createSupabaseAuthentication({
    client: () => client, now: () => 100,
    mapping: async () => wrongMapping ? "another-coach" : "original-coach",
    getAccount: async () => deleted ? undefined : { id: "original-coach" } as any,
  });
  await middleware(req, res, () => { passed = true; });
  return { status, passed, saved, user };
}
test("Supabase session validates provider subject, stored mapping and local account", async () => {
  assert.equal((await authenticate()).passed, true);
  for (const options of [{ wrongSubject: true }, { wrongMapping: true }, { deleted: true }, { rejected: true }]) {
    const result = await authenticate(options);
    assert.equal(result.passed, false);
    assert.equal(result.status, 401);
  }
});
test("refresh preserves the coach ID, rotates tokens and saves before allowing access", async () => {
  const result = await authenticate({ expired: true });
  assert.equal(result.passed, true);
  assert.equal(result.saved, true);
  assert.equal(result.user.claims.sub, "original-coach");
  assert.equal(result.user.claims.email, "original@example.test");
  assert.equal(result.user.refresh_token, "rotated-refresh");
  for (const options of [{ wrongSubject: true }, { rejected: true }, { saveFails: true }]) {
    assert.equal((await authenticate({ expired: true, ...options })).status, 401);
  }
});