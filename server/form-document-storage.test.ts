import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { ensureCustomFormsSchema } from "./custom-form-schema";
import { createCustomFormStorage } from "./custom-form-storage";
import { createFormDocumentStorage } from "./form-document-storage";
import { validateDocument, FormDocumentError } from "./form-document-validation";
import { hashFormToken } from "./custom-form-routes";

// Only synthetic rows in a fresh, isolated schema. Never use production APIs
// or delete/update the application's existing client records.
const available = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("test:test@localhost");
test("private document persistence, atomic ownership/quotas and deletion lifecycle", { skip: !available }, async () => {
  const name = `doc_test_${randomUUID().replaceAll("-", "")}`;
  const control = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  let pool: pg.Pool | undefined;
  try {
    await control.query(`CREATE SCHEMA "${name}"`);
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${name},public`, max: 5 });
    const isolated = drizzle(pool, { schema });
    await isolated.execute(sql.raw("CREATE TABLE clients (LIKE public.clients INCLUDING ALL); CREATE TABLE client_forms (LIKE public.client_forms INCLUDING ALL);"));
    await ensureCustomFormsSchema(isolated);
    const forms = createCustomFormStorage(isolated);
    const docs = createFormDocumentStorage(isolated);
    const [client] = await isolated.insert(schema.clients).values({ userId: "test-owner", name: "Synthetic document client" }).returning();
    const template = await forms.createTemplate("test-owner", { title: "Intake", description: "", questions: [
      { id: "file", label: "Document", type: "file", required: true },
      { id: "optional", label: "Optional document", type: "file", required: false },
    ] });
    const tokenHash = hashFormToken("c".repeat(64));
    const request = await forms.createRequest("test-owner", template, client.id, tokenHash, new Date(Date.now() + 86400000).toISOString());
    const file = validateDocument("evidence.pdf", Buffer.from("%PDF-1.7\nSynthetic fixture\n%%EOF\n"));
    const first = await docs.save({ tokenHash }, "file", file);
    const replacement = await docs.save({ tokenHash }, "file", file);
    assert.equal(await docs.download("test-owner", first.id), undefined, "replacement removes old staged bytes");
    assert.equal(await docs.download("other-owner", replacement.id), undefined);
    assert.equal(await forms.complete({ tokenHash }, { file: randomUUID() }).then(() => "unexpected", e => e instanceof FormDocumentError), true);
    assert.equal((await forms.publicRequest(tokenHash))?.status, "pending", "failed submission does not consume the link");
    const unselected = await docs.save({ tokenHash }, "optional", file);
    const completed = await forms.complete({ tokenHash }, { file: replacement.id });
    assert.ok(completed);
    const responses = JSON.parse(completed.form.responses!);
    assert.equal(responses[0].documentId, replacement.id);
    assert.equal(responses[0].answer, "evidence.pdf");
    assert.equal(await docs.download("test-owner", unselected.id), undefined);
    const persisted = await docs.download("test-owner", replacement.id);
    assert.deepEqual(persisted?.content, file.content);
    assert.equal(persisted?.expiresAt, null);
    assert.equal(persisted?.clientFormId, completed.form.id);
    assert.equal(await forms.publicRequest(tokenHash), undefined, "completed bearer token cannot be reused");
    await assert.rejects(() => docs.save({ tokenHash }, "file", file), e => e instanceof FormDocumentError && e.status === 404);
    await isolated.delete(schema.clientForms).where(eq(schema.clientForms.id, completed.form.id));
    assert.equal(await docs.download("test-owner", replacement.id), undefined, "deleting a completed form removes its bytes");

    const makeRequest = () => forms.createRequest("test-owner", template, client.id, randomUUID(), new Date(Date.now() + 86400000).toISOString());
    const revoked = await makeRequest();
    const staged = await docs.save({ userId: "test-owner", id: revoked.id }, "file", file);
    await forms.revoke("test-owner", revoked.id);
    assert.equal(await docs.download("test-owner", staged.id), undefined, "revoke deletes staged files");

    // Smaller injected limit exercises the same database locks without
    // allocating 50 MB of test data.
    const smallQuota = createFormDocumentStorage(isolated, file.byteSize);
    const requests = await Promise.all([makeRequest(), makeRequest()]);
    const results = await Promise.allSettled(requests.map(r => smallQuota.save({ userId: "test-owner", id: r.id }, "file", file)));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.filter(r => r.status === "rejected" && r.reason instanceof FormDocumentError && r.reason.status === 409).length, 1);
    const quotaFile = (results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<any>).value;
    await isolated.delete(schema.clients).where(eq(schema.clients.id, client.id));
    assert.equal(await docs.download("test-owner", quotaFile.id), undefined, "client deletion cascades documents");
    const [count] = await isolated.select({ value: sql<number>`count(*)` }).from(schema.formDocuments);
    assert.equal(Number(count.value), 0);
  } finally {
    await pool?.end();
    await control.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await control.end();
  }
});
