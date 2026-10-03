import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import { templateInputSchema, validateFormAnswers, type TemplateInput } from "@shared/custom-forms";
import { registerCustomFormRoutes, hashFormToken } from "./custom-form-routes";
import { cleanAnswers, type CustomFormStorage, type TemplateRow, type RequestRow } from "./custom-form-storage";
import { createApiRequestLogger } from "./safe-logging";

const input: TemplateInput = {
  title: "Intake", description: "Your goals",
  questions: [
    { id: "goal", label: "What would you like to work on?", type: "textarea", required: true },
    { id: "ready", label: "Ready?", type: "yes_no", required: true },
    { id: "preference", label: "Preference", type: "single_choice", required: false, options: ["Online", "In person"] },
    { id: "topics", label: "Topics", type: "multiple_choice", required: false, options: ["Goals", "Habits"] },
  ],
};
const answers = { goal: "Fictional goals", ready: "Yes", topics: ["Goals"] };
let serial = 0;
const templates = new Map<string, TemplateRow>();
const requests = new Map<string, RequestRow>();
const logs: string[] = [];
let savedForms = 0;
const repository: CustomFormStorage = {
  templates: async owner => [...templates.values()].filter(row => row.userId === owner),
  template: async (owner, id) => templates.get(id)?.userId === owner ? templates.get(id) : undefined,
  createTemplate: async (owner, data) => {
    const row = { ...data, id: `template-${++serial}`, userId: owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    templates.set(row.id, row); return row;
  },
  updateTemplate: async (owner, id, data) => {
    const row = await repository.template(owner, id);
    if (!row) return undefined;
    const updated = { ...row, ...data }; templates.set(id, updated); return updated;
  },
  deleteTemplate: async (owner, id) => !!await repository.template(owner, id) && templates.delete(id),
  requests: async (owner, clientId) => [...requests.values()].filter(row => row.userId === owner && row.clientId === clientId),
  request: async (owner, id) => requests.get(id)?.userId === owner ? requests.get(id) : undefined,
  createRequest: async (owner, template, clientId, tokenHash, expiresAt) => {
    const row: RequestRow = {
      id: `request-${++serial}`, userId: owner, templateId: template.id, clientId, tokenHash, expiresAt,
      title: template.title, description: template.description, questions: structuredClone(template.questions),
      status: "pending", completedAt: null, clientFormId: null,
    };
    requests.set(row.id, row); return row;
  },
  publicRequest: async hash => [...requests.values()].find(row => row.tokenHash === hash && row.status === "pending" && Date.parse(row.expiresAt) > Date.now()),
  revoke: async (owner, id) => {
    const row = await repository.request(owner, id);
    if (!row || row.status !== "pending") return undefined;
    row.status = "revoked"; return row;
  },
  complete: async (selector, value) => {
    const row = "tokenHash" in selector ?
      await repository.publicRequest(selector.tokenHash) : await repository.request(selector.userId, selector.id);
    if (!row || row.status !== "pending") return undefined;
    cleanAnswers(row, value);
    row.status = "completed"; row.completedAt = new Date().toISOString(); row.clientFormId = `form-${++savedForms}`;
    return { request: row, form: {
      id: row.clientFormId, userId: row.userId, clientId: row.clientId, formType: "custom",
      title: row.title, responses: "[]", status: "completed", date: "2026-10-03", updatedAt: null,
    } };
  },
};
let server: ReturnType<typeof createServer>;
let origin: string;
async function call(path: string, body?: unknown, owner = "owner", method?: string) {
  const response = await fetch(origin + path, {
    method: method || (body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(owner ? { "x-owner": owner } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? undefined : await response.json();
  return { status: response.status, data, headers: response.headers };
}
async function assignment() {
  const template = (await call("/api/form-templates", input)).data;
  return (await call("/api/form-requests", { clientId: "client-owner", templateId: template.id })).data;
}
before(async () => {
  const app = express(); app.use(express.json());
  app.use(createApiRequestLogger(message => logs.push(message)));
  registerCustomFormRoutes(app, {
    forms: repository,
    storage: { getClient: async (owner, id) => id === `client-${owner}` ? { id, userId: owner } as any : undefined },
    getUserId: req => req.get("x-owner"),
    isAuthenticated: (req, res, next) => { if (!req.get("x-owner")) { res.sendStatus(401); return; } next(); },
  });
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

test("custom forms validate question definitions and all answer types", () => {
  assert.equal(templateInputSchema.safeParse(input).success, true);
  assert.equal(templateInputSchema.safeParse({ ...input, questions: [input.questions[0], input.questions[0]] }).success, false);
  assert.equal(templateInputSchema.safeParse({ ...input, userId: "foreign" }).success, false);
  assert.equal(templateInputSchema.safeParse({ ...input, questions: [{ ...input.questions[2], options: ["Same", "Same"] }] }).success, false);
  assert.deepEqual(validateFormAnswers(input.questions, answers), answers);
  for (const invalid of [{}, { ...answers, ready: "Maybe" }, { ...answers, unknown: "hidden" },
    { ...answers, goal: ["wrong"] }, { ...answers, topics: ["Not a choice"] }, { ...answers, topics: ["Goals", "Goals"] },
    { ...answers, preference: "Other" }, { ...answers, goal: "x".repeat(4001) }]) {
    assert.throws(() => validateFormAnswers(input.questions, invalid));
  }
});
test("coach templates are authenticated, strictly validated and owner scoped", async () => {
  const unauthenticated = await fetch(origin + "/api/form-templates");
  assert.equal(unauthenticated.status, 401);
  const created = await call("/api/form-templates", input);
  assert.equal(created.status, 201);
  assert.equal(created.data.userId, undefined);
  assert.equal((await call(`/api/form-templates/${created.data.id}`, input, "foreign", "PATCH")).status, 404);
  assert.equal((await call(`/api/form-templates/${created.data.id}`, undefined, "foreign", "DELETE")).status, 404);
  assert.equal((await call("/api/form-templates", { ...input, id: "injected" })).status, 400);
  assert.equal((await call(`/api/form-templates/${created.data.id}`, { ...input, title: "Updated" }, "owner", "PATCH")).data.title, "Updated");
  assert.equal((await call(`/api/form-templates/${created.data.id}`, undefined, "owner", "DELETE")).status, 204);
});
test("assignment cannot link another coach's client or template and never returns token hashes", async () => {
  const template = (await call("/api/form-templates", input)).data;
  assert.equal((await call("/api/form-requests", { templateId: template.id, clientId: "client-foreign" })).status, 404);
  assert.equal((await call("/api/form-requests", { templateId: template.id, clientId: "client-foreign" }, "foreign")).status, 404);
  assert.equal((await call("/api/form-requests?clientId=client-owner", undefined, "foreign")).status, 404);
  const { request, token } = await assignment();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(requests.get(request.id)?.tokenHash, token);
  const listed = await call("/api/form-requests?clientId=client-owner");
  assert.equal(listed.data.some((row: any) => row.token || row.tokenHash || row.userId), false);
  assert.equal((await call(`/api/form-requests/${request.id}/complete`, { answers }, "foreign")).status, 404);
  assert.equal((await call(`/api/form-requests/${request.id}/revoke`, {}, "foreign")).status, 404);
});
test("private links expose only the blank form, support one submission and never log answers or tokens", async () => {
  const { request, token } = await assignment();
  const loaded = await call("/api/public-forms/load", { token }, "");
  assert.equal(loaded.status, 200);
  assert.deepEqual(Object.keys(loaded.data).sort(), ["description", "expiresAt", "questions", "title"]);
  assert.equal(loaded.headers.get("referrer-policy"), "no-referrer");
  assert.match(loaded.headers.get("cache-control")!, /no-store/);
  assert.equal((await call("/api/public-forms/submit", { token, answers: {} }, "")).status, 400);
  assert.equal(requests.get(request.id)?.status, "pending");
  const submitted = await call("/api/public-forms/submit", { token, answers }, "");
  assert.deepEqual(submitted.data, { message: "Form submitted." });
  assert.equal(submitted.status, 200);
  assert.equal((await call("/api/public-forms/submit", { token, answers }, "")).status, 404);
  assert.equal((await call("/api/public-forms/load", { token }, "")).status, 404);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(!logs.join("\n").includes(token));
  assert.ok(!logs.join("\n").includes(answers.goal));
  assert.ok(!logs.join("\n").includes(hashFormToken(token)));
});
test("revoked, expired, malformed and unknown links cannot load or submit", async () => {
  const revoked = await assignment();
  assert.equal((await call(`/api/form-requests/${revoked.request.id}/revoke`, {})).status, 200);
  const expired = await assignment();
  requests.get(expired.request.id)!.expiresAt = "2000-01-01T00:00:00Z";
  for (const token of [revoked.token, expired.token, "bad", "f".repeat(64)]) {
    assert.equal((await call("/api/public-forms/load", { token }, "")).status, 404);
    assert.ok([400, 404].includes((await call("/api/public-forms/submit", { token, answers }, "")).status));
  }
  assert.equal((await call(`/api/form-requests/${expired.request.id}/complete`, { answers })).status, 200);
  assert.equal((await call(`/api/form-requests/${expired.request.id}/complete`, { answers })).status, 404);
});
test("editing a template does not rewrite an already assigned form", async () => {
  const { request, token } = await assignment();
  await call(`/api/form-templates/${request.templateId}`, { ...input, title: "Different", questions: [{ ...input.questions[0], label: "Changed question" }] }, "owner", "PATCH");
  const loaded = await call("/api/public-forms/load", { token }, "");
  assert.equal(loaded.data.title, input.title);
  assert.equal(loaded.data.questions[0].label, input.questions[0].label);
});