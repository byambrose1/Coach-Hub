import Stripe from "stripe";

const PRICE_ENV_BY_PLAN: Record<string, string> = {
  starter: "STRIPE_STARTER_PRICE_ID",
  professional: "STRIPE_PROFESSIONAL_PRICE_ID",
  business: "STRIPE_BUSINESS_PRICE_ID",
};

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

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}