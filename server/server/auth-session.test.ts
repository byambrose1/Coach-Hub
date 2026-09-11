import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createIsAuthenticated } from "./replit_integrations/auth/replitAuth";

const now = 1_800_000_000;

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