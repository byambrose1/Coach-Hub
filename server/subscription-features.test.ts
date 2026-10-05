import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import express from "express";
import { registerRoutes } from "./routes";
import { featureMinimumPlan, getPlan, hasFeature, type PlanName } from "@shared/subscription-features";
import { createInvoicePdf } from "../client/src/lib/invoice-pdf";
import { revenueReport } from "./revenue-report";
import type { Settings } from "@shared/schema";

let plan: PlanName = "free", unavailable = false, writes = 0, sends = 0;
let profile: any = {};
let base = "";
const server = createServer();
const invoice: any = {
  id: "invoice", userId: "coach", clientId: "client", invoiceNumber: "INV-1",
  amount: "12.34", dueDate: "2026-10-10", status: "paid", paidDate: "2026-10-03",
  packageId: "package",
};
const client: any = { id: "client", userId: "coach", name: "Fixture", email: "fixture@example.test" };
const packages: any[] = [{
  id: "package", userId: "coach", clientId: "client", billingType: "monthly",
  monthlyRate: "19.99", totalSessions: 10, usedSessions: 1, status: "active",
}];
const storage: any = {
  getSettings: async () => {
    if (unavailable) throw new Error("Unavailable fixture");
    return { id: "coach", subscriptionPlan: plan, ...profile };
  },
  upsertSettings: async (_id: string, data: any) => { writes++; Object.assign(profile, data); return profile; },
  getInvoices: async () => [invoice],
  getInvoice: async (_id: string, id: string) => id === invoice.id ? invoice : undefined,
  createInvoice: async (_id: string, data: any) => { writes++; return { ...data, id: "new" }; },
  updateInvoice: async (_id: string, _invoiceId: string, data: any) => { writes++; return { ...invoice, ...data }; },
  getClients: async () => [client],
  getClient: async (_id: string, id: string) => id === client.id ? client : undefined,
  getPackages: async () => packages,
  getPackage: async () => packages[0],
  createPackage: async (_id: string, data: any) => { writes++; return data; },
  updatePackage: async (_id: string, _pkgId: string, data: any) => { writes++; return data; },
  getPlatformConfig: async () => ({}),
};

before(async () => {
  const app = express();
  app.use(express.json());
  const authenticate: any = (req: any, _res: any, next: any) => {
    req.user = { claims: { sub: "coach" } };
    req.isAuthenticated = () => true;
    req.session = {};
    next();
  };
  // Registration includes no live storage/payment/email operations.
  await registerRoutes(server, app, {
    storage, isAuthenticated: authenticate,
    sendInvoiceEmail: async () => { sends++; },
    sendBroadcastEmail: async () => { sends++; return {} as any; },
    sendLowSessionsEmail: async () => { sends++; },
    notificationBudget: { used: async () => 0, reserve: async () => true, releaseRejected: async () => {} },
  });
  server.on("request", app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function request(path: string, method = "GET", body?: any) {
  const response = await fetch(base + path, {
    method, headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("one feature matrix gives successive plans real permissions and unknown plans fail closed", () => {
  const order: PlanName[] = ["free", "starter", "professional", "business"];
  for (const feature of Object.keys(featureMinimumPlan) as Array<keyof typeof featureMinimumPlan>) {
    for (const current of order) {
      assert.equal(hasFeature({ subscriptionPlan: current }, feature),
        order.indexOf(current) >= order.indexOf(featureMinimumPlan[feature]), `${current}: ${feature}`);
    }
    assert.equal(hasFeature({ subscriptionPlan: "admin" }, feature), featureMinimumPlan[feature] === "free");
  }
  assert.equal(getPlan({ subscriptionPlan: "toString" }), "free");
});

test("Free retains basic invoices but direct paid-feature requests cannot write or send", async () => {
  plan = "free"; profile = {};
  const beforeWrites = writes, beforeSends = sends;
  for (const [path, method, body] of [
    ["/api/revenue", "GET", undefined],
    ["/api/emails/broadcast", "POST", { subject: "Fixture", message: "Fixture" }],
    ["/api/invoices/invoice", "PATCH", { status: "paid", paidDate: "2026-10-03" }],
    ["/api/invoices/invoice/send", "POST", {}],
    ["/api/packages", "POST", { billingType: "monthly", monthlyRate: "5" }],
    ["/api/settings", "PUT", { businessName: "New custom business" }],
    ["/api/invoices", "POST", { status: "paid", paymentMethod: "cash" }],
  ] as const) {
    const result = await request(path, method, body);
    assert.equal(result.status, 403, path);
    assert.equal(result.body.code, "PLAN_UPGRADE_REQUIRED", path);
  }
  assert.equal(writes, beforeWrites);
  assert.equal(sends, beforeSends);
  assert.equal((await request("/api/invoices")).status, 200);
  assert.equal((await request("/api/invoices", "POST", {
    clientId: "client", invoiceNumber: "INV-2", amount: "12.34", dueDate: "2026-10-10", status: "pending",
  })).status, 201);
});

test("Starter can record payments and view basic reports, not edit/send/broadcast or filter reports", async () => {
  plan = "starter";
  assert.equal((await request("/api/invoices/invoice", "PATCH", { status: "paid", paidDate: "2026-10-03" })).status, 200);
  assert.equal((await request("/api/settings", "PUT", { enableEmailNotifications: true })).status, 200);
  assert.equal((await request("/api/invoices/invoice", "PATCH", { amount: "25" })).status, 403);
  assert.equal((await request("/api/invoices/invoice/send", "POST", {})).status, 403);
  assert.equal((await request("/api/emails/broadcast", "POST", { subject: "Fixture", message: "Fixture" })).status, 403);
  assert.equal((await request("/api/revenue?from=2026-10-01&to=2026-10-31")).status, 403);
  const report = await request("/api/revenue?period=month");
  assert.equal(report.status, 200);
  assert.equal(Object.hasOwn(report.body, "byClient"), false);
});

test("Professional gets editing/sending/broadcast but Business filters and custom details stay locked", async () => {
  plan = "professional"; profile = {};
  assert.equal((await request("/api/invoices/invoice", "PATCH", { amount: "25" })).status, 200);
  assert.equal((await request("/api/invoices/invoice/send", "POST", {})).status, 200);
  assert.equal((await request("/api/emails/broadcast", "POST", { subject: "Fixture", message: "Fixture" })).status, 200);
  assert.equal((await request("/api/settings", "PUT", { businessAddress: "Fixture office" })).status, 403);
  assert.equal((await request("/api/revenue?clientId=client")).status, 403);
});

test("Business reports use real paid dates, cents, client filters and validate inputs", async () => {
  plan = "business"; profile = {};
  assert.equal((await request("/api/settings", "PUT", { businessName: "Fixture business" })).status, 200);
  const report = await request("/api/revenue?from=2026-10-01&to=2026-10-31&clientId=client");
  assert.equal(report.status, 200);
  assert.equal(report.body.totalRevenue, 12.34);
  assert.equal(report.body.monthlyRevenue, 12.34);
  assert.equal(report.body.monthlyBilling, 19.99);
  assert.deepEqual(report.body.byClient, [{ clientId: "client", clientName: "Fixture", invoiceCount: 1, paidTotal: 12.34 }]);
  assert.equal((await request("/api/revenue?from=2026-02-30&to=2026-10-31")).status, 400);
  assert.equal((await request("/api/revenue?from=2026-10-31&to=2026-10-01")).status, 400);
  assert.equal((await request("/api/revenue?clientId=another-coachs-client")).status, 404);
});

test("downgrades retain business details and records without reactivating paid functions", async () => {
  plan = "free"; profile = { businessName: "Kept name", businessAddress: "Kept address", enableEmailNotifications: true };
  const update = await request("/api/settings", "PUT", { trainerName: "Updated coach", businessName: "Kept name" });
  assert.equal(update.status, 200);
  assert.equal(profile.businessName, "Kept name");
  assert.equal(profile.businessAddress, "Kept address");
  assert.equal((await request("/api/invoices")).body[0].id, "invoice");
  assert.equal((await request("/api/invoices/invoice/send", "POST", {})).status, 403);
});

test("unavailable plan lookup cannot grant a paid action or reporting", async () => {
  unavailable = true;
  const beforeWrites = writes;
  assert.equal((await request("/api/invoices/invoice", "PATCH", { amount: "25" })).status, 503);
  assert.equal((await request("/api/revenue")).status, 503);
  assert.equal(writes, beforeWrites);
  unavailable = false;
});

test("Free PDF includes Practably vector branding and the coach remains the issuer", () => {
  const freeSettings = { subscriptionPlan: "free", trainerName: "Fixture coach" } as Settings;
  const pdf = createInvoicePdf(invoice, "Fixture client", freeSettings).output();
  assert.ok(pdf.includes("(Practably)"));
  assert.ok(pdf.includes("(Fixture coach)"));
  assert.ok(pdf.includes(" c\n"), "Logo contains the brand's vector curves");
  const paidPdf = createInvoicePdf(invoice, "Fixture client",
    { subscriptionPlan: "business", businessName: "Fixture business" } as Settings).output();
  assert.equal(paidPdf.includes("(Practably)"), false);
  assert.ok(paidPdf.includes("(Fixture business)"));
});

test("revenue does not silently treat undated paid invoices as payments in the selected period", () => {
  const result = revenueReport([{ ...invoice, paidDate: null }], packages, [client],
    "2026-10-01", "2026-10-31", true);
  assert.equal(result.totalRevenue, 0);
  assert.equal(result.unallocatedPaidCount, 1);
  assert.throws(() => revenueReport([{ ...invoice, amount: "invalid" }], packages, [client],
    "2026-10-01", "2026-10-31", true));
});