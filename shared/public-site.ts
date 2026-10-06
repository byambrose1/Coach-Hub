// Shared by the rendered app and its crawlable HTML. The production origin
// was verified through deployment metadata, not inferred from a dev domain.
export const publicSite = {
  name: "Practably",
  siteUrl: "https://www.practably.co.uk",
  supportEmail: "contact@practably.co.uk",
  legalOperator: "ElectriSoul Limited",
  contactAddress: "Unit 29 Highcroft Industrial Estate, Enterprise Road, Waterlooville, England, PO8 0BT",
  governingLaw: "England and Wales",
  effectiveDate: "2 October 2026",
  // Changing this forces every coach to re-accept the terms modal - bump it
  // whenever termsSections/privacySections materially change.
  termsVersion: "2026-10-02",
  vatTreatment: "Practably is not VAT-registered, so no VAT is added to these prices.",
  paymentProviderFees: "Your Practably subscription is billed via Stripe. How you charge your own clients is your own arrangement; Practably does not process, hold, or take any share of payments between you and your clients.",
  cancellationTerms: "You can cancel or downgrade a paid plan from Manage billing in Settings. Normal cancellation stops renewal at the end of the paid billing period. If your client count exceeds the resulting plan limit, existing data is retained but you cannot add clients until you are within the limit. Unused portions of a billing period are not automatically refunded.",
  refundTerms: "You can request a full refund of your first subscription payment within 24 hours of successful payment using Cancel and refund in Settings. This immediately cancels your subscription and returns your account to Free without deleting your client data. Renewals and repeat subscriptions are not covered. Additional payments or existing unrelated refund requests require support review. Refunds go to the original payment method and may take several days to appear, depending on your bank. This voluntary guarantee does not affect your statutory rights.",
  retentionPolicy: "Account deletion removes your account and client records from the active application database after any subscription cancellation is confirmed. Export records you need before deleting. Provider-held records and infrastructure backups are not removed by the same operation; applicable retention periods and backup deletion arrangements must be confirmed before public launch. Setting a retention period in Settings does not currently schedule automatic deletion.",
  subprocessors: "Replit provides hosting, and Supabase provides email, Google and Apple authentication. Replit sign-in remains available to securely connect existing accounts. PostgreSQL is database software, not a separate processor company. Brevo sends requested emails, and Stripe handles Practably subscription billing. The operator must verify the actual database provider, locations, contractual terms and transfers before public launch.",
  paidPlanSupportResponse: "We aim to reply within 4 hours. Messages sent after 8pm GMT are answered the next morning.",
};

export type PublicSection = { heading: string; paragraphs: string[] };
export const privacySections: PublicSection[] = [
  { heading: "What data Practably handles", paragraphs: ["The service stores coach account details, business and contact details, client names and contact details, bookings, notes, invoices, packages, custom form templates, and client form responses, including optional PAR-Q or other health information that coaches choose to collect."] },
  { heading: "Private client form links", paragraphs: ["Coaches can share a time-limited, single-submission link for a selected form. Anyone with the link can submit it; this is not identity verification or an electronic signature. The link does not give access to the client's profile or previously submitted answers. Share links directly rather than posting them publicly."] },
  { heading: "Why data is used", paragraphs: ["Data is used to provide the dashboard, organise coaching work, send requested emails, create invoices, and keep the service secure. Do not enter information you do not need for your coaching workflow."] },
  { heading: "Controller and processor responsibilities", paragraphs: ["The intended arrangement is that coaches control their client information and Practably processes it on their instructions. Practably is responsible for its own account, subscription, security and support administration."] },
  { heading: "Health and PARQ information", paragraphs: ["PARQ responses can contain special-category health data. Practably does not assess medical suitability or provide medical advice. An appropriate lawful basis and applicable special-category condition are needed before collecting real health information."] },
  { heading: "Payments", paragraphs: [publicSite.paymentProviderFees] },
  { heading: "Processors and international transfers", paragraphs: [publicSite.subprocessors, "Exact hosting and email-processing locations, signed or applicable data-processing terms, international-transfer mechanisms and backup arrangements have not yet been verified. This remains a public-launch blocker, not a claim of completed compliance."] },
  { heading: "Retention, export, and deletion", paragraphs: ["Coaches can export an individual client record from the client profile.", publicSite.retentionPolicy] },
  { heading: "Your choices and rights", paragraphs: [`Requests about access, correction, export, deletion, restrictions, objections or other data rights can be sent to ${publicSite.supportEmail}. Requests concerning a coach's client data should also be directed to that coach.`] },
  { heading: "Cookies and security", paragraphs: ["Practably uses an essential login session cookie with HttpOnly, Secure and SameSite=Lax attributes. Hosting infrastructure may also set routing cookies; these are separate from the application's session cookie. Practably does not add advertising cookies. Product usage records exclude PARQ answers and health responses. Hosting-cookie purposes and attributes must be confirmed with the provider."] },
  { heading: "Contact", paragraphs: [`Privacy contact: ${publicSite.supportEmail}. Responsible operator: ${publicSite.legalOperator}. Contact address: ${publicSite.contactAddress}.`] },
];
export const termsSections: PublicSection[] = [
  { heading: "Using Practably", paragraphs: ["Practably provides software tools for independent coaches to manage client records, calendars, sessions, forms, invoices and payment records. You are responsible for your account, the information you enter and your use of client data."] },
  { heading: "Acceptable use", paragraphs: ["Use the service lawfully, respect client privacy, keep sign-in details secure, and do not interfere with the service or use it to provide medical, legal or financial advice."] },
  { heading: "Subscriptions and billing", paragraphs: [`The Free plan supports up to five clients. Paid plans are billed monthly. ${publicSite.vatTreatment} ${publicSite.paymentProviderFees}`] },
  { heading: "24-hour first-payment refund guarantee", paragraphs: [publicSite.refundTerms] },
  { heading: "Cancellation and data", paragraphs: [publicSite.cancellationTerms, publicSite.retentionPolicy] },
  { heading: "Intellectual property and liability", paragraphs: [`Practably is operated by ${publicSite.legalOperator}. The service is provided "as is" without warranty of any kind, and the operator's liability is limited to the amount you have paid in the three months before a claim. Nothing limits liability that cannot be limited by law, including fraud or death or personal injury caused by negligence.`] },
  { heading: "Contact", paragraphs: [`Questions about these terms: ${publicSite.supportEmail}. Contact address: ${publicSite.contactAddress}. Governing law: ${publicSite.governingLaw}.`] },
];

export const publicMetadata: Record<string, { title: string; description: string }> = {
  "/": { title: "Practably | Business Software for Independent Coaches", description: "Manage clients, calendars, sessions, forms, invoices and payment records in one dashboard. Start with a five-client Free plan." },
  "/pricing": { title: "Pricing | Practably", description: "Compare Free, Starter (£1.99), Professional (£4.99) and Business (£7.99) monthly coaching software plans." },
  "/privacy": { title: "Privacy | Practably", description: "How Practably handles account, client and health-form information, processors, cookies, data rights and deletion." },
  "/terms": { title: "Terms of Use | Practably", description: "Practably subscription terms, cancellation, client data and the 24-hour first-payment refund guarantee." },
  "/support": { title: "Support | Practably", description: "Contact Practably for help with account access, bookings, invoices and payment records." },
  "/blog": { title: "Blog | Practably", description: "Practical guides for independent coaches managing clients, scheduling and coaching administration." },
};

export function publicPlansFromConfig(config: Partial<import("./schema").PlatformConfig> = {}) {
  return [
    { name: "free", label: "Free", max: config.tier1MaxClients ?? 5, price: config.tier1Price ?? "0" },
    { name: "starter", label: "Starter", max: config.tier2MaxClients ?? 10, price: config.tier2Price ?? "1.99" },
    { name: "professional", label: "Professional", max: config.tier3MaxClients ?? 20, price: config.tier3Price ?? "4.99" },
    { name: "business", label: "Business", max: config.tier4MaxClients ?? 50, price: config.tier4Price ?? "7.99" },
  ];
}