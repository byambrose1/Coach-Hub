import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createApiRequestLogger, logError } from "./safe-logging";

test("API request logs contain diagnostics without response data", async () => {
  const messages: string[] = [];
  const app = express();
  app.use(createApiRequestLogger((message) => messages.push(message)));
  app.get("/api/private", (_req, res) => {
    res.json({
      email: "customer@example.com",
      medicalConditions: "private health detail",
      paymentLink: "https://example.com/private-token",
    });
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/private`);
    assert.equal(response.status, 200);
    await response.json();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(messages.length, 1);
    assert.match(messages[0], /^GET \/api\/private 200 in \d+ms$/);
    assert.doesNotMatch(messages[0], /customer|medical|payment|private-token/i);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("error logs omit messages and arbitrary private fields", () => {
  const originalConsoleError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => calls.push(args);

  try {
    const error = Object.assign(
      new Error("Request failed for customer@example.com"),
      {
        code: "PAYMENT_FAILED",
        status: 502,
        response: { medicalConditions: "private health detail" },
      },
    );
    logError("Payment request failed", error);

    const serialized = JSON.stringify(calls);
    assert.match(serialized, /Payment request failed/);
    assert.match(serialized, /PAYMENT_FAILED/);
    assert.match(serialized, /502/);
    assert.doesNotMatch(serialized, /customer@example|medicalConditions|private health detail/);
  } finally {
    console.error = originalConsoleError;
  }
});