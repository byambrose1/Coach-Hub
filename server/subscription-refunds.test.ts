import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  cancelAndRefundSubscription,
  getSubscriptionRefundStatus,
  SubscriptionRefundError,
} from "./subscription-refunds";
import type { IStorage } from "./storage";

const USER_ID = "refund-coach";
const CUSTOMER_ID = "cus_refund";
const SUBSCRIPTION_ID = "sub_refund";
const INVOICE_ID = "in_first";
const CHARGE_ID = "ch_first";
const PAID_AT = 1_700_000_000;
const WINDOW_SECONDS = 24 * 60 * 60;
const PRICE_ID = "price_refund_starter";
const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_PROFESSIONAL_PRICE_ID",
  "STRIPE_BUSINESS_PRICE_ID",
  "NODE_ENV",
] as const;
type SavedEnv = Partial<Record<(typeof ENV_KEYS)[number], string>>;

function makeFixture(options: Record<string, any> = {}) {
  const state = {
    now: options.now ?? PAID_AT + 60,
    settings: {
      id: USER_ID,
      userId: USER_ID,
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
      coachName: "Coach name",
      clientData: [{ id: "client-1", name: "Client record" }],
    } as Record<string, any>,
    customer: { id: CUSTOMER_ID, object: "customer", metadata: { userId: USER_ID } },
    subscription: {
      id: SUBSCRIPTION_ID,
      object: "subscription",
      customer: CUSTOMER_ID,
      status: "active",
      livemode: false,
      metadata: { userId: USER_ID },
      items: { data: [{ id: "si_refund", quantity: 1, price: { id: PRICE_ID } }] },
    } as Record<string, any>,
    invoices: [] as any[],
    invoicePages: null as any[] | null,
    charge: {
      id: CHARGE_ID,
      object: "charge",
      customer: CUSTOMER_ID,
      livemode: false,
      paid: true,
      captured: true,
      amount_captured: 199,
      amount_refunded: 0,
      currency: "gbp",
      disputed: false,
    } as Record<string, any>,
    price: {
      id: PRICE_ID,
      object: "price",
      active: true,
      currency: "gbp",
      unit_amount: 199,
      recurring: { interval: "month", interval_count: 1 },
      livemode: false,
    } as Record<string, any>,
    invoicePayments: [] as any[],
    refunds: [] as any[],
    refundCreateCalls: [] as any[],
    cancelCalls: [] as any[],
    settingsWrites: [] as any[],
    refundCreateError: null as Error | null,
    cancelError: null as Error | null,
    settingsWriteError: null as Error | null,
    refundStatusOnCreate: "succeeded",
    cancelReturnStatus: "canceled",
  };

  const invoice = (id: string, paidAt: number, overrides: Record<string, any> = {}) => ({
    id,
    object: "invoice",
    customer: CUSTOMER_ID,
    amount_paid: 199,
    currency: "gbp",
    created: paidAt,
    status: "paid",
    status_transitions: { paid_at: paidAt },
    parent: { subscription_details: { subscription: SUBSCRIPTION_ID } },
    charge: CHARGE_ID,
    payment_intent: null,
    ...overrides,
  });
  state.invoices = [invoice(INVOICE_ID, PAID_AT)];

  const stripe = {
    customers: {
      retrieve: async (id: string) => {
        assert.equal(id, CUSTOMER_ID);
        return state.customer;
      },
    },
    invoices: {
      list: async (params: any) => {
        const page = state.invoicePages;
        if (page) {
          const index = params.starting_after ? 1 : 0;
          return page[index];
        }
        return { data: state.invoices, has_more: false };
      },
    },
    subscriptions: {
      retrieve: async (id: string) => {
        assert.equal(id, SUBSCRIPTION_ID);
        return state.subscription;
      },
      cancel: async (id: string, params: any, requestOptions: any) => {
        state.cancelCalls.push({ id, params, requestOptions });
        if (state.cancelError) throw state.cancelError;
        state.subscription = { ...state.subscription, status: state.cancelReturnStatus };
        return state.subscription;
      },
    },
    prices: {
      retrieve: async (id: string) => {
        assert.equal(id, PRICE_ID);
        return state.price;
      },
    },
    charges: {
      retrieve: async (id: string) => {
        assert.equal(id, CHARGE_ID);
        return state.charge;
      },
    },
    invoicePayments: {
      list: async () => ({ data: state.invoicePayments, has_more: false }),
    },
    paymentIntents: {
      retrieve: async (id: string) => ({
        id,
        customer: CUSTOMER_ID,
        status: "succeeded",
        latest_charge: CHARGE_ID,
      }),
    },
    refunds: {
      list: async (params: any) => {
        assert.equal(params.charge, CHARGE_ID);
        return { data: state.refunds, has_more: false };
      },
      create: async (params: any, requestOptions: any) => {
        state.refundCreateCalls.push({ params, requestOptions });
        if (state.refundCreateError) throw state.refundCreateError;
        const refund = {
          id: "re_refund",
          object: "refund",
          charge: CHARGE_ID,
          amount: params.amount,
          status: state.refundStatusOnCreate,
          metadata: params.metadata,
        };
        state.refunds.push(refund);
        return refund;
      },
    },
  };
  const storage = {
    getSettings: async (userId: string) => {
      assert.equal(userId, USER_ID);
      return state.settings;
    },
    upsertSettings: async (userId: string, values: any) => {
      assert.equal(userId, USER_ID);
      state.settingsWrites.push(values);
      if (state.settingsWriteError) throw state.settingsWriteError;
      state.settings = { ...state.settings, ...values };
      return state.settings;
    },
  };
  const dependencies = {
    stripe: stripe as any,
    storage: storage as unknown as Pick<IStorage, "getSettings" | "upsertSettings">,
    now: () => state.now * 1000,
  };
  return { state, stripe, dependencies, invoice };
}

describe("subscription first-payment refunds", () => {
  let savedEnv: SavedEnv;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      if (process.env[key] !== undefined) savedEnv[key] = process.env[key];
    }
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_STARTER_PRICE_ID = PRICE_ID;
    process.env.STRIPE_PROFESSIONAL_PRICE_ID = "price_refund_professional";
    process.env.STRIPE_BUSINESS_PRICE_ID = "price_refund_business";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key]!;
    }
  });

  test("only the first-ever positive payment is eligible within the 24-hour window", async () => {
    const fixture = makeFixture({ now: PAID_AT + WINDOW_SECONDS - 1 });
    fixture.state.invoices.push(
      fixture.invoice("in_zero", PAID_AT - 10, { amount_paid: 0 }),
    );
    const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
    assert.equal(status.state, "eligible");
    assert.equal(status.amount, 199);
    assert.equal(status.paidAt, new Date(PAID_AT * 1000).toISOString());
    assert.equal(status.expiresAt, new Date((PAID_AT + WINDOW_SECONDS) * 1000).toISOString());
  });

  test("the eligibility window expires at the exact 24-hour boundary", async () => {
    const fixture = makeFixture({ now: PAID_AT + WINDOW_SECONDS });
    const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
    assert.equal(status.state, "ineligible");
    assert.match(status.message || "", /window has ended/i);
  });

  test("finds an old first payment on a later page despite a recent renewal", async () => {
    const fixture = makeFixture({ now: PAID_AT + WINDOW_SECONDS + 100 });
    const recentInvoice = fixture.invoice("in_recent_renewal", PAID_AT + 100_000);
    const originalInvoice = fixture.invoice(INVOICE_ID, PAID_AT);
    fixture.state.invoicePages = [
      { data: [recentInvoice], has_more: true },
      { data: [originalInvoice], has_more: false },
    ];
    const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
    assert.equal(status.state, "ineligible");
    assert.match(status.message || "", /window has ended/i);
  });

  test("an earlier subscription payment from a previous subscription excludes a rejoin", async () => {
    const fixture = makeFixture({ now: PAID_AT + 20 });
    fixture.state.invoices = [
      fixture.invoice("in_previous_subscription", PAID_AT - 100, {
        parent: { subscription_details: { subscription: "sub_old" } },
      }),
      fixture.invoice("in_rejoin", PAID_AT),
    ];
    const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
    assert.equal(status.state, "ineligible");
    assert.match(status.message || "", /first subscription payment/i);
  });

  test("no paid positive invoice is ineligible", async () => {
    const fixture = makeFixture();
    fixture.state.invoices = [fixture.invoice("in_zero", PAID_AT, { amount_paid: 0 })];
    const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
    assert.equal(status.state, "ineligible");
    assert.match(status.message || "", /no successful subscription payment/i);
  });

  test("validates customer and subscription ownership before making a refund eligible", async () => {
    const customerFixture = makeFixture();
    customerFixture.state.customer = {
      ...customerFixture.state.customer,
      metadata: { userId: "another-coach" },
    };
    await assert.rejects(
      getSubscriptionRefundStatus(USER_ID, customerFixture.dependencies),
      (error: any) => error instanceof SubscriptionRefundError && error.code === "BILLING_OWNERSHIP",
    );

    const subscriptionFixture = makeFixture();
    subscriptionFixture.state.subscription = {
      ...subscriptionFixture.state.subscription,
      metadata: { userId: "another-coach" },
    };
    await assert.rejects(
      getSubscriptionRefundStatus(USER_ID, subscriptionFixture.dependencies),
      (error: any) => error instanceof SubscriptionRefundError && error.code === "BILLING_OWNERSHIP",
    );
  });

  test("charge ownership mismatch requires manual review", async () => {
    const fixture = makeFixture();
    fixture.state.charge = { ...fixture.state.charge, customer: "cus_other" };
    const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
    assert.equal(status.state, "ineligible");
    assert.match(status.message || "", /manual refund review/i);
  });

  test("split and multiple invoice payments require manual review", async (t) => {
    await t.test("split payments", async () => {
      const fixture = makeFixture();
      fixture.state.invoices = [
        fixture.invoice(INVOICE_ID, PAID_AT, { charge: null, payment_intent: null }),
      ];
      fixture.state.invoicePayments = [
        {
          invoice: INVOICE_ID,
          amount_paid: 100,
          currency: "gbp",
          payment: { type: "charge", charge: "ch_part_1" },
        },
        {
          invoice: INVOICE_ID,
          amount_paid: 99,
          currency: "gbp",
          payment: { type: "charge", charge: "ch_part_2" },
        },
      ];
      const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
      assert.equal(status.state, "ineligible");
      assert.match(status.message || "", /manual refund review/i);
    });
    await t.test("multiple invoice payment records", async () => {
      const fixture = makeFixture();
      fixture.state.invoices = [
        fixture.invoice(INVOICE_ID, PAID_AT, { charge: null, payment_intent: null }),
      ];
      fixture.state.invoicePayments = [
        {
          invoice: INVOICE_ID,
          amount_paid: 199,
          currency: "gbp",
          payment: { type: "charge", charge: CHARGE_ID },
        },
        {
          invoice: INVOICE_ID,
          amount_paid: 0,
          currency: "gbp",
          payment: { type: "charge", charge: "ch_unrelated" },
        },
      ];
      const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
      assert.equal(status.state, "ineligible");
      assert.match(status.message || "", /manual refund review/i);
    });
  });

  test("supports legacy invoice charge and modern invoicePayments payment_intent latest_charge", async (t) => {
    await t.test("legacy invoice charge", async () => {
      const fixture = makeFixture();
      assert.equal(
        (await getSubscriptionRefundStatus(USER_ID, fixture.dependencies)).state,
        "eligible",
      );
    });
    await t.test("modern invoice payment intent", async () => {
      const fixture = makeFixture();
      fixture.state.invoices = [
        fixture.invoice(INVOICE_ID, PAID_AT, { charge: null, payment_intent: null }),
      ];
      fixture.state.invoicePayments = [
        {
          invoice: INVOICE_ID,
          amount_paid: 199,
          currency: "gbp",
          payment: { type: "payment_intent", payment_intent: "pi_refund" },
        },
      ];
      const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
      assert.equal(status.state, "eligible");
    });
  });

  test("creates a full refund with policy metadata and immediately cancels without prorations or an invoice", async () => {
    const requestedAt = PAID_AT + 500;
    const fixture = makeFixture({ now: requestedAt });
    const result = await cancelAndRefundSubscription(USER_ID, fixture.dependencies);
    assert.equal(result.state, "completed");
    assert.equal(fixture.state.refundCreateCalls.length, 1);
    const [{ params, requestOptions }] = fixture.state.refundCreateCalls;
    assert.deepEqual(params, {
      charge: CHARGE_ID,
      amount: 199,
      reason: "requested_by_customer",
      metadata: {
        policy: "practably_first_payment_24h",
        userId: USER_ID,
        invoiceId: INVOICE_ID,
        requestedAt: String(requestedAt),
      },
    });
    assert.equal(requestOptions.idempotencyKey, `practably-refund-24h:${INVOICE_ID}`);
    assert.deepEqual(fixture.state.cancelCalls[0], {
      id: SUBSCRIPTION_ID,
      params: { invoice_now: false, prorate: false },
      requestOptions: { idempotencyKey: `practably-refund-cancel:${SUBSCRIPTION_ID}` },
    });
    assert.equal(fixture.state.settings.subscriptionPlan, "free");
    assert.equal(fixture.state.settings.subscriptionStatus, "canceled");
    assert.equal(fixture.state.settings.stripeCustomerId, CUSTOMER_ID);
    assert.equal(fixture.state.settings.coachName, "Coach name");
    assert.deepEqual(fixture.state.settings.clientData, [{ id: "client-1", name: "Client record" }]);
  });

  test("retries reuse an existing refund even after the window, then complete cancellation", async () => {
    const fixture = makeFixture({ now: PAID_AT + 100 });
    fixture.state.cancelError = new Error("temporary cancellation failure");
    await assert.rejects(
      cancelAndRefundSubscription(USER_ID, fixture.dependencies),
      /temporary cancellation failure/,
    );
    assert.equal(fixture.state.refundCreateCalls.length, 1);
    fixture.state.cancelError = null;
    fixture.state.now = PAID_AT + WINDOW_SECONDS + 1;
    const retry = await cancelAndRefundSubscription(USER_ID, fixture.dependencies);
    assert.equal(retry.state, "completed");
    assert.equal(fixture.state.refundCreateCalls.length, 1);
    assert.equal(fixture.state.cancelCalls.length, 2);
  });

  test("pending refunds report processing and succeeded refunds report completed", async (t) => {
    await t.test("pending", async () => {
      const fixture = makeFixture();
      fixture.state.refundStatusOnCreate = "pending";
      const status = await cancelAndRefundSubscription(USER_ID, fixture.dependencies);
      assert.equal(status.state, "processing");
      assert.equal(fixture.state.settings.subscriptionPlan, "free");
      assert.equal(
        (await getSubscriptionRefundStatus(USER_ID, fixture.dependencies)).state,
        "processing",
      );
    });
    await t.test("succeeded", async () => {
      const fixture = makeFixture();
      assert.equal(
        (await cancelAndRefundSubscription(USER_ID, fixture.dependencies)).state,
        "completed",
      );
      assert.equal(
        (await getSubscriptionRefundStatus(USER_ID, fixture.dependencies)).state,
        "completed",
      );
    });
  });

  test("provider refund failure leaves the subscription and settings unchanged", async () => {
    const fixture = makeFixture();
    fixture.state.refundCreateError = new Error("Stripe refund create failed");
    const originalSettings = { ...fixture.state.settings };
    await assert.rejects(
      cancelAndRefundSubscription(USER_ID, fixture.dependencies),
      /Stripe refund create failed/,
    );
    assert.equal(fixture.state.subscription.status, "active");
    assert.deepEqual(fixture.state.settings, originalSettings);
    assert.equal(fixture.state.cancelCalls.length, 0);
  });

  test("cancellation failure after refund creation recovers without creating another refund", async () => {
    const fixture = makeFixture();
    fixture.state.cancelReturnStatus = "active";
    await assert.rejects(
      cancelAndRefundSubscription(USER_ID, fixture.dependencies),
      (error: any) => error instanceof SubscriptionRefundError && error.code === "CANCELLATION_PENDING",
    );
    fixture.state.cancelReturnStatus = "canceled";
    const retry = await cancelAndRefundSubscription(USER_ID, fixture.dependencies);
    assert.equal(retry.state, "completed");
    assert.equal(fixture.state.refundCreateCalls.length, 1);
    assert.equal(fixture.state.cancelCalls.length, 2);
  });

  test("storage failure after Stripe cancellation retries without a second refund", async () => {
    const fixture = makeFixture();
    fixture.state.settingsWriteError = new Error("settings write failed");
    await assert.rejects(
      cancelAndRefundSubscription(USER_ID, fixture.dependencies),
      /settings write failed/,
    );
    assert.equal(fixture.state.subscription.status, "canceled");
    fixture.state.settingsWriteError = null;
    const retry = await cancelAndRefundSubscription(USER_ID, fixture.dependencies);
    assert.equal(retry.state, "completed");
    assert.equal(fixture.state.refundCreateCalls.length, 1);
    assert.equal(fixture.state.cancelCalls.length, 1);
  });

  test("fully or partially refunded payments cannot be refunded again", async (t) => {
    for (const refundedAmount of [199, 50]) {
      await t.test(`${refundedAmount} pence refunded`, async () => {
        const fixture = makeFixture();
        fixture.state.charge = { ...fixture.state.charge, amount_refunded: refundedAmount };
        const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
        assert.equal(status.state, "ineligible");
        assert.match(status.message || "", /already has a refund request/i);
        await assert.rejects(
          cancelAndRefundSubscription(USER_ID, fixture.dependencies),
          (error: any) => error instanceof SubscriptionRefundError && error.code === "REFUND_NOT_ELIGIBLE",
        );
        assert.equal(fixture.state.refundCreateCalls.length, 0);
      });
    }
  });

  test("failed and canceled refund records show explicit manual-support state", async (t) => {
    for (const refundStatus of ["failed", "canceled"]) {
      await t.test(refundStatus, async () => {
        const fixture = makeFixture();
        fixture.state.refunds = [{
          id: `re_${refundStatus}`,
          amount: 199,
          status: refundStatus,
          metadata: {
            policy: "practably_first_payment_24h",
            userId: USER_ID,
            invoiceId: INVOICE_ID,
            requestedAt: String(PAID_AT + 10),
          },
        }];
        const status = await getSubscriptionRefundStatus(USER_ID, fixture.dependencies);
        assert.equal(status.state, "failed");
        assert.match(status.message || "", /contact support/i);
        assert.match(status.message || "", /do not submit another payment/i);
        await assert.rejects(
          cancelAndRefundSubscription(USER_ID, fixture.dependencies),
          (error: any) => error instanceof SubscriptionRefundError && error.code === "REFUND_NOT_ELIGIBLE",
        );
        assert.equal(fixture.state.refundCreateCalls.length, 0);
      });
    }
  });

  test("invalid configured prices fail validation and mismatched Stripe modes are rejected", async (t) => {
    await t.test("configured price amount validation", async () => {
      const fixture = makeFixture();
      fixture.state.price = { ...fixture.state.price, unit_amount: 200 };
      await assert.rejects(
        getSubscriptionRefundStatus(USER_ID, fixture.dependencies),
        /must be £1\.99 GBP per month/,
      );
    });
    await t.test("subscription livemode mismatch", async () => {
      const fixture = makeFixture();
      fixture.state.subscription = { ...fixture.state.subscription, livemode: true };
      await assert.rejects(
        getSubscriptionRefundStatus(USER_ID, fixture.dependencies),
        (error: any) => error instanceof SubscriptionRefundError && error.code === "BILLING_OWNERSHIP",
      );
    });
    await t.test("price livemode mismatch", async () => {
      const fixture = makeFixture();
      fixture.state.price = { ...fixture.state.price, livemode: true };
      await assert.rejects(
        getSubscriptionRefundStatus(USER_ID, fixture.dependencies),
        /does not match the configured test-mode account/,
      );
    });
  });
});