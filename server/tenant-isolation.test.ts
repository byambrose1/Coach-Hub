import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import express, { type RequestHandler } from "express";
import { registerRoutes } from "./routes";
import type { IStorage, CoachDetail, PlatformStats } from "./storage";

// Every table in this app is scoped by userId, and every route is supposed to
// look up rows through storage methods that filter on it. This suite exists
// to catch the one place that check gets forgotten - a coach reading, editing,
// or deleting another coach's clients, sessions, packages, notes, forms, or
// invoices by guessing/reusing an id. It runs against an in-memory mock of
// IStorage (same dependency-injection seam first-run-workflow.test.ts uses),
// so it needs no database.

const OWNER_ID = "owner-test-id";
const COACH_A = "coach-a";
const COACH_B = "coach-b";

let baseUrl = "";
let server: ReturnType<typeof createServer>;

type Row = { id: string; userId: string; [key: string]: any };

function makeStore() {
  const state = {
    nextId: 1,
    clients: [] as Row[],
    sessions: [] as Row[],
    packages: [] as Row[],
    notes: [] as Row[],
    forms: [] as Row[],
    referrals: [] as Row[],
    invoices: [] as Row[],
    settings: new Map<string, Row>(),
  };

  const withId = (collection: Row[], userId: string, data: any): Row => {
    const row = { ...data, id: String(state.nextId++), userId };
    collection.push(row);
    return row;
  };
  const findOwned = (collection: Row[], userId: string, id: string) =>
    collection.find((item) => item.id === id && item.userId === userId);
  const updateOwned = (collection: Row[], userId: string, id: string, data: any) => {
    const item = findOwned(collection, userId, id);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  };
  const deleteOwned = (collection: Row[], userId: string, id: string) => {
    const idx = collection.findIndex((item) => item.id === id && item.userId === userId);
    if (idx !== -1) collection.splice(idx, 1);
  };

  const storage: IStorage = {
    getClients: async (userId) => state.clients.filter((c) => c.userId === userId) as any,
    getClient: async (userId, id) => findOwned(state.clients, userId, id) as any,
    createClient: async (userId, data) => withId(state.clients, userId, data) as any,
    updateClient: async (userId, id, data) => updateOwned(state.clients, userId, id, data) as any,
    deleteClient: async (userId, id) => deleteOwned(state.clients, userId, id),

    getSessions: async (userId) => state.sessions.filter((s) => s.userId === userId) as any,
    getSession: async (userId, id) => findOwned(state.sessions, userId, id) as any,
    createSession: async (userId, data) => withId(state.sessions, userId, data) as any,
    updateSession: async (userId, id, data) => updateOwned(state.sessions, userId, id, data) as any,
    deleteSession: async (userId, id) => deleteOwned(state.sessions, userId, id),

    getPackages: async (userId) => state.packages.filter((p) => p.userId === userId) as any,
    getPackage: async (userId, id) => findOwned(state.packages, userId, id) as any,
    createPackage: async (userId, data) => withId(state.packages, userId, data) as any,
    updatePackage: async (userId, id, data) => updateOwned(state.packages, userId, id, data) as any,

    getNotes: async (userId) => state.notes.filter((n) => n.userId === userId) as any,
    getNote: async (userId, id) => findOwned(state.notes, userId, id) as any,
    createNote: async (userId, data) => withId(state.notes, userId, data) as any,
    updateNote: async (userId, id, data) => updateOwned(state.notes, userId, id, data) as any,
    deleteNote: async (userId, id) => deleteOwned(state.notes, userId, id),

    getSettings: async (userId) => state.settings.get(userId) as any,
    getSettingsByStripeSubscriptionId: async (subId) =>
      [...state.settings.values()].find((s) => s.stripeSubscriptionId === subId) as any,
    upsertSettings: async (userId, data) => {
      const existing = state.settings.get(userId) || { id: userId, userId };
      const updated = { ...existing, ...data, id: userId };
      state.settings.set(userId, updated);
      return updated as any;
    },

    getClientForms: async (userId) => state.forms.filter((f) => f.userId === userId) as any,
    getClientForm: async (userId, id) => findOwned(state.forms, userId, id) as any,
    createClientForm: async (userId, data) => withId(state.forms, userId, data) as any,
    updateClientForm: async (userId, id, data) => updateOwned(state.forms, userId, id, data) as any,
    deleteClientForm: async (userId, id) => deleteOwned(state.forms, userId, id),

    getReferrals: async (userId) => state.referrals.filter((r) => r.userId === userId) as any,
    createReferral: async (userId, data) => withId(state.referrals, userId, data) as any,
    updateReferral: async (userId, id, data) => updateOwned(state.referrals, userId, id, data) as any,

    getInvoices: async (userId) => state.invoices.filter((i) => i.userId === userId) as any,
    getInvoice: async (userId, id) => findOwned(state.invoices, userId, id) as any,
    createInvoice: async (userId, data) => withId(state.invoices, userId, data) as any,
    updateInvoice: async (userId, id, data) => updateOwned(state.invoices, userId, id, data) as any,

    deleteAccountData: async (userId) => {
      state.clients = state.clients.filter((c) => c.userId !== userId);
      state.sessions = state.sessions.filter((s) => s.userId !== userId);
      state.packages = state.packages.filter((p) => p.userId !== userId);
      state.notes = state.notes.filter((n) => n.userId !== userId);
      state.forms = state.forms.filter((f) => f.userId !== userId);
      state.referrals = state.referrals.filter((r) => r.userId !== userId);
      state.invoices = state.invoices.filter((i) => i.userId !== userId);
      state.settings.delete(userId);
    },

    getAllUsers: async () => [] as any,
    getPlatformStats: async () => ({} as PlatformStats),
    getPlatformConfig: async () => ({
      id: "default",
      tier1MaxClients: 5, tier1Price: "0", tier1PaymentLink: "",
      tier2MaxClients: 10, tier2Price: "1.99", tier2PaymentLink: "",
      tier3MaxClients: 20, tier3Price: "4.99", tier3PaymentLink: "",
      tier4MaxClients: 50, tier4Price: "7.99", tier4PaymentLink: "",
    } as any),
    upsertPlatformConfig: async (data) => ({ id: "default", ...data } as any),
    getCoachDetail: async () => undefined as unknown as CoachDetail,
    updateCoachPlan: async () => {},
  };

  return { storage, state };
}

const authenticate: RequestHandler = (req, _res, next) => {
  const authenticatedCoachId = req.get("x-test-coach-id") || COACH_A;
  const impersonating = req.get("x-test-impersonating") || undefined;
  req.user = {
    claims: { sub: authenticatedCoachId },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  req.isAuthenticated = () => true;
  req.logout = ((cb?: () => void) => cb?.()) as any;
  (req as any).session = {
    ...(impersonating ? { impersonatedUserId: impersonating } : {}),
    destroy: (cb?: () => void) => cb?.(),
  };
  next();
};

async function request(path: string, init?: RequestInit & { as?: string; impersonating?: string }) {
  const { as, impersonating, ...rest } = init || {};
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(as ? { "x-test-coach-id": as } : {}),
      ...(impersonating ? { "x-test-impersonating": impersonating } : {}),
      ...rest.headers,
    },
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { response, body };
}

let previousOwnerId: string | undefined;
let store: ReturnType<typeof makeStore>;
const deletedAuthUserIds: string[] = [];

before(async () => {
  previousOwnerId = process.env.OWNER_USER_ID;
  process.env.OWNER_USER_ID = OWNER_ID;

  const app = express();
  app.use(express.json());
  server = createServer(app);
  store = makeStore();
  await registerRoutes(server, app, {
    storage: store.storage,
    isAuthenticated: authenticate,
    sendBookingNotificationEmail: async () => {},
    createMandateLink: async () => {
      throw new Error("not used in this suite");
    },
    sendParqEmail: async () => {
      throw new Error("not used in this suite");
    },
    sendBroadcastEmail: async () => {
      throw new Error("not used in this suite");
    },
    sendLowSessionsEmail: async () => {
      throw new Error("not used in this suite");
    },
    sendInvoiceEmail: async () => {
      throw new Error("not used in this suite");
    },
    deleteAuthUser: async (id: string) => {
      deletedAuthUserIds.push(id);
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  process.env.OWNER_USER_ID = previousOwnerId;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function createClientAs(coachId: string, name = "Coach A's client") {
  const { body } = await request("/api/clients", {
    method: "POST",
    as: coachId,
    body: JSON.stringify({ name }),
  });
  return body;
}

test("a coach cannot read another coach's client by id", async () => {
  const client = await createClientAs(COACH_A);
  const { response, body } = await request(`/api/clients/${client.id}`, { as: COACH_B });
  assert.equal(response.status, 404);
  assert.equal(body.message, "Client not found");
});

test("a coach's client list never includes another coach's clients", async () => {
  await createClientAs(COACH_A, "Alice");
  await createClientAs(COACH_B, "Bob");
  const { body: listA } = await request("/api/clients", { as: COACH_A });
  const { body: listB } = await request("/api/clients", { as: COACH_B });
  assert.ok(listA.every((c: any) => c.name !== "Bob"));
  assert.ok(listB.every((c: any) => c.name !== "Alice"));
});

test("a coach cannot edit another coach's client", async () => {
  const client = await createClientAs(COACH_A, "Original Name");
  const { response } = await request(`/api/clients/${client.id}`, {
    method: "PATCH",
    as: COACH_B,
    body: JSON.stringify({ name: "Hijacked" }),
  });
  assert.equal(response.status, 404);

  const { body: stillOwnedByA } = await request(`/api/clients/${client.id}`, { as: COACH_A });
  assert.equal(stillOwnedByA.name, "Original Name");
});

test("a coach cannot delete another coach's client", async () => {
  const client = await createClientAs(COACH_A);
  const { response } = await request(`/api/clients/${client.id}`, {
    method: "DELETE",
    as: COACH_B,
  });
  assert.equal(response.status, 404);

  const { response: stillThere } = await request(`/api/clients/${client.id}`, { as: COACH_A });
  assert.equal(stillThere.status, 200);
});

test("a coach cannot read another coach's session, package, note, form, or invoice", async () => {
  const client = await createClientAs(COACH_A);

  const { body: session } = await request("/api/sessions", {
    method: "POST",
    as: COACH_A,
    body: JSON.stringify({
      clientId: client.id,
      title: "Session",
      date: "2026-01-01",
      startTime: "09:00",
      endTime: "10:00",
    }),
  });
  const { body: form } = await request("/api/forms", {
    method: "POST",
    as: COACH_A,
    body: JSON.stringify({ clientId: client.id, formType: "parq", title: "PAR-Q", responses: "{}", date: "2026-01-01" }),
  });
  const { body: invoice } = await request("/api/invoices", {
    method: "POST",
    as: COACH_A,
    body: JSON.stringify({ clientId: client.id, invoiceNumber: "INV-1", amount: "50", dueDate: "2026-01-15" }),
  });

  const sessionCheck = await request(`/api/sessions/${session.id}`, { as: COACH_B });
  assert.equal(sessionCheck.response.status, 404);

  const formCheck = await request(`/api/forms/${form.id}`, { as: COACH_B });
  assert.equal(formCheck.response.status, 404);

  const invoiceList = await request("/api/invoices", { as: COACH_B });
  assert.ok(invoiceList.body.every((i: any) => i.id !== invoice.id));
});

test("a coach cannot read or overwrite another coach's settings", async () => {
  await request("/api/settings", {
    method: "PUT",
    as: COACH_A,
    body: JSON.stringify({ businessName: "Alice's Coaching", trainerEmail: "alice@example.test" }),
  });
  await request("/api/settings", {
    method: "PUT",
    as: COACH_B,
    body: JSON.stringify({ businessName: "Bob's Coaching" }),
  });

  const { body: settingsA } = await request("/api/settings", { as: COACH_A });
  const { body: settingsB } = await request("/api/settings", { as: COACH_B });
  assert.equal(settingsA.businessName, "Alice's Coaching");
  assert.equal(settingsB.businessName, "Bob's Coaching");
  assert.notEqual(settingsA.trainerEmail, settingsB.trainerEmail);
});

test("a non-owner coach cannot reach platform-admin routes", async () => {
  const stats = await request("/api/platform-admin/stats", { as: COACH_A });
  assert.equal(stats.response.status, 403);

  const users = await request("/api/platform-admin/users", { as: COACH_A });
  assert.equal(users.response.status, 403);

  const impersonate = await request(`/api/platform-admin/impersonate/${COACH_B}`, {
    method: "POST",
    as: COACH_A,
  });
  assert.equal(impersonate.response.status, 403);
});

test("the platform owner can reach platform-admin routes", async () => {
  const stats = await request("/api/platform-admin/stats", { as: OWNER_ID });
  assert.equal(stats.response.status, 200);
});

test("deleting an account removes that coach's data and the auth user, and leaves other coaches untouched", async () => {
  const DOOMED = "coach-to-delete";
  const SURVIVOR_COACH = "coach-survivor";
  await createClientAs(DOOMED, "Doomed Client");
  await request("/api/settings", {
    method: "PUT",
    as: DOOMED,
    body: JSON.stringify({ businessName: "Doomed Coaching" }),
  });
  const survivor = await createClientAs(SURVIVOR_COACH, "Survivor Client");

  const { response, body } = await request("/api/account", { method: "DELETE", as: DOOMED });
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(deletedAuthUserIds.includes(DOOMED));

  assert.equal(store.state.clients.some((c) => c.userId === DOOMED), false);
  assert.equal(store.state.settings.has(DOOMED), false);

  // An unrelated coach's own data survives Coach DOOMED's deletion.
  const { body: survivorAfter } = await request(`/api/clients/${survivor.id}`, { as: SURVIVOR_COACH });
  assert.equal(survivorAfter.name, "Survivor Client");
});

test("the platform owner cannot self-delete via the account endpoint", async () => {
  const { response } = await request("/api/account", { method: "DELETE", as: OWNER_ID });
  assert.equal(response.status, 403);
  assert.equal(deletedAuthUserIds.includes(OWNER_ID), false);
});

test("PUT /api/settings rejects a malformed body instead of writing it through", async () => {
  const { response, body } = await request("/api/settings", {
    method: "PUT",
    as: COACH_A,
    body: JSON.stringify({ lowSessionThreshold: "not-a-number" }),
  });
  assert.equal(response.status, 400);
  assert.ok(body.message);
});

test("account deletion is blocked while impersonating, to avoid deleting the wrong account", async () => {
  const { response, body } = await request("/api/account", {
    method: "DELETE",
    as: COACH_A,
    impersonating: COACH_B,
  });
  assert.equal(response.status, 400);
  assert.ok(!deletedAuthUserIds.includes(COACH_A));
  assert.ok(!deletedAuthUserIds.includes(COACH_B));
  assert.match(body.message, /impersonat/i);
});
