import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createIsAuthenticated, createOidcVerifier } from "./replit_integrations/auth/replitAuth";
import { authStorage } from "./replit_integrations/auth/storage";
import { db } from "./db";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const now = 1_800_000_000;

test("auth-user deletion targets all sessions for that subject before deleting the user", async () => {
  const original = db.transaction;
  const operations: any[] = [];
  (db as any).transaction = async (callback: any) => callback({
    delete: (table: any) => ({ where: async (predicate: any) => {
      operations.push({ table: getTableName(table), query: new PgDialect().sqlToQuery(predicate) });
    } }),
  });
  try {
    await authStorage.deleteUser("fixture-coach");
    assert.deepEqual(operations.map(operation => operation.table), ["sessions", "users"]);
    assert.match(operations[0].query.sql, /'passport'.*'user'.*'claims'.*'sub'/);
    assert.deepEqual(operations[0].query.params, ["fixture-coach"]);
    assert.deepEqual(operations[1].query.params, ["fixture-coach"]);
  } finally {
    db.transaction = original;
  }
});

test("a renewed session is saved before the next request and preserves the coach identity", async () => {
  const user: any = { claims: { sub: "fixture-coach" }, expires_at: now - 1, refresh_token: "fixture-refresh" };
  let snapshot: any;
  const req: any = {
    user, isAuthenticated: () => true,
    session: { passport: { user }, save: (callback: (error?: Error) => void) => {
      snapshot = JSON.parse(JSON.stringify(req.session.passport.user));
      callback();
    } },
  };
  const refresh = async () => ({ access_token: "fixture-access", refresh_token: "rotated-fixture", claims: () => ({ sub: "fixture-coach", exp: now + 3600 }) });
  const { response } = responseRecorder();
  let passed = false;
  await createIsAuthenticated({ now: () => now, refresh })(req, response, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(snapshot.claims.sub, "fixture-coach");
  assert.equal(snapshot.expires_at, now + 3600);
  assert.equal(snapshot.refresh_token, "rotated-fixture");
  req.user = snapshot;
  await createIsAuthenticated({ now: () => now + 30, refresh: async () => { throw new Error("No second refresh expected"); } })(req, response, () => {});
});

test("account creation errors cannot expose provider/database details or reject outside Passport", async () => {
  const tokens: any = { access_token: "fixture", claims: () => ({ sub: "fixture-coach", email: "fixture@example.com", exp: now + 3600 }) };
  let receivedError: any;
  const verify = createOidcVerifier(async () => { throw new Error("private database details and duplicate account email"); });
  await verify(tokens, (error: any) => { receivedError = error; });
  assert.equal(receivedError.message, "Unable to complete sign-in. Please retry or contact support.");
});

function responseRecorder() {
  const result = { status: 200, body: undefined as unknown };
  const response = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as Response;
  return { response, result };
}

async function runMiddleware(
  user: Record<string, unknown>,
  refresh?: (refreshToken: string) => Promise<any>
) {
  let nextCalled = false;
  const request = {
    user,
    isAuthenticated: () => true,
  } as unknown as Request;
  const { response, result } = responseRecorder();
  const middleware = createIsAuthenticated({
    now: () => now,
    refresh,
  });

  await middleware(
    request,
    response,
    (() => {
      nextCalled = true;
    }) as NextFunction
  );

  return { nextCalled, result, user };
}

test("allows a valid unexpired session without refreshing", async () => {
  let refreshCalled = false;
  const outcome = await runMiddleware(
    { expires_at: now + 60 },
    async () => {
      refreshCalled = true;
      throw new Error("refresh should not run");
    }
  );

  assert.equal(outcome.nextCalled, true);
  assert.equal(refreshCalled, false);
});

test("refreshes an expired session without calling the OIDC provider", async () => {
  let receivedRefreshToken = "";
  const outcome = await runMiddleware(
    {
      claims: { sub: "coach" },
      access_token: "expired-access",
      refresh_token: "existing-refresh",
      expires_at: now - 1,
    },
    async (refreshToken) => {
      receivedRefreshToken = refreshToken;
      return {
        access_token: "fresh-access",
        claims: () => ({ sub: "coach", exp: now + 3600 }),
      };
    }
  );

  assert.equal(outcome.nextCalled, true);
  assert.equal(receivedRefreshToken, "existing-refresh");
  assert.equal(outcome.user.access_token, "fresh-access");
  assert.equal(outcome.user.refresh_token, "existing-refresh");
  assert.equal(outcome.user.expires_at, now + 3600);
});

test("rejects an expired session that has no refresh token", async () => {
  const outcome = await runMiddleware({
    expires_at: now - 1,
  });

  assert.equal(outcome.nextCalled, false);
  assert.equal(outcome.result.status, 401);
  assert.deepEqual(outcome.result.body, { message: "Unauthorized" });
});

test("returns a safe 401 when refreshing an expired session fails", async () => {
  const outcome = await runMiddleware(
    {
      refresh_token: "invalid-refresh",
      expires_at: now - 1,
    },
    async () => {
      throw new Error("provider response with sensitive details");
    }
  );

  assert.equal(outcome.nextCalled, false);
  assert.equal(outcome.result.status, 401);
  assert.deepEqual(outcome.result.body, { message: "Unauthorized" });
});