import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import express, { type RequestHandler } from "express";
import { registerRoutes } from "./routes";
import { createApiRequestLogger } from "./safe-logging";
import type { IStorage } from "./storage";
import {
  parseOnboardingProgress,
  serializeOnboardingProgress,
  toggleOnboardingStep,
} from "../client/src/lib/onboarding-progress";

const coachId = "test-coach";
let baseUrl = "";
let server: ReturnType<typeof createServer>;
const requestLogs: string[] = [];

const state = {
  settings: undefined as any,
  clients: [] as any[],
  sessions: [] as any[],
  packages: [] as any[],
  notes: [] as any[],
  forms: [] as any[],
  referrals: [] as any[],
  invoices: [] as any[],
};

const withId = (collection: any[], userId: string, data: any) => {
  const value = { ...data, id: `${collection.length + 1}`, userId };
  collection.push(value);
  return value;
};

const storage = {
  async getClients(userId: string) {
    return state.clients.filter((item) => item.userId === userId);
  },
  async getClient(userId: string, id: string) {
    return state.clients.find((item) => item.id === id && item.userId === userId);
  },
  async createClient(userId: string, data: any) {
    return withId(state.clients, userId, data);
  },
  async updateClient(userId: string, id: string, data: any) {
    const item = state.clients.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async deleteClient(userId: string, id: string) {
    state.clients = state.clients.filter((item) => item.id !== id || item.userId !== userId);
  },
  async getSessions(userId: string) {
    return state.sessions.filter((item) => item.userId === userId);
  },
  async getSession(userId: string, id: string) {
    return state.sessions.find((item) => item.id === id && item.userId === userId);
  },
  async createSession(userId: string, data: any) {
    return withId(state.sessions, userId, data);
  },
  async updateSession(userId: string, id: string, data: any) {
    const item = state.sessions.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async deleteSession(userId: string, id: string) {
    state.sessions = state.sessions.filter((item) => item.id !== id || item.userId !== userId);
  },
  async getPackages(userId: string) {
    return state.packages.filter((item) => item.userId === userId);
  },
  async getPackage(userId: string, id: string) {
    return state.packages.find((item) => item.id === id && item.userId === userId);
  },
  async updatePackage(userId: string, id: string, data: any) {
    const item = state.packages.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async getNotes(userId: string) {
    return state.notes.filter((item) => item.userId === userId);
  },
  async getNote(userId: string, id: string) {
    return state.notes.find((item) => item.id === id && item.userId === userId);
  },
  async updateNote(userId: string, id: string, data: any) {
    const item = state.notes.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async deleteNote(userId: string, id: string) {
    state.notes = state.notes.filter((item) => item.id !== id || item.userId !== userId);
  },
  async getSettings(userId: string) {
    return state.settings?.id === userId ? state.settings : undefined;
  },
  async upsertSettings(userId: string, data: any) {
    state.settings = { ...(state.settings ?? {}), ...data, id: userId };
    return state.settings;
  },
  async getClientForms(userId: string) {
    return state.forms.filter((item) => item.userId === userId);
  },
  async createClientForm(userId: string, data: any) {
    return withId(state.forms, userId, data);
  },
  async getClientForm(userId: string, id: string) {
    return state.forms.find((item) => item.id === id && item.userId === userId);
  },
  async updateClientForm(userId: string, id: string, data: any) {
    const item = state.forms.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async deleteClientForm(userId: string, id: string) {
    state.forms = state.forms.filter((item) => item.id !== id || item.userId !== userId);
  },
  async updateReferral(userId: string, id: string, data: any) {
    const item = state.referrals.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async getInvoices(userId: string) {
    return state.invoices.filter((item) => item.userId === userId);
  },
  async getInvoice(userId: string, id: string) {
    return state.invoices.find((item) => item.id === id && item.userId === userId);
  },
  async createInvoice(userId: string, data: any) {
    return withId(state.invoices, userId, data);
  },
  async updateInvoice(userId: string, id: string, data: any) {
    const item = state.invoices.find((value) => value.id === id && value.userId === userId);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  },
  async getPlatformConfig() {
    return { tier1MaxClients: 5 };
  },
} as unknown as IStorage;

const authenticate: RequestHandler = (req, _res, next) => {
  const authenticatedCoachId = req.get("x-test-coach-id") || coachId;
  req.user = {
    claims: { sub: authenticatedCoachId },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  req.isAuthenticated = () => true;
  (req as any).session = {};
  next();
};

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = response.status === 204 ? undefined : await response.json();
  return { response, body };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(createApiRequestLogger((message) => requestLogs.push(message)));
  server = createServer(app);
  await registerRoutes(server, app, {
    storage,
    isAuthenticated: authenticate,
    sendBookingNotificationEmail: async () => {},
    createMandateLink: async () => {
      throw new Error(
        "private-provider-detail: GoCardless credential gc_secret_123 was rejected",
      );
    },
    sendParqEmail: async () => {
      throw new Error(
        "private-provider-detail: Brevo request for client@example.test was rejected",
      );
    },
    sendBroadcastEmail: async () => {
      throw new Error("private-provider-detail: Brevo broadcast request was rejected");
    },
    sendLowSessionsEmail: async () => {
      throw new Error("private-provider-detail: Brevo low-session request was rejected");
    },
    sendInvoiceEmail: async () => {
      throw new Error("private-provider-detail: Brevo invoice request was rejected");
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("persists onboarding completion, uncompletion, dismissal, and refresh", async () => {
  const initial = await request("/api/settings");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.id, coachId);

  const completed = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({
      onboardingProgress: serializeOnboardingProgress({ profile: true, client: true }),
      onboardingDismissed: false,
    }),
  });
  assert.equal(completed.body.onboardingProgress, '{"profile":true,"client":true}');

  const nextProgress = toggleOnboardingStep(
    parseOnboardingProgress(completed.body.onboardingProgress),
    "client",
  );
  const uncompleted = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({
      onboardingProgress: serializeOnboardingProgress(nextProgress),
    }),
  });
  assert.equal(uncompleted.body.onboardingProgress, '{"profile":true,"client":false}');

  await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ onboardingDismissed: true }),
  });
  const refreshed = await request("/api/settings");
  assert.equal(refreshed.body.onboardingDismissed, true);
  assert.equal(refreshed.body.onboardingProgress, '{"profile":true,"client":false}');
  assert.deepEqual(parseOnboardingProgress(refreshed.body.onboardingProgress), {
    profile: true,
    client: false,
  });
});

test("keeps the checklist serialization boundary safe", () => {
  assert.deepEqual(parseOnboardingProgress("not-json"), {});
  const completed = toggleOnboardingStep({}, "business");
  assert.equal(serializeOnboardingProgress(completed), '{"business":true}');
  assert.deepEqual(parseOnboardingProgress(serializeOnboardingProgress(completed)), {
    business: true,
  });
});

test("creates the first client, booking, PAR-Q form, and invoice", async () => {
  const clientResult = await request("/api/clients", {
    method: "POST",
    body: JSON.stringify({ name: "Test Client", email: "client@example.test" }),
  });
  assert.equal(clientResult.response.status, 201);
  assert.equal(clientResult.body.userId, coachId);

  const sessionResult = await request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      clientId: clientResult.body.id,
      title: "First coaching session",
      date: "2026-09-07",
      startTime: "09:00",
      endTime: "10:00",
    }),
  });
  assert.equal(sessionResult.response.status, 201);

  const formResult = await request("/api/forms", {
    method: "POST",
    body: JSON.stringify({
      clientId: clientResult.body.id,
      formType: "parq",
      title: "PAR-Q Health Screening",
      responses: JSON.stringify([{ question: "Ready?", answer: "Yes" }]),
      date: "2026-09-06",
      status: "completed",
    }),
  });
  assert.equal(formResult.response.status, 201);

  const invoiceResult = await request("/api/invoices", {
    method: "POST",
    body: JSON.stringify({
      clientId: clientResult.body.id,
      invoiceNumber: "INV-TEST-001",
      amount: "50.00",
      dueDate: "2026-09-14",
    }),
  });
  assert.equal(invoiceResult.response.status, 201);

  assert.equal((await request("/api/clients")).body.length, 1);
  assert.equal((await request("/api/sessions")).body.length, 1);
  assert.equal((await request("/api/forms")).body.length, 1);
  assert.equal((await request("/api/invoices")).body.length, 1);

  await new Promise((resolve) => setImmediate(resolve));
  const dashboardLogs = requestLogs.join("\n");
  assert.match(dashboardLogs, /GET \/api\/clients 200 in \d+ms/);
  assert.match(dashboardLogs, /GET \/api\/sessions 200 in \d+ms/);
  assert.match(dashboardLogs, /GET \/api\/forms 200 in \d+ms/);
  assert.match(dashboardLogs, /GET \/api\/invoices 200 in \d+ms/);
  assert.doesNotMatch(
    dashboardLogs,
    /Test Client|client@example|First coaching session|PAR-Q Health Screening|Ready\?|INV-TEST-001|50\.00/,
  );
});

test("payment provider failures return a stable response without provider details", async () => {
  const client = state.clients[0];
  const result = await request("/api/payments/create-mandate-link", {
    method: "POST",
    body: JSON.stringify({ clientId: client.id }),
  });
  assert.equal(result.response.status, 502);
  assert.deepEqual(result.body, {
    code: "PAYMENT_PROVIDER_ERROR",
    message: "Unable to create the payment link. Please try again.",
  });
  assert.doesNotMatch(JSON.stringify(result.body), /GoCardless|gc_secret|private-provider-detail/i);
});

test("email provider failures return stable responses without provider details", async () => {
  const client = state.clients[0];
  const pkg = withId(state.packages, coachId, {
    clientId: client.id,
    name: "Test Package",
    totalSessions: 10,
    usedSessions: 9,
  });
  const invoice = state.invoices[0];
  const attempts: Array<[string, RequestInit]> = [
    [
      "/api/parq/send-email",
      { method: "POST", body: JSON.stringify({ clientId: client.id }) },
    ],
    [
      "/api/emails/broadcast",
      {
        method: "POST",
        body: JSON.stringify({ subject: "Update", message: "Hello" }),
      },
    ],
    [`/api/packages/${pkg.id}/notify-low-sessions`, { method: "POST" }],
    [`/api/invoices/${invoice.id}/send`, { method: "POST" }],
  ];

  for (const [path, init] of attempts) {
    const result = await request(path, init);
    assert.equal(result.response.status, 502, path);
    assert.deepEqual(result.body, {
      code: "EMAIL_PROVIDER_ERROR",
      message: "Unable to send the email. Please try again.",
    });
    assert.doesNotMatch(
      JSON.stringify(result.body),
      /Brevo|client@example|private-provider-detail/i,
    );
  }
});

test("rejects record IDs owned by a different authenticated coach", async () => {
  const otherCoachId = "other-test-coach";
  const foreignClient = { id: "foreign-client", userId: otherCoachId, name: "Private Client", email: "private@example.test" };
  const foreignSession = { id: "foreign-session", userId: otherCoachId, clientId: foreignClient.id, status: "scheduled" };
  const foreignPackage = { id: "foreign-package", userId: otherCoachId, clientId: foreignClient.id, name: "Private Package", totalSessions: 5, usedSessions: 0 };
  const foreignNote = { id: "foreign-note", userId: otherCoachId, clientId: foreignClient.id, content: "Private note" };
  const foreignForm = { id: "foreign-form", userId: otherCoachId, clientId: foreignClient.id, title: "Private form" };
  const foreignReferral = { id: "foreign-referral", userId: otherCoachId, status: "pending" };
  const foreignInvoice = { id: "foreign-invoice", userId: otherCoachId, clientId: foreignClient.id, invoiceNumber: "PRIVATE", amount: "100", dueDate: "2026-10-01" };
  state.clients.push(foreignClient);
  state.sessions.push(foreignSession);
  state.packages.push(foreignPackage);
  state.notes.push(foreignNote);
  state.forms.push(foreignForm);
  state.referrals.push(foreignReferral);
  state.invoices.push(foreignInvoice);

  const attempts: Array<[string, RequestInit | undefined]> = [
    [`/api/clients/${foreignClient.id}`, undefined],
    [`/api/clients/${foreignClient.id}`, { method: "PATCH", body: JSON.stringify({ name: "Stolen" }) }],
    [`/api/clients/${foreignClient.id}`, { method: "DELETE" }],
    [`/api/clients/${foreignClient.id}/export`, undefined],
    ["/api/parq/send-email", { method: "POST", body: JSON.stringify({ clientId: foreignClient.id }) }],
    ["/api/payments/create-mandate-link", { method: "POST", body: JSON.stringify({ clientId: foreignClient.id }) }],
    [`/api/sessions/${foreignSession.id}`, undefined],
    [`/api/sessions/${foreignSession.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }],
    [`/api/sessions/${foreignSession.id}`, { method: "DELETE" }],
    [`/api/packages/${foreignPackage.id}`, { method: "PATCH", body: JSON.stringify({ name: "Stolen" }) }],
    [`/api/packages/${foreignPackage.id}/notify-low-sessions`, { method: "POST" }],
    [`/api/notes/${foreignNote.id}`, undefined],
    [`/api/notes/${foreignNote.id}`, { method: "PATCH", body: JSON.stringify({ content: "Stolen" }) }],
    [`/api/notes/${foreignNote.id}`, { method: "DELETE" }],
    [`/api/forms/${foreignForm.id}`, undefined],
    [`/api/forms/${foreignForm.id}`, { method: "PATCH", body: JSON.stringify({ title: "Stolen" }) }],
    [`/api/forms/${foreignForm.id}`, { method: "DELETE" }],
    [`/api/referrals/${foreignReferral.id}`, { method: "PATCH", body: JSON.stringify({ status: "converted" }) }],
    [`/api/invoices/${foreignInvoice.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) }],
    [`/api/invoices/${foreignInvoice.id}/send`, { method: "POST" }],
  ];

  for (const [path, init] of attempts) {
    const result = await request(path, {
      ...init,
      headers: { "x-test-coach-id": coachId, ...init?.headers },
    });
    assert.equal(result.response.status, 404, `${init?.method || "GET"} ${path}`);
  }

  assert.equal(foreignClient.name, "Private Client");
  assert.equal(foreignSession.status, "scheduled");
  assert.equal(foreignPackage.name, "Private Package");
  assert.equal(foreignNote.content, "Private note");
  assert.equal(foreignForm.title, "Private form");
  assert.equal(foreignReferral.status, "pending");
  assert.equal(foreignInvoice.status, undefined);

  const ownerRead = await request(`/api/clients/${foreignClient.id}`, {
    headers: { "x-test-coach-id": otherCoachId },
  });
  assert.equal(ownerRead.response.status, 200);
  assert.equal(ownerRead.body.name, "Private Client");
});

test("does not allow update bodies to transfer records to another coach", async () => {
  const targetCoachId = "ownership-target-coach";
  const ownedPackage = { id: "owned-package", userId: coachId, clientId: state.clients[0].id, name: "Owned package" };
  const ownedNote = { id: "owned-note", userId: coachId, clientId: state.clients[0].id, content: "Owned note" };
  const ownedReferral = { id: "owned-referral", userId: coachId, status: "pending" };
  state.packages.push(ownedPackage);
  state.notes.push(ownedNote);
  state.referrals.push(ownedReferral);

  const ownedRecords = [
    { path: `/api/clients/${state.clients[0].id}`, record: state.clients[0], update: { name: "Updated client" } },
    { path: `/api/sessions/${state.sessions[0].id}`, record: state.sessions[0], update: { title: "Updated session" } },
    { path: `/api/packages/${ownedPackage.id}`, record: ownedPackage, update: { name: "Updated package" } },
    { path: `/api/notes/${ownedNote.id}`, record: ownedNote, update: { content: "Updated note" } },
    { path: `/api/forms/${state.forms[0].id}`, record: state.forms[0], update: { title: "Updated form" } },
    { path: `/api/referrals/${ownedReferral.id}`, record: ownedReferral, update: { status: "converted" } },
    { path: `/api/invoices/${state.invoices[0].id}`, record: state.invoices[0], update: { notes: "Updated invoice" } },
  ];

  for (const { path, record, update } of ownedRecords) {
    const result = await request(path, {
      method: "PATCH",
      body: JSON.stringify({ ...update, userId: targetCoachId }),
    });
    assert.equal(result.response.status, 200, `PATCH ${path}`);
    assert.equal(record.userId, coachId, `ownership changed for ${path}`);
  }
});