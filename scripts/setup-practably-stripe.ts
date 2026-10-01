import { getStripeClient } from "../server/stripe";

// Run manually only after the owner has approved creating live billing resources.
// Never print full Stripe responses: webhook creation includes a signing secret.
async function main() {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve();
  if (account.id !== "acct_1MqDdwEvW2B4rICs" || !account.charges_enabled) {
    throw new Error("The approved payment-enabled Stripe account is required.");
  }
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const plans = [
    { name: "starter", label: "Starter", amount: 199 },
    { name: "professional", label: "Professional", amount: 499 },
    { name: "business", label: "Business", amount: 799 },
  ];
  const catalog: Array<{ plan: string; productId: string; priceId: string; amount: number }> = [];
  for (const plan of plans) {
    const product = existing.data.find(
      (item) => item.metadata.app === "practably" && item.metadata.plan === plan.name,
    ) || await stripe.products.create({
      name: `Practably ${plan.label}`,
      description: `Practably ${plan.label} monthly coach subscription`,
      metadata: { app: "practably", plan: plan.name },
    }, { idempotencyKey: `practably-product-${plan.name}` });
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const price = prices.data.find(
      (item) => item.currency === "gbp" && item.unit_amount === plan.amount &&
        item.recurring?.interval === "month" && item.recurring.interval_count === 1,
    ) || await stripe.prices.create({
      product: product.id,
      currency: "gbp",
      unit_amount: plan.amount,
      recurring: { interval: "month" },
      metadata: { app: "practably", plan: plan.name },
    }, { idempotencyKey: `practably-price-${plan.name}-${plan.amount}-gbp-month` });
    if (!price.livemode) throw new Error("Live prices are required.");
    catalog.push({ plan: plan.name, productId: product.id, priceId: price.id, amount: plan.amount });
  }
  const webhookUrl = "https://www.practably.co.uk/api/webhooks/stripe";
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const events = [
    "checkout.session.completed", "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed", "customer.subscription.created",
    "customer.subscription.updated", "customer.subscription.deleted",
    "invoice.paid", "invoice.payment_failed",
  ] as const;
  const existingEndpoint = endpoints.data.find((item) => item.url === webhookUrl && item.livemode);
  const webhook = existingEndpoint
    ? await stripe.webhookEndpoints.update(existingEndpoint.id, { enabled_events: [...events] })
    : await stripe.webhookEndpoints.create({
        url: webhookUrl, enabled_events: [...events],
        description: "Practably live coach subscription activation",
      }, { idempotencyKey: "practably-live-subscription-webhook" });
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const portalParams = {
    business_profile: { headline: "Manage your Practably subscription" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["address", "name"] as Array<"address" | "name"> },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" as const },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"] as Array<"price">,
        proration_behavior: "always_invoice" as const,
        products: catalog.map((item) => ({ product: item.productId, prices: [item.priceId] })),
      },
    },
    metadata: { app: "practably" },
  };
  const existingPortal = configurations.data.find((item) => item.metadata?.app === "practably");
  const portal = existingPortal
    ? await stripe.billingPortal.configurations.update(existingPortal.id, portalParams)
    : await stripe.billingPortal.configurations.create(portalParams,
        { idempotencyKey: "practably-billing-portal" });
  console.log(JSON.stringify({
    livemode: true, catalog, webhook: { id: webhook.id, url: webhook.url, status: webhook.status },
    portalConfigurationId: portal.id,
  }));
}

main().catch(() => {
  console.error("Stripe setup failed. No credentials or raw provider errors are logged.");
  process.exitCode = 1;
});