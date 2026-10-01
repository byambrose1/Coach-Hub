import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, test } from "node:test";
import express, { type RequestHandler } from "express";
import type Stripe from "stripe";
import { registerRoutes } from "./routes";
import type { IStorage } from "./storage";

const USER_A = "billing-coach-a";
const USER_B = "billing-coach-b";
const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_CONFIGURED",
  "STRIPE_PORTAL_CONFIGURATION_ID",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_PROFESSIONAL_PRICE_ID",
  "STRIPE_BUSINESS_PRICE_ID",
  "STRIPE_AUTOMATIC_TAX_ENABLED",
  "NODE_ENV",
] as const;

type SavedEnv = Partial<Record<(typeof ENV_KEYS)[number], string>>;

function makeSubscription(overrides: Record<string, any> = {}) {
  return {
    id: "sub_a",
    object: "subscription",
    customer: "cus_a",
    status: "active",
    metadata: { userId: USER_A, plan: "business" },
    latest_invoice: { id: "in_a", status: "paid", paid: true },
    pending_update: null,
    items: {
      data: [
        {
          id: "si_a",
          quantity: 1,
          price: { id: "price_starter" },
        },
      ],
    },
    ...overrides,
  };
}

describe("hardened Stripe subscription billing", () => {
  let savedEnv: SavedEnv;
  let baseUrl = "";
  let server: ReturnType<typeof createServer>;
  let state: ReturnType<typeof makeFixture>["state"];
  let stripe: ReturnType<typeof makeFixture>["stripe"];

  function makeFixture() {
    const state = {
      settings: new Map<string, any>(),
      customers: new Map<string, any>(),
      prices: new Map<string, any>(),
      subscriptions: new Map<string, any>(),
      checkoutSessions: new Map<string, any>(),
      checkoutCreateCalls: [] as any[],
      portalCreateCalls: [] as any[],
      event: null as any,
      nextCustomer: 1,
    };
    const locks = new Map<string, Promise<void>>();
    for (const [id, amount] of [
      ["price_starter", 199],
      ["price_professional", 499],
      ["price_business", 799],
    ] as const) {
      state.prices.set(id, {
        id,
        object: "price",
        active: true,
        currency: "gbp",
        unit_amount: amount,
        recurring: { interval: "month", interval_count: 1 },
        livemode: false,
      });
    }
    state.settings.set(USER_A, {
      id: USER_A,
      userId: USER_A,
      stripeCustomerId: "cus_a",
      subscriptionPlan: "free",
      subscriptionStatus: "trial",
    });
    state.customers.set("cus_a", { id: "cus_a", object: "customer", metadata: { userId: USER_A } });

    const storage = {
      getSettings: async (userId: string) => state.settings.get(userId),
      getSettingsByStripeSubscriptionId: async (subscriptionId: string) =>
        [...state.settings.values()].find((entry) => entry.stripeSubscriptionId === subscriptionId),
      getClients: async () => [],
      getPlatformConfig: async () => ({
        tier1MaxClients: 5,
        tier2MaxClients: 10,
        tier3MaxClients: 20,
        tier4MaxClients: 50,
        tier1Price: "0",
        tier2Price: "1.99",
        tier3Price: "4.99",
        tier4Price: "7.99",
      }),
      upsertSettings: async (userId: string, values: any) => {
        const updated = { ...(state.settings.get(userId) || { id: userId, userId }), ...values, id: userId };
        state.settings.set(userId, updated);
        return updated;
      },
    } as unknown as IStorage;

    const mockStripe = {
      prices: {
        retrieve: async (id: string) => {
          const price = state.prices.get(id);
          if (!price) throw new Error("price missing");
          return price;
        },
      },
      customers: {
        create: async (params: any) => {
          const customer = {
            id: `cus_new_${state.nextCustomer++}`,
            object: "customer",
            metadata: params.metadata,
          };
          state.customers.set(customer.id, customer);
          return customer;
        },
        retrieve: async (id: string) => {
          const customer = state.customers.get(id);
          if (!customer) throw new Error("customer missing");
          return customer;
        },
      },
      subscriptions: {
        list: async () => ({
          data: Array.from(state.subscriptions.values()),
        }),
        retrieve: async (id: string) => {
          const subscription = state.subscriptions.get(id);
          if (!subscription) throw new Error("subscription missing");
          return subscription;
        },
      },
      invoices: {
        retrieve: async (id: string) => {
          for (const subscription of state.subscriptions.values()) {
            if (subscription.latest_invoice?.id === id) return subscription.latest_invoice;
          }
          throw new Error("invoice missing");
        },
      },
      checkout: {
        sessions: {
          create: async (params: any, options: any) => {
            state.checkoutCreateCalls.push({ params, options });
            const session = {
              id: `cs_test_${state.checkoutCreateCalls.length}`,
              object: "checkout.session",
              status: "open",
              mode: "subscription",
              url: `https://checkout.example.test/${state.checkoutCreateCalls.length}`,
              expires_at: Math.floor(Date.now() / 1000) + 1800,
              ...params,
              line_items: {
                data: [
                  {
                    price: state.prices.get(params.line_items[0].price),
                  },
                ],
              },
            };
            state.checkoutSessions.set(session.id, session);
            return session;
          },
          retrieve: async (id: string) => {
            const session = state.checkoutSessions.get(id);
            if (!session) throw new Error("checkout session missing");
            return session;
          },
          list: async ({ customer }: any) => ({
            data: Array.from(state.checkoutSessions.values()).filter(
              (session) => session.customer === customer,
            ),
            has_more: false,
          }),
          expire: async (id: string) => {
            const session = state.checkoutSessions.get(id);
            if (!session || session.status !== "open") throw new Error("session not open");
            session.status = "expired";
            return session;
          },
        },
      },
      billingPortal: {
        sessions: {
          create: async (params: any) => {
            state.portalCreateCalls.push(params);
            return { url: "https://billing.example.test/portal" };
          },
        },
      },
      webhooks: {
        constructEvent: () => {
          if (!state.event) throw new Error("No mock webhook event was configured.");
          return state.event;
        },
      },
    } as unknown as Stripe;

    const withBillingCheckoutLock = async <T>(userId: string, action: () => Promise<T>): Promise<T> => {
      const previous = locks.get(userId) || Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.set(userId, current);
      await previous;
      try {
        return await action();
      } finally {
        release();
        if (locks.get(userId) === current) locks.delete(userId);
      }
    };

    return { state, stripe: mockStripe, storage, withBillingCheckoutLock };
  }

  const authenticate: RequestHandler = (req, _res, next) => {
    const userId = req.get("x-test-user") || USER_A;
    req.user = { claims: { sub: userId }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
    req.isAuthenticated = () => true;
    (req as any).session = {};
    next();
  };

  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
    });
  }

  async function sendWebhook(event: any) {
    state.event = { livemode: false, ...event };
    return request("/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "test-signature" },
      body: JSON.stringify({ ignored: true }),
    });
  }

  beforeEach(async () => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      if (process.env[key] !== undefined) savedEnv[key] = process.env[key];
    }
    process.env.STRIPE_SECRET_KEY = "sk_test_billing_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_billing_mock";
    process.env.STRIPE_WEBHOOK_CONFIGURED = "true";
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_test_mock";
    process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
    process.env.STRIPE_PROFESSIONAL_PRICE_ID = "price_professional";
    process.env.STRIPE_BUSINESS_PRICE_ID = "price_business";
    process.env.NODE_ENV = "test";
    delete process.env.STRIPE_AUTOMATIC_TAX_ENABLED;

    const fixture = makeFixture();
    state = fixture.state;
    stripe = fixture.stripe;
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buffer) => {
          (req as any).rawBody = Buffer.from(buffer);
        },
      }),
    );
    server = createServer(app);
    await registerRoutes(server, app, {
      storage: fixture.storage,
      isAuthenticated: authenticate,
      stripeClient: stripe,
      withBillingCheckoutLock: fixture.withBillingCheckoutLock,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  test("status reports mode/readiness without returning Stripe identifiers", async () => {
    const response = await request("/api/subscription/status");
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(result, { livemode: false, ready: true });
    assert.equal(JSON.stringify(result).includes("price_"), false);
  });

  test("checkout validates the configured GBP monthly price and includes confirmation URL", async () => {
    const response = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.url, "https://checkout.example.test/1");
    assert.equal(state.checkoutCreateCalls.length, 1);
    const call = state.checkoutCreateCalls[0];
    assert.equal(call.params.line_items[0].price, "price_starter");
    assert.match(call.params.success_url, /billing=success&session_id=\{CHECKOUT_SESSION_ID\}$/);
    assert.equal("automatic_tax" in call.params, false);
    assert.match(call.options.idempotencyKey, /^coach-subscription-billing-coach-a-starter-/);
  });

  test("mispriced and production test-mode prices are rejected before Checkout", async () => {
    state.prices.set("price_professional", {
      ...state.prices.get("price_professional"),
      unit_amount: 500,
    });
    const wrongAmount = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "professional" }),
    });
    assert.equal(wrongAmount.status, 503);
    assert.match((await wrongAmount.json()).message, /£4\.99 GBP per month/);
    assert.equal(state.checkoutCreateCalls.length, 0);

    process.env.NODE_ENV = "production";
    const productionTestKey = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    assert.equal(productionTestKey.status, 503);
    assert.match((await productionTestKey.json()).message, /Live Stripe credentials/);
  });

  test("a live Stripe key rejects configured test-mode prices", async () => {
    process.env.NODE_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_live_billing_mock";
    const response = await request("/api/subscription/status");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.livemode, true);
    assert.equal(body.ready, false);
    assert.match(body.message, /does not match the configured live-mode account/);

    const checkout = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    assert.equal(checkout.status, 503);
    assert.equal(state.checkoutCreateCalls.length, 0);
  });

  test("a correctly configured live GBP monthly price is accepted", async () => {
    process.env.NODE_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_live_billing_mock";
    Array.from(state.prices.values()).forEach((price) => {
      price.livemode = true;
    });
    const response = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    assert.equal(response.status, 200);
    assert.equal(state.checkoutCreateCalls.length, 1);
    assert.equal(state.checkoutCreateCalls[0].params.line_items[0].price, "price_starter");
  });

  test("status and checkout remain blocked until the webhook endpoint marker is verified", async () => {
    delete process.env.STRIPE_WEBHOOK_CONFIGURED;
    const response = await request("/api/subscription/status");
    const body = await response.json();
    assert.equal(body.livemode, false);
    assert.equal(body.ready, false);
    assert.match(body.message, /webhook signing secret has not been verified/);
    const checkout = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    assert.equal(checkout.status, 503);
    assert.equal(state.checkoutCreateCalls.length, 0);
  });

  test("concurrent repeated Checkout requests reuse a single open session", async () => {
    const [first, second] = await Promise.all([
      request("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "starter" }),
      }),
      request("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "starter" }),
      }),
    ]);
    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(state.checkoutCreateCalls.length, 1);
    assert.equal(firstBody.url, secondBody.url);
    const original = state.checkoutSessions.get("cs_test_1");
    state.checkoutSessions.set("cs_test_duplicate", {
      ...original,
      id: "cs_test_duplicate",
      url: "https://checkout.example.test/duplicate",
    });
    const third = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    assert.equal(third.status, 200);
    assert.equal((await third.json()).url, "https://checkout.example.test/1");
    assert.equal(state.checkoutSessions.get("cs_test_duplicate").status, "expired");
    assert.equal(state.checkoutCreateCalls.length, 1);
  });

  test("expired Checkout sessions are not reused", async () => {
    state.checkoutSessions.set("cs_test_expired", {
      id: "cs_test_expired",
      status: "expired",
      mode: "subscription",
      customer: "cus_a",
      metadata: { userId: USER_A },
      url: "https://checkout.example.test/expired",
      expires_at: Math.floor(Date.now() / 1000) - 60,
      line_items: {
        data: [{ price: state.prices.get("price_starter") }],
      },
    });
    const response = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).url, "https://checkout.example.test/1");
    assert.equal(state.checkoutCreateCalls.length, 1);
  });

  test("a different-plan Checkout expires the superseded open session", async () => {
    const first = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    const second = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "professional" }),
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(state.checkoutCreateCalls.length, 2);
    assert.equal(state.checkoutSessions.get("cs_test_1").status, "expired");
    assert.equal(state.checkoutCreateCalls[1].params.line_items[0].price, "price_professional");
  });

  test("an active paid subscription goes through the targeted configured Billing Portal", async () => {
    process.env.STRIPE_WEBHOOK_CONFIGURED = "false";
    const currentSubscription = makeSubscription();
    state.subscriptions.set(currentSubscription.id, currentSubscription);
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: currentSubscription.id,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
    });
    const response = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "professional" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.billingPortal, true);
    assert.equal(state.checkoutCreateCalls.length, 0);
    assert.equal(state.portalCreateCalls.length, 1);
    assert.equal(state.portalCreateCalls[0].configuration, "bpc_test_mock");
    assert.equal(state.portalCreateCalls[0].flow_data.type, "subscription_update_confirm");
    assert.equal(state.portalCreateCalls[0].flow_data.subscription_update_confirm.subscription, "sub_a");
    assert.equal(
      state.portalCreateCalls[0].flow_data.subscription_update_confirm.items[0].price,
      "price_professional",
    );
  });

  test("portal upgrade refuses a Stripe customer owned by another user", async () => {
    const currentSubscription = makeSubscription();
    state.subscriptions.set(currentSubscription.id, currentSubscription);
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: currentSubscription.id,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
    });
    state.customers.get("cus_a").metadata.userId = USER_B;
    const response = await request("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "professional" }),
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /not connected to the authenticated account/);
    assert.equal(state.portalCreateCalls.length, 0);
  });

  test("Checkout confirmation enforces ownership and payment, then derives plan from the trusted price", async () => {
    const currentSubscription = makeSubscription();
    state.subscriptions.set(currentSubscription.id, currentSubscription);
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: "sub_old",
    });
    const session = {
      id: "cs_test_confirm",
      status: "complete",
      mode: "subscription",
      payment_status: "unpaid",
      customer: "cus_a",
      subscription: "sub_a",
      metadata: { userId: USER_A },
    };
    state.checkoutSessions.set(session.id, session);

    const unpaid = await request("/api/subscription/confirm", {
      method: "POST",
      body: JSON.stringify({ session_id: session.id }),
    });
    assert.equal(unpaid.status, 409);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");

    session.payment_status = "paid";
    session.metadata.userId = USER_B;
    const wrongOwner = await request("/api/subscription/confirm", {
      method: "POST",
      body: JSON.stringify({ session_id: session.id }),
    });
    assert.equal(wrongOwner.status, 403);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");

    session.metadata.userId = USER_A;
    const response = await request("/api/subscription/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId: session.id }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      verified: true,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
    });
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "starter");
  });

  test("webhook activation waits for paid Checkout and ignores metadata.plan", async () => {
    const currentSubscription = makeSubscription({
      latest_invoice: { id: "in_a", status: "open", paid: false },
    });
    state.subscriptions.set(currentSubscription.id, currentSubscription);
    const session = {
      id: "cs_test_async",
      status: "complete",
      mode: "subscription",
      payment_status: "unpaid",
      customer: "cus_a",
      subscription: "sub_a",
      metadata: { userId: USER_A, plan: "business" },
    };
    let response = await sendWebhook({
      type: "checkout.session.completed",
      data: { object: session },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");
    assert.equal(state.settings.get(USER_A).subscriptionStatus, "pending_payment");

    response = await sendWebhook({
      type: "checkout.session.async_payment_failed",
      data: { object: session },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");
    assert.equal(state.settings.get(USER_A).subscriptionStatus, "payment_failed");

    session.payment_status = "paid";
    currentSubscription.latest_invoice = { id: "in_a", status: "paid", paid: true };
    response = await sendWebhook({
      type: "checkout.session.async_payment_succeeded",
      data: { object: session },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "starter");
    assert.equal(state.settings.get(USER_A).subscriptionStatus, "active");
  });

  test("webhook Checkout ownership must match both its stored customer and subscription", async () => {
    const wrongSubscription = makeSubscription({
      customer: "cus_someone_else",
      metadata: { userId: USER_B, plan: "starter" },
    });
    state.subscriptions.set(wrongSubscription.id, wrongSubscription);
    const response = await sendWebhook({
      type: "checkout.session.completed",
      data: {
        object: {
          status: "complete",
          mode: "subscription",
          payment_status: "paid",
          customer: "cus_a",
          subscription: "sub_a",
          metadata: { userId: USER_A, plan: "business" },
        },
      },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).stripeSubscriptionId, undefined);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");
  });

  test("webhooks enforce subscription ownership, handle invoice parent shape, and ignore stale deletes", async () => {
    const currentSubscription = makeSubscription();
    state.subscriptions.set(currentSubscription.id, currentSubscription);
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: currentSubscription.id,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
    });
    const invoice = {
      customer: "cus_a",
      parent: { subscription_details: { subscription: "sub_a" } },
      id: "in_a",
    };
    currentSubscription.latest_invoice = { id: "in_a", status: "open", paid: false };
    let response = await sendWebhook({
      type: "invoice.payment_failed",
      data: { object: invoice },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");
    assert.equal(state.settings.get(USER_A).subscriptionStatus, "past_due");

    currentSubscription.latest_invoice = { id: "in_a", status: "paid", paid: true };
    response = await sendWebhook({ type: "invoice.paid", data: { object: invoice } });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "starter");

    currentSubscription.latest_invoice = { id: "in_latest", status: "paid", paid: true };
    response = await sendWebhook({
      type: "invoice.payment_failed",
      data: { object: { ...invoice, id: "in_old" } },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "starter");
    assert.equal(state.settings.get(USER_A).subscriptionStatus, "active");

    const otherSubscription = makeSubscription({
      id: "sub_old",
      customer: "cus_a",
      status: "canceled",
    });
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: "sub_new",
      subscriptionPlan: "professional",
      subscriptionStatus: "active",
    });
    response = await sendWebhook({
      type: "customer.subscription.deleted",
      data: { object: otherSubscription },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).stripeSubscriptionId, "sub_new");
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "professional");
  });

  test("a previously paid plan cannot authorize a newly changed unpaid Stripe price", async () => {
    const currentSubscription = makeSubscription({
      items: {
        data: [{ id: "si_a", quantity: 1, price: { id: "price_professional" } }],
      },
      latest_invoice: { id: "in_new", status: "open", paid: false },
      metadata: { userId: USER_A, plan: "business" },
    });
    state.subscriptions.set(currentSubscription.id, currentSubscription);
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: currentSubscription.id,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
    });
    let response = await sendWebhook({
      type: "customer.subscription.updated",
      data: { object: currentSubscription },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "free");
    assert.equal(state.settings.get(USER_A).subscriptionStatus, "pending_payment");

    currentSubscription.latest_invoice = { id: "in_new", status: "paid", paid: true };
    response = await sendWebhook({
      type: "customer.subscription.updated",
      data: { object: currentSubscription },
    });
    assert.equal(response.status, 204);
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "professional");
  });

  test("Stripe subscribers cannot be downgraded through local plan settings", async () => {
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeSubscriptionId: "sub_a",
      subscriptionPlan: "professional",
      subscriptionStatus: "active",
    });
    const response = await request("/api/settings/plan", {
      method: "PATCH",
      body: JSON.stringify({ plan: "free" }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "BILLING_PORTAL_REQUIRED");
    assert.equal(state.settings.get(USER_A).subscriptionPlan, "professional");
  });

  test("ordinary settings updates cannot modify server-managed billing fields", async () => {
    state.settings.set(USER_A, {
      ...state.settings.get(USER_A),
      stripeCustomerId: "cus_a",
      stripeSubscriptionId: "sub_a",
      subscriptionPlan: "professional",
      subscriptionStatus: "active",
    });
    const response = await request("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        trainerName: "Updated Coach",
        stripeCustomerId: "cus_attacker",
        stripeSubscriptionId: "sub_attacker",
        subscriptionPlan: "business",
        subscriptionStatus: "active",
      }),
    });
    assert.equal(response.status, 200);
    const updated = state.settings.get(USER_A);
    assert.equal(updated.trainerName, "Updated Coach");
    assert.equal(updated.stripeCustomerId, "cus_a");
    assert.equal(updated.stripeSubscriptionId, "sub_a");
    assert.equal(updated.subscriptionPlan, "professional");
    assert.equal(updated.subscriptionStatus, "active");
  });
});