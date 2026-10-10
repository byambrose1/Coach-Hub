import type Stripe from "stripe";

export function isUnpaidBillingSetup(settings: {
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  stripeSubscriptionId?: string | null;
  planGrantedManually?: boolean | null;
} | undefined): boolean {
  if (!settings) return false;
  // A plan an admin granted manually is not Stripe billing, but a linked
  // subscription still signals history that must be preserved.
  if (settings.planGrantedManually) return !settings.stripeSubscriptionId;
  return settings.subscriptionPlan === "free"
    && !settings.stripeSubscriptionId
    && (!settings.subscriptionStatus || settings.subscriptionStatus === "trial");
}

export class StripeBillingLinkError extends Error {
  readonly code = "BILLING_ACCOUNT_REVIEW_REQUIRED";
  constructor() {
    super("Your saved billing account cannot be found in the current Stripe account. Contact support to reconnect billing before upgrading or requesting a refund. Existing payments and subscriptions have not been changed.");
    this.name = "StripeBillingLinkError";
  }
}

// A missing customer may belong to a former Stripe account. Never silently
// replace subscribed accounts: the old account may still contain payments.
// Only explicitly marked manual access without a linked subscription, or an
// unpaid Free setup without a linked subscription, can recover at checkout.
export async function retrieveBillingCustomer(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Customer> {
  let customer: Stripe.Customer | Stripe.DeletedCustomer;
  try {
    customer = await stripe.customers.retrieve(customerId);
  } catch (error) {
    const failure = error as { code?: string; statusCode?: number } | null;
    if (failure?.code === "resource_missing" && failure.statusCode === 404) {
      throw new StripeBillingLinkError();
    }
    throw error;
  }
  if (customer.deleted) throw new StripeBillingLinkError();
  return customer;
}