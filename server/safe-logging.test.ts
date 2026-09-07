import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createApiRequestLogger, logError } from "./safe-logging";
import { findUnsafeServerLogs } from "../script/check-safe-logging";

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

test("logging guard rejects request and response bodies", () => {
  const source = `
    console.log(req.body);
    console.info(response.body);
  `;

  const findings = findUnsafeServerLogs(source);
  assert.equal(findings.length, 2);
  assert(findings.every(({ reason }) => reason.includes("body")));
});

test("logging guard rejects recipient addresses and raw errors", () => {
  const source = `
    console.log("Sending to", recipient);
    console.error("Provider failed", error);
  `;

  const findings = findUnsafeServerLogs(source);
  assert.deepEqual(
    findings.map(({ reason }) => reason),
    ['private field "recipient"', "raw error object"],
  );
});

test("logging guard rejects known customer and health fields in nested forms", () => {
  const source = `
    console.log(client.phone);
    console.info({ notes: client.notes, responses: form.responses });
    console.warn(\`Session detail: \${sessionNote.content}\`);
    console.debug({ paymentLink: checkout.paymentLink, token });
    console.log(client.name);
  `;

  const findings = findUnsafeServerLogs(source);
  assert.equal(findings.length, 5);
  assert.deepEqual(
    findings.map(({ reason }) => reason),
    [
      'private field "phone"',
      'private field "notes"',
      'private field "content"',
      'private field "paymentLink"',
      'private field "name"',
    ],
  );
});

test("logging guard rejects arbitrary dynamic values by default", () => {
  const source = `
    console.log(customer);
    console.info(\`Created record: \${createdRecord}\`);
  `;

  const findings = findUnsafeServerLogs(source);
  assert.equal(findings.length, 2);
  assert(findings.every(({ reason }) => reason.includes("unapproved dynamic value")));
});

test("logging guard allows metadata-only logs and the shared safe logger", () => {
  const metadata = `
    console.log(\`POST /api/bookings \${res.statusCode} in \${duration}ms\`);
    console.info(\`received events=\${eventCount}\`);
    logError("Provider failed", error);
  `;
  const safeLogger = `
    export function logError(context: string, error: unknown): void {
      console.error(\`\${context}:\`, getSafeErrorSummary(error));
    }
  `;

  assert.deepEqual(findUnsafeServerLogs(metadata, "server/routes.ts"), []);
  assert.deepEqual(
    findUnsafeServerLogs(safeLogger, "server/safe-logging.ts"),
    [],
  );
});

test("logging guard rejects unsafe additions inside shared logging functions", () => {
  const unsafeErrorLogger = `
    export function logError(context: string, error: unknown): void {
      console.error(\`\${context}:\`, getSafeErrorSummary(error));
      console.error(error);
      console.log(req.body);
    }
  `;
  const unsafeRequestLogger = `
    export function log(message: string, source = "express") {
      console.log(\`\${formattedTime} [\${source}] \${message}\`);
      console.log(client.email);
      console.log(client.phone);
    }
  `;

  assert.deepEqual(
    findUnsafeServerLogs(unsafeErrorLogger, "server/safe-logging.ts").map(
      ({ reason }) => reason,
    ),
    ["raw error object", 'private field "body"'],
  );
  assert.deepEqual(
    findUnsafeServerLogs(unsafeRequestLogger, "server/index.ts").map(
      ({ reason }) => reason,
    ),
    ['private field "email"', 'private field "phone"'],
  );
});