import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { clients, formRequests } from "../shared/schema";
import { storage } from "../server/storage";
import { ensureCustomFormsSchema } from "../server/custom-form-schema";
import { customFormStorage as forms } from "../server/custom-form-storage";
import { hashFormToken } from "../server/custom-form-routes";

if (process.env.NODE_ENV === "production") throw new Error("Run this fictional-data test in development only.");
const owner = `custom-forms-fixture-${randomUUID()}`;
const question = { id: "goal", label: "Fictional question", type: "text" as const, required: true };
const tokenHash = () => hashFormToken(randomBytes(32).toString("hex"));
try {
  await ensureCustomFormsSchema();
  const client = (await db.insert(clients).values({ userId: owner, name: "Fictional custom forms fixture" }).returning())[0];
  const template = await forms.createTemplate(owner, { title: "Fictional intake", description: "", questions: [question] });
  const hash = tokenHash();
  const request = await forms.createRequest(owner, template, client.id, hash, new Date(Date.now() + 86400000).toISOString());
  assert.equal(await forms.request("foreign-fixture", request.id), undefined);
  await forms.updateTemplate(owner, template.id, { title: "Edited template", description: "", questions: [{ ...question, label: "Edited question" }] });
  assert.equal((await forms.publicRequest(hash))!.title, "Fictional intake");
  assert.equal((await forms.publicRequest(hash))!.questions[0].label, "Fictional question");
  const results = await Promise.all([
    forms.complete({ tokenHash: hash }, { goal: "Fictional answer" }),
    forms.complete({ userId: owner, id: request.id }, { goal: "Fictional second answer" }),
  ]);
  assert.equal(results.filter(Boolean).length, 1, "Concurrent client/coach submissions save only once");
  assert.equal((await storage.getClientForms(owner)).length, 1);
  assert.equal(await forms.publicRequest(hash), undefined);
  const saved = results.find(Boolean)!.form;
  assert.equal(JSON.parse(saved.responses)[0].question, "Fictional question");
  assert.equal(saved.formType, "custom");
  const expiredHash = tokenHash();
  const expired = await forms.createRequest(owner, template, client.id, expiredHash, "2000-01-01T00:00:00Z");
  assert.equal(await forms.publicRequest(expiredHash), undefined);
  assert.equal(await forms.complete({ tokenHash: expiredHash }, { goal: "Fictional" }), undefined);
  assert.ok(await forms.complete({ userId: owner, id: expired.id }, { goal: "Fictional" }));
  const revokedHash = tokenHash();
  const revoked = await forms.createRequest(owner, template, client.id, revokedHash, new Date(Date.now() + 86400000).toISOString());
  assert.ok(await forms.revoke(owner, revoked.id));
  assert.equal(await forms.complete({ userId: owner, id: revoked.id }, { goal: "Fictional" }), undefined);
  assert.equal(await forms.publicRequest(revokedHash), undefined);
  await forms.deleteTemplate(owner, template.id);
  assert.equal((await forms.request(owner, revoked.id))!.templateId, null);
  await storage.deleteClient(owner, client.id);
  assert.equal((await db.select().from(formRequests).where(eq(formRequests.userId, owner))).length, 0);
  assert.equal((await storage.getClientForms(owner)).length, 0);
  // Check account deletion also removes unassigned global templates.
  await forms.createTemplate(owner, { title: "Deletion fixture", description: "", questions: [question] });
  await storage.deleteAccountData(owner);
  assert.equal((await forms.templates(owner)).length, 0);
  console.log("Custom forms PostgreSQL checks passed: persistence, ownership, snapshots, concurrent submission, expiry, revocation and deletion.");
  console.log("Only disposable fictional fixtures were created and removed; no accounts, emails or payments were used.");
} finally {
  await storage.deleteAccountData(owner);
  await pool.end();
}