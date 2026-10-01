import Stripe from "stripe";

const PRICE_ENV_BY_PLAN: Record<string, string> = {
  starter: "STRIPE_STARTER_PRICE_ID",
  professional: "STRIPE_PROFESSIONAL_PRICE_ID",
  business: "STRIPE_BUSINESS_PRICE_ID",
};

export const STRIPE_PLAN_PRICE_PENCE: Record<string, number> = {
  starter: 199,
  professional: 499,
  business: 799,
};

export type StripeMode = "live" | "test" | "unknown" | "unconfigured";

export class StripeBillingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeBillingConfigurationError";
  }
}

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function getStripePriceId(plan: string): string {
  const envName = PRICE_ENV_BY_PLAN[plan];
  return envName ? process.env[envName] || "" : "";
}

export function getStripePlanForPrice(priceId: string): string | undefined {
  return Object.entries(PRICE_ENV_BY_PLAN).find(([, envName]) => process.env[envName] === priceId)?.[0];
}

export function getStripeMode(): StripeMode {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secretKey) return "unconfigured";
  if (/^(sk|rk)_live_/.test(secretKey)) return "live";
  if (/^(sk|rk)_test_/.test(secretKey)) return "test";
  return "unknown";
}

export function validateStripePrice(
  price: Stripe.Price,
  plan: string,
  expectedMode: "live" | "test",
): void {
  const expectedAmount = STRIPE_PLAN_PRICE_PENCE[plan];
  if (expectedAmount === undefined || price.active !== true) {
    throw new StripeBillingConfigurationError(
      `The Stripe ${plan} price is not configured as an active price.`,
    );
  }
  if (
    price.currency !== "gbp" ||
    price.unit_amount !== expectedAmount ||
    price.recurring?.interval !== "month" ||
    (price.recurring.interval_count ?? 1) !== 1
  ) {
    throw new StripeBillingConfigurationError(
      `The Stripe ${plan} price must be £${(expectedAmount / 100).toFixed(2)} GBP per month.`,
    );
  }
  if (price.livemode !== (expectedMode === "live")) {
    throw new StripeBillingConfigurationError(
      `The Stripe ${plan} price does not match the configured ${expectedMode}-mode account.`,
    );
  }
}

export function validateStripeModeForBilling(): "live" | "test" {
  const mode = getStripeMode();
  if (mode === "unconfigured") {
    throw new StripeBillingConfigurationError("Stripe billing is not configured.");
  }
  if (mode === "unknown") {
    throw new StripeBillingConfigurationError("Stripe billing credentials have an unrecognized mode.");
  }
  if (process.env.NODE_ENV === "production" && mode !== "live") {
    throw new StripeBillingConfigurationError(
      "Live Stripe credentials are required for billing in production.",
    );
  }
  return mode;
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}