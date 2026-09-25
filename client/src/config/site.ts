export const OWNER_INPUT_REQUIRED = "TODO: OWNER INPUT REQUIRED";

export const siteConfig = {
  name: "Practably",
  tagline: "The simple business hub for independent coaches.",
  description:
    "Practably helps UK coaches manage clients, bookings, PARQ forms, invoices, and payments in one simple dashboard.",
  siteUrl: import.meta.env.VITE_SITE_URL || "",
  supportEmail: "contact@practably.co.uk",
  legalOperator: "ElectriSoul Limited",
  contactAddress: "Unit 29 Highcroft Industrial Estate, Enterprise Road, Waterlooville, England, PO8 0BT",
  governingLaw: "England and Wales",
  effectiveDate: "13 September 2026",
  vatTreatment: "Practably is not VAT-registered, so no VAT is added to these prices.",
  paymentProviderFees: "Your Practably subscription is billed via Stripe, which charges its own standard transaction fees separate from your subscription price. How you charge your own clients (cash, card machine, bank transfer, PayPal, your own Stripe payment link, or another method you choose in Settings) is entirely your own arrangement - Practably does not process, hold, or take any share of payments between you and your clients.",
  cancellationTerms: "You can cancel or downgrade a paid plan at any time from the Billing Portal in Settings. Access to your current plan's features continues until the end of the billing period you've already paid for; we don't issue partial refunds for the remainder of a billing period.",
  paidPlanSupportResponse: "We aim to reply within 4 hours. Messages sent after 8pm GMT are answered the next morning.",
  retentionPolicy: "Requesting account deletion in Settings immediately and permanently deletes your account and all client data - this cannot be undone, so export anything you need first.",
  subprocessors: "Replit Auth, PostgreSQL, Brevo, and Stripe are used to run Practably itself. GoCardless integration exists in the product but is not currently enabled for coach-client payments.",
};

export const pricingTiers = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    clients: "Up to 5 clients",
    description: "A focused starting point for independent coaches.",
    features: ["5 client records", "Session scheduling", "PARQ forms", "Basic invoicing", "Client data export"],
  },
  {
    name: "Starter",
    price: "£3.99",
    period: "/ month",
    clients: "Up to 10 clients",
    description: "For a small roster and a more organised week.",
    features: ["10 client records", "Everything in Free", "Email notifications", "Direct debit setup", "Revenue tracking"],
  },
  {
    name: "Professional",
    price: "£7.99",
    period: "/ month",
    clients: "Up to 20 clients",
    description: "For coaches building a consistent coaching business.",
    features: ["20 client records", "Everything in Starter", "Broadcast client emails", "Full invoice management", "Privacy controls for client records"],
  },
  {
    name: "Business",
    price: "£12.99",
    period: "/ month",
    clients: "Up to 50 clients",
    description: "For larger rosters that still want a coach-sized tool.",
    features: ["50 client records", "Everything in Professional", "Advanced revenue views", "Custom business details", "Priority support: response within 4 hours"],
  },
];

export function getPublicSiteUrl() {
  if (siteConfig.siteUrl) return siteConfig.siteUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}