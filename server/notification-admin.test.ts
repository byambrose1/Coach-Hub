import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "./routes";
import { createEmailNotifications, notificationWeek } from "./email-notifications";
import type { Settings } from "@shared/schema";
import type { StaffGrant } from "./platform-staff";

const originalOwner = process.env.OWNER_USER_ID;
const originalSupport = process.env.SUPPORT_USER_IDS;
const counts = new Map<string, number>();
let providerFailure = false, unavailableBudget = false, emailCalls = 0, plan = "free", enabled = true;
const budget = {
  async used(id: string, week: string) { return counts.get(id + week) || 0; },
  async reserve(id: string, week: string) {
    if (unavailableBudget) throw new Error("Unavailable fixture");
    const key = id + week, used = counts.get(key) || 0;
    if (used >= 10) return false;
    counts.set(key, used + 1);
    return true;
  },
  async releaseRejected(id: string, week: string) { const key = id + week; counts.set(key, Math.max(0, (counts.get(key) || 0) - 1)); },
};
const grants = new Map<string, StaffGrant>();
const sessions = new Map<string, any>();
const records = new Map<string, any>();
const pkg: any = { id: "package", clientId: "client", name: "Block", status: "active", billingType: "block", totalSessions: 6, usedSessions: 2 };
const invoice: any = { id: "invoice", clientId: "client", invoiceNumber: "INV-test", amount: "25", dueDate: "2020-01-01", status: "overdue" };
const accounts = [
  { id: "owner", email: "owner@example.test", firstName: "Owner", businessName: "Owner Practice" },
  { id: "coach", email: "coach@example.test", firstName: "Coach", businessName: "Coaching Practice" },
  { id: "support", email: "support@example.test", firstName: "Support", businessName: "Support Practice" },
];
let writes = 0, base = "";
const server = createServer();
const settings = () => ({ subscriptionPlan: plan, enableEmailNotifications: enabled, timezone: "Europe/London" }) as Settings;
const authenticate: any = (req: any, res: any, next: any) => {
  const id = req.headers["x-test-user"];
  if (!id) return res.status(401).json({ message: "Sign in required" });
  req.user = { claims: { sub: id } };
  req.isAuthenticated = () => true;
  if (!sessions.has(id)) sessions.set(id, {});
  req.session = sessions.get(id);
  next();
};
const deliver = async () => { emailCalls++; if (providerFailure) throw new Error("PRIVATE-PROVIDER-FIXTURE"); };

before(async () => {
  process.env.OWNER_USER_ID = "owner";
  process.env.SUPPORT_USER_IDS = "support";
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  await registerRoutes(server, app, {
    isAuthenticated: authenticate,
    notificationBudget: budget,
    platformStaff: {
      get: async id => grants.get(id), list: async () => [...grants.values()],
      setAccess: async (id, active, owner) => { grants.set(id, { userId: id, active, grantedBy: owner, updatedAt: new Date() }); },
    },
    storage: {
      getSettings: async () => settings(),
      getAllUsers: async () => accounts,
      getPlatformStats: async () => ({ totalUsers: accounts.length }),
      getPlatformConfig: async () => ({}),
      getCoachDetail: async (id: string) => accounts.some(a => a.id === id) ? { coach: accounts.find(a => a.id === id) } : undefined,
      updateCoachPlan: async () => { writes++; },
      getClients: async () => [],
      getClient: async (_id: string, id: string) => id === "client" ? { id, name: "Client fixture", email: "client@example.test" } : undefined,
      getSessions: async () => [...records.values()],
      getSession: async (_id: string, id: string) => records.get(id),
      createSession: async (userId: string, data: any) => { const record = { ...data, userId, id: `session-${records.size}` }; records.set(record.id, record); return record; },
      updateSession: async (_id: string, id: string, data: any) => { const record = { ...records.get(id), ...data }; records.set(id, record); return record; },
      getPackages: async () => [pkg],
      getPackage: async (_id: string, id: string) => id === pkg.id ? pkg : undefined,
      updatePackage: async (_id: string, _packageId: string, data: any) => Object.assign(pkg, data),
      getInvoice: async (_id: string, id: string) => id === "invoice" ? invoice : undefined,
      updateInvoice: async () => { throw new Error("Reminder must not alter invoice"); },
    } as any,
    sendBookingNotificationEmail: deliver, sendSessionCancellationEmail: deliver, sendSessionRescheduleEmail: deliver,
    sendParqEmail: deliver, sendLowSessionsEmail: deliver, sendInvoiceReminderEmail: deliver,
  });
  server.on("request", app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (originalOwner === undefined) delete process.env.OWNER_USER_ID; else process.env.OWNER_USER_ID = originalOwner;
  if (originalSupport === undefined) delete process.env.SUPPORT_USER_IDS; else process.env.SUPPORT_USER_IDS = originalSupport;
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
async function request(path: string, id = "coach", method = "GET", data?: any) {
  const response = await fetch(base + path, { method, headers: { ...(id ? { "x-test-user": id } : {}), "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data) });
  return { status: response.status, body: await response.json() };
}
test("calendar allowance resets Mondays UTC across year boundaries", () => {
  assert.equal(notificationWeek(new Date("2026-10-04T23:59:59Z")).weekStart, "2026-09-28");
  assert.equal(notificationWeek(new Date("2026-10-05T00:00:00Z")).weekStart, "2026-10-05");
  assert.equal(notificationWeek(new Date("2027-01-01T18:00:00Z")).weekStart, "2026-12-28");
  assert.equal(notificationWeek(new Date("2027-01-01T18:00:00Z")).resetsAt, "2027-01-04T00:00:00.000Z");
});
test("Free permits ten concurrent sends, isolates coaches and weeks, and paid plans do not reserve", async () => {
  counts.clear();
  let accepted = 0;
  const service = createEmailNotifications(budget, () => new Date("2026-10-05T10:00:00Z"));
  const input = { userId: "quota", settings: settings(), clientEmail: "fixture@example.test", kind: "booking", deliver: async () => { accepted++; } };
  const results = await Promise.all(Array.from({ length: 30 }, () => service.send(input)));
  assert.equal(accepted, 10);
  assert.equal(results.filter(r => r.status === "limit_reached").length, 20);
  assert.equal((await service.usage("quota", settings())).remaining, 0);
  assert.equal((await service.send({ ...input, userId: "other" })).status, "sent");
  const following = createEmailNotifications(budget, () => new Date("2026-10-12T00:00:00Z"));
  assert.equal((await following.send(input)).status, "sent");
  assert.equal((await service.send({ ...input, settings: { ...settings(), subscriptionPlan: "starter" } })).status, "sent");
  assert.equal((await service.usage("quota", { ...settings(), subscriptionPlan: "business" })).limit, null);
});
test("disabled/missing-email sends reserve nothing; definite rejection is released but timeout is retained", async () => {
  counts.clear();
  const service = createEmailNotifications(budget, () => new Date("2026-10-05T10:00:00Z"));
  const input = { userId: "failure", settings: settings(), clientEmail: "fixture@example.test", kind: "booking", deliver: async () => {} };
  assert.equal((await service.send({ ...input, settings: { ...settings(), enableEmailNotifications: false } })).status, "disabled");
  assert.equal((await service.send({ ...input, clientEmail: null })).status, "missing_email");
  assert.equal((await service.usage("failure", settings())).used, 0);
  await service.send({ ...input, deliver: async () => { throw Object.assign(new Error("Rejected fixture"), { statusCode: 400 }); } });
  assert.equal((await service.usage("failure", settings())).used, 0);
  await service.send({ ...input, deliver: async () => { throw new Error("Timeout fixture"); } });
  assert.equal((await service.usage("failure", settings())).used, 1);
});
test("booking automatically emails at three remaining, cancellation/reschedule report outcomes, and a saved session survives email failure", async () => {
  counts.clear(); records.clear(); emailCalls = 0; pkg.usedSessions = 2; plan = "free"; enabled = true;
  const booked = await request("/api/sessions", "coach", "POST", { clientId: "client", title: "Fixture", date: "2030-01-01", startTime: "10:00", endTime: "11:00", status: "scheduled" });
  assert.equal(booked.status, 201);
  assert.deepEqual(booked.body.emailNotifications.map((n: any) => n.kind), ["booking", "low_sessions"]);
  assert.equal(pkg.totalSessions - pkg.usedSessions, 3);
  const id = booked.body.id;
  const moved = await request(`/api/sessions/${id}`, "coach", "PATCH", { date: "2030-01-02" });
  assert.equal(moved.body.emailNotifications[0].kind, "reschedule");
  providerFailure = true;
  const cancelled = await request(`/api/sessions/${id}`, "coach", "PATCH", { status: "cancelled" });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, "cancelled");
  assert.equal(cancelled.body.emailNotifications[0].status, "failed");
  assert.ok(!JSON.stringify(cancelled.body).includes("PRIVATE-PROVIDER-FIXTURE"));
  const again = await request(`/api/sessions/${id}`, "coach", "PATCH", { status: "cancelled" });
  assert.deepEqual(again.body.emailNotifications, []);
  providerFailure = false;
});
test("manual PAR-Q and low-session messages share Free quota; database failure cannot bypass it", async () => {
  counts.clear();
  for (let i = 0; i < 10; i++) {
    const path = i % 2 ? "/api/packages/package/notify-low-sessions" : "/api/parq/send-email";
    assert.equal((await request(path, "coach", "POST", { clientId: "client" })).status, 200);
  }
  assert.equal((await request("/api/parq/send-email", "coach", "POST", { clientId: "client" })).status, 429);
  const usage = await request("/api/notifications/usage");
  assert.equal(usage.body.used, 10);
  unavailableBudget = true;
  assert.equal((await request("/api/parq/send-email", "coach", "POST", { clientId: "client" })).status, 502);
  unavailableBudget = false;
});
test("overdue reminders require Professional, past-due unpaid owned invoice, and never change its status", async () => {
  plan = "starter";
  assert.equal((await request("/api/invoices/invoice/remind-overdue", "coach", "POST", {})).status, 403);
  plan = "professional"; enabled = false;
  assert.equal((await request("/api/invoices/invoice/remind-overdue", "coach", "POST", {})).status, 200);
  assert.equal(invoice.status, "overdue");
  invoice.status = "paid";
  assert.equal((await request("/api/invoices/invoice/remind-overdue", "coach", "POST", {})).status, 400);
  invoice.status = "pending"; invoice.dueDate = "2099-01-01";
  assert.equal((await request("/api/invoices/invoice/remind-overdue", "coach", "POST", {})).status, 400);
  invoice.dueDate = "2020-01-01";
  assert.equal((await request("/api/invoices/foreign/remind-overdue", "coach", "POST", {})).status, 404);
});
test("guessing admin URLs or posting a role cannot expose accounts or grant access", async () => {
  assert.equal((await request("/api/platform-admin/users", "")).status, 401);
  for (const path of ["/role", "/stats", "/users", "/config", "/coaches/owner", "/staff"]) {
    assert.equal((await request("/api/platform-admin" + path, "coach")).status, 403, path);
  }
  assert.equal((await request("/api/platform-admin/staff", "coach", "POST", { email: "coach@example.test", role: "owner" })).status, 403);
  assert.equal(grants.has("coach"), false);
  assert.equal((await request("/api/platform-admin/users", "owner")).body[1].businessName, "Coaching Practice");
});
test("only owner grants/revokes managers; owner protected; support cannot edit billing or delegate", async () => {
  assert.equal((await request("/api/platform-admin/staff", "owner", "POST", { email: "owner@example.test" })).status, 400);
  assert.equal((await request("/api/platform-admin/staff/owner", "owner", "DELETE")).status, 400);
  assert.equal((await request("/api/platform-admin/staff", "owner", "POST", { email: "unknown@example.test" })).status, 404);
  assert.equal((await request("/api/platform-admin/staff", "owner", "POST", { email: " COACH@EXAMPLE.TEST " })).status, 200);
  assert.equal((await request("/api/platform-admin/role", "coach")).body.role, "support");
  assert.equal((await request("/api/platform-admin/users", "coach")).status, 200);
  assert.equal((await request("/api/platform-admin/staff", "coach", "POST", { email: "support@example.test" })).status, 403);
  assert.equal((await request("/api/platform-admin/config", "coach", "PUT", {})).status, 403);
  assert.equal((await request("/api/platform-admin/coaches/owner/plan", "coach", "PATCH", { plan: "business" })).status, 403);
  assert.equal(writes, 0);
  assert.equal((await request("/api/platform-admin/staff/coach", "owner", "DELETE")).status, 200);
  assert.equal((await request("/api/platform-admin/users", "coach")).status, 403);
});
test("persistent revocation overrides legacy support access and ends an existing support view", async () => {
  assert.equal((await request("/api/platform-admin/impersonate/coach", "support", "POST", {})).status, 200);
  assert.equal(sessions.get("support").impersonatedUserId, "coach");
  assert.equal((await request("/api/platform-admin/staff/support", "owner", "DELETE")).status, 200);
  assert.equal((await request("/api/clients", "support")).status, 403);
  assert.equal(sessions.get("support").impersonatedUserId, undefined);
  assert.equal((await request("/api/platform-admin/role", "support")).status, 403);
});
