export const OWNER_INPUT_REQUIRED = "TODO: OWNER INPUT REQUIRED";

export const siteConfig = {
  name: "FitTrack",
  tagline: "The simple business hub for independent fitness coaches.",
  description:
    "FitTrack helps UK fitness coaches manage clients, bookings, PARQ forms, invoices, and payments in one simple dashboard.",
  siteUrl: import.meta.env.VITE_SITE_URL || "",
  supportEmail: OWNER_INPUT_REQUIRED,
  legalOperator: OWNER_INPUT_REQUIRED,
  contactAddress: OWNER_INPUT_REQUIRED,
  governingLaw: OWNER_INPUT_REQUIRED,
  effectiveDate: OWNER_INPUT_REQUIRED,
  vatTreatment: OWNER_INPUT_REQUIRED,
  paymentProviderFees: OWNER_INPUT_REQUIRED,
  paidPlanSupportResponse: OWNER_INPUT_REQUIRED,
  retentionPolicy: OWNER_INPUT_REQUIRED,
  subprocessors: "Replit Auth, PostgreSQL, Brevo, and GoCardless are used where enabled.",
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
    price: "£1.99",
    period: "/ month",
    clients: "Up to 10 clients",
    description: "For a small roster and a more organised week.",
    features: ["10 client records", "Everything in Free", "Email notifications", "Direct debit setup", "Revenue tracking"],
  },
  {
    name: "Professional",
    price: "£4.99",
    period: "/ month",
    clients: "Up to 20 clients",
    description: "For coaches building a consistent coaching business.",
    features: ["20 client records", "Everything in Starter", "Broadcast client emails", "Full invoice management", "Privacy controls for client records"],
  },
  {
    name: "Business",
    price: "£7.99",
    period: "/ month",
    clients: "Up to 50 clients",
    description: "For larger rosters that still want a coach-sized tool.",
    features: ["50 client records", "Everything in Professional", "Advanced revenue views", "Custom business details", `${OWNER_INPUT_REQUIRED}: priority support terms`],
  },
];

export function getPublicSiteUrl() {
  if (siteConfig.siteUrl) return siteConfig.siteUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}