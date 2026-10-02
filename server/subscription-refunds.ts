import type Stripe from "stripe";
import type { IStorage } from "./storage";
import type { SubscriptionRefundStatus } from "@shared/subscription-refund";
import { getStripePlanForPrice, validateStripeModeForBilling, validateStripePrice } from "./stripe";

const WINDOW_SECONDS = 24 * 60 * 60;
const POLICY = "practably_first_payment_24h";
const MAX_PAGES = 10;

type Dependencies = {
  stripe: Stripe;
  storage: Pick<IStorage, "getSettings" | "upsertSettings">;
  now?: () => number;
};

export class SubscriptionRefundError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "SubscriptionRefundError";
  }
}

function objectId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  return objectId(invoice.parent?.subscription_details?.subscription)
    || objectId((invoice as Stripe.Invoice & { subscription?: unknown }).subscription);
}

async function collectPages<T extends { id: string }>(
  list: (startingAfter?: string) => Promise<{ data: T[]; has_more: boolean }>,
): Promise<T[]> {
  const all: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await list(startingAfter);
    all.push(...result.data);
    if (!result.has_more) return all;
    const last = result.data.at(-1)?.id;
    if (!last || last === startingAfter) break;
    startingAfter = last;
  }
  // Never decide "first payment" from a silently truncated history.
  throw new SubscriptionRefundError(409, "HISTORY_REQUIRES_REVIEW", "Your payment history needs a manual refund review. Please contact support.");
}

function ineligible(message: string): SubscriptionRefundStatus {
  return { state: "ineligible", message };
}

async function getInvoiceCharge(stripe: Stripe, invoice: Stripe.Invoice): Promise<Stripe.Charge | undefined> {
  const legacy = invoice as Stripe.Invoice & { charge?: unknown; payment_intent?: unknown };
  let chargeId = objectId(legacy.charge);
  let intentId = objectId(legacy.payment_intent);
  if (!chargeId && !intentId) {
    const payments = await stripe.invoicePayments.list({
      invoice: invoice.id,
      status: "paid",
      limit: 100,
    });
    // Split payments and externally recorded payments need a manual review.
    if (payments.has_more || payments.data.length !== 1) return;
    const payment = payments.data[0];
    if (
      objectId(payment.invoice) !== invoice.id ||
      payment.amount_paid !== invoice.amount_paid ||
      payment.currency !== invoice.currency
    ) return;
    if (payment.payment.type === "charge") chargeId = objectId(payment.payment.charge);
    else if (payment.payment.type === "payment_intent") intentId = objectId(payment.payment.payment_intent);
  }
  if (!chargeId && intentId) {
    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (objectId(intent.customer) !== objectId(invoice.customer) || intent.status !== "succeeded") return;
    chargeId = objectId(intent.latest_charge);
  }
  return chargeId ? stripe.charges.retrieve(chargeId) : undefined;
}

async function inspect(userId: string, dependencies: Dependencies) {
  const { stripe, storage } = dependencies;
  const now = Math.floor((dependencies.now?.() ?? Date.now()) / 1000);
  const mode = validateStripeModeForBilling();
  const settings = await storage.getSettings(userId);
  if (!settings?.stripeCustomerId) {
    return { status: ineligible("The 24-hour guarantee applies to your first subscription payment. You have no paid subscription payment yet.") };
  }
  const customer = await stripe.customers.retrieve(settings.stripeCustomerId);
  if ("deleted" in customer || customer.metadata.userId !== userId) {
    throw new SubscriptionRefundError(403, "BILLING_OWNERSHIP", "This billing account is not connected to your account.");
  }
  const invoices = (await collectPages(startingAfter => stripe.invoices.list({
    customer: settings.stripeCustomerId!,
    status: "paid",
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }))).filter(invoice => invoice.amount_paid > 0);
  if (!invoices.length) return { status: ineligible("You have no successful subscription payment to refund yet.") };
  if (invoices.some(invoice => !invoice.status_transitions.paid_at)) {
    return { status: ineligible("Your payment history needs a manual refund review. Please contact support.") };
  }
  invoices.sort((a, b) => a.status_transitions.paid_at! - b.status_transitions.paid_at! || a.created - b.created);
  const invoice = invoices[0];
  const paidAt = invoice.status_transitions.paid_at!;
  const expiresAt = paidAt + WINDOW_SECONDS;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (
    !subscriptionId ||
    objectId(invoice.customer) !== settings.stripeCustomerId ||
    paidAt > now ||
    (settings.stripeSubscriptionId && settings.stripeSubscriptionId !== subscriptionId)
  ) return { status: ineligible("Only the first subscription payment is covered. Please contact support for other refund requests.") };

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (
    objectId(subscription.customer) !== settings.stripeCustomerId ||
    subscription.metadata.userId !== userId ||
    subscription.livemode !== (mode === "live")
  ) throw new SubscriptionRefundError(403, "BILLING_OWNERSHIP", "This subscription is not connected to your account.");
  const priceId = objectId(subscription.items.data[0]?.price);
  const plan = priceId ? getStripePlanForPrice(priceId) : undefined;
  if (!plan || subscription.items.data.length !== 1 || subscription.items.data[0].quantity !== 1) {
    return { status: ineligible("This subscription needs a manual refund review. Please contact support.") };
  }
  validateStripePrice(await stripe.prices.retrieve(priceId!), plan, mode);
  const charge = await getInvoiceCharge(stripe, invoice);
  if (
    !charge ||
    objectId(charge.customer) !== settings.stripeCustomerId ||
    charge.livemode !== (mode === "live") ||
    !charge.paid || !charge.captured ||
    charge.amount_captured !== invoice.amount_paid ||
    charge.currency !== invoice.currency ||
    charge.disputed
  ) return { status: ineligible("This payment needs a manual refund review. Please contact support.") };
  const refunds = await collectPages(startingAfter => stripe.refunds.list({
    charge: charge.id,
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }));
  const refund = refunds.find(item =>
    item.metadata?.policy === POLICY &&
    item.metadata.userId === userId &&
    item.metadata.invoiceId === invoice.id &&
    item.amount === invoice.amount_paid &&
    Number(item.metadata.requestedAt) >= paidAt &&
    Number(item.metadata.requestedAt) < expiresAt
  );
  const details = {
    amount: invoice.amount_paid,
    currency: invoice.currency,
    paidAt: new Date(paidAt * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    subscriptionCancelled: subscription.status === "canceled",
  };
  let status: SubscriptionRefundStatus;
  if (refund) {
    if (refund.status === "failed" || refund.status === "canceled") {
      status = { ...details, state: "failed", message: "Stripe could not complete your refund. Please contact support; do not submit another payment." };
    } else if (
      refund.status === "succeeded" &&
      subscription.status === "canceled" &&
      settings.subscriptionPlan === "free" &&
      settings.subscriptionStatus === "canceled"
    ) {
      status = { ...details, state: "completed", message: "Your subscription is cancelled and your refund has been issued to the original payment method. Bank processing can take several days." };
    } else {
      status = {
        ...details,
        state: "processing",
        message: subscription.status !== "canceled" || settings.subscriptionPlan !== "free"
          ? "Stripe has accepted your refund request. Please finish cancellation to stop renewal and return to Free."
          : "Your subscription is cancelled and your plan is Free. Stripe is still processing the refund to your original payment method.",
        // Also allow retry when Stripe cancelled but the local write failed.
        subscriptionCancelled: subscription.status === "canceled" && settings.subscriptionPlan === "free" && settings.subscriptionStatus === "canceled",
      };
    }
  } else if (refunds.some(item => !["failed", "canceled"].includes(item.status || "")) || charge.amount_refunded > 0) {
    status = { ...details, ...ineligible("This payment already has a refund request. Please contact support rather than requesting another refund.") };
  } else if (now >= expiresAt) {
    status = { ...details, ...ineligible("The 24-hour first-payment refund window has ended. You can still cancel renewal through Manage billing or contact support about a refund.") };
  } else if (invoices.length !== 1) {
    status = { ...details, ...ineligible("Additional payments have been made since your first payment. Please contact support for a refund review.") };
  } else {
    status = { ...details, state: "eligible" };
  }
  return { status, settings, subscription, invoice, charge, refund, now };
}

export async function getSubscriptionRefundStatus(userId: string, dependencies: Dependencies): Promise<SubscriptionRefundStatus> {
  return (await inspect(userId, dependencies)).status;
}

export async function cancelAndRefundSubscription(userId: string, dependencies: Dependencies): Promise<SubscriptionRefundStatus> {
  const context = await inspect(userId, dependencies);
  if (context.status.state === "completed") return context.status;
  if (!["eligible", "processing"].includes(context.status.state) || !context.invoice || !context.charge || !context.subscription || !context.settings) {
    throw new SubscriptionRefundError(409, "REFUND_NOT_ELIGIBLE", context.status.message || "This payment is not eligible for an automatic refund.");
  }
  const { stripe, storage } = dependencies;
  let refund = context.refund;
  if (!refund) {
    // Recheck immediately before the irreversible operation, not just at page load.
    const requestedAt = Math.floor((dependencies.now?.() ?? Date.now()) / 1000);
    if (requestedAt >= context.invoice.status_transitions.paid_at! + WINDOW_SECONDS) {
      throw new SubscriptionRefundError(409, "REFUND_WINDOW_EXPIRED", "The 24-hour refund window has ended. Please contact support.");
    }
    refund = await stripe.refunds.create({
      charge: context.charge.id,
      amount: context.invoice.amount_paid,
      reason: "requested_by_customer",
      metadata: {
        policy: POLICY,
        userId,
        invoiceId: context.invoice.id,
        requestedAt: String(requestedAt),
      },
    }, {
      idempotencyKey: `practably-refund-24h:${context.invoice.id}`,
    });
  }
  if (!["succeeded", "pending", "requires_action"].includes(refund.status || "")) {
    throw new SubscriptionRefundError(502, "REFUND_FAILED", "Stripe could not complete your refund. Please contact support.");
  }
  if (context.subscription.status !== "canceled") {
    const cancelled = await stripe.subscriptions.cancel(context.subscription.id, {
      invoice_now: false,
      prorate: false,
    }, {
      idempotencyKey: `practably-refund-cancel:${context.subscription.id}`,
    });
    if (cancelled.status !== "canceled") {
      throw new SubscriptionRefundError(502, "CANCELLATION_PENDING", "Your refund was requested, but cancellation is not yet confirmed. Please retry to finish cancellation.");
    }
  }
  await storage.upsertSettings(userId, {
    ...context.settings,
    stripeSubscriptionId: context.subscription.id,
    subscriptionPlan: "free",
    subscriptionStatus: "canceled",
  });
  return {
    ...context.status,
    state: refund.status === "succeeded" ? "completed" : "processing",
    subscriptionCancelled: true,
    message: refund.status === "succeeded"
      ? "Your subscription is cancelled and your refund has been issued to the original payment method. Bank processing can take several days."
      : "Your subscription is cancelled and your plan is Free. Stripe is still processing the refund to your original payment method.",
  };
}