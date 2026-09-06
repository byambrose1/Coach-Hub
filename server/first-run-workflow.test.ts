import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import express, { type RequestHandler } from "express";
import { registerRoutes } from "./routes";
import type { IStorage } from "./storage";
import {
  parseOnboardingProgress,
  serializeOnboardingProgress,
  toggleOnboardingStep,
} from "../client/src/lib/onboarding-progress";

const coachId = "test-coach";
let baseUrl = "";
let server: ReturnType<typeof createServer>;

const state = {
  settings: undefined as any,
  clients: [] as any[],
  sessions: [] as any[],
  forms: [] as any[],
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
  async getClient(id: string) {
    return state.clients.find((item) => item.id === id);
  },
  async createClient(userId: string, data: any) {
    return withId(state.clients, userId, data);
  },
  async getSessions(userId: string) {
    return state.sessions.filter((item) => item.userId === userId);
  },
  async createSession(userId: string, data: any) {
    return withId(state.sessions, userId, data);
  },
  async getPackages() {
    return [];
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
  async getInvoices(userId: string) {
    return state.invoices.filter((item) => item.userId === userId);
  },
  async createInvoice(userId: string, data: any) {
    return withId(state.invoices, userId, data);
  },
  async getPlatformConfig() {
    return { tier1MaxClients: 5 };
  },
} as unknown as IStorage;

const authenticate: RequestHandler = (req, _res, next) => {
  req.user = {
    claims: { sub: coachId },
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
  server = createServer(app);
  await registerRoutes(server, app, {
    storage,
    isAuthenticated: authenticate,
    sendBookingNotificationEmail: async () => {},
    createMandateLink: async () => {
      throw new Error(
        "GoCardless is not configured. Please add the GOCARDLESS_API_KEY secret in Settings.",
      );
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
});

test("fails an unconfigured GoCardless attempt clearly and safely", async () => {
  const client = state.clients[0];
  const result = await request("/api/payments/create-mandate-link", {
    method: "POST",
    body: JSON.stringify({ clientId: client.id }),
  });
  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, {
    message:
      "GoCardless is not configured. Please add the GOCARDLESS_API_KEY secret in Settings.",
  });
});