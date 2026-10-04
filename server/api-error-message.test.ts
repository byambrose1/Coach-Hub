import assert from "node:assert/strict";
import { test } from "node:test";
import { responseError } from "../client/src/lib/api-error";

test("API errors expose readable messages and preserve status and code", async () => {
  const error = await responseError(new Response(JSON.stringify({
    code: "BILLING_ACCOUNT_REVIEW_REQUIRED", message: "Contact support to reconnect billing.",
  }), { status: 409 }));
  assert.equal(error.message, "Contact support to reconnect billing.");
  assert.equal(error.status, 409);
  assert.equal(error.code, "BILLING_ACCOUNT_REVIEW_REQUIRED");
  assert.ok(!error.message.includes("{"));
});

test("non-JSON and malformed responses do not expose raw response bodies", async () => {
  for (const body of ["<html>Proxy error details</html>", "{malformed", JSON.stringify({ error: "provider internals" })]) {
    const error = await responseError(new Response(body, { status: 502 }));
    assert.equal(error.message, "This request could not be completed. Please try again.");
    assert.equal(error.status, 502);
  }
  assert.equal((await responseError(new Response("", { status: 401 }))).message, "Please sign in again to continue.");
});