import type { Settings } from "./schema";

export type PaymentMethodInfo = { label: string; detail?: string; link?: string };

type PaymentMethodSettings = Pick<
  Settings,
  | "acceptsCash"
  | "acceptsCardMachine"
  | "acceptsBankTransfer"
  | "bankTransferDetails"
  | "acceptsPaypal"
  | "paypalLink"
  | "acceptsStripeLink"
  | "stripePaymentLink"
  | "acceptsOtherPayment"
  | "otherPaymentDetails"
>;

// The methods a coach has switched on in Settings, in a fixed display order.
// Every one of these is the coach's own arrangement (their own bank details,
// their own PayPal/Stripe link) - Practably never touches or processes any
// of it, it just displays what the coach has told us they accept.
export function getPaymentMethods(settings: PaymentMethodSettings | undefined | null): PaymentMethodInfo[] {
  if (!settings) return [];
  const methods: PaymentMethodInfo[] = [];
  if (settings.acceptsCash) methods.push({ label: "Cash" });
  if (settings.acceptsCardMachine) methods.push({ label: "Card (in person)" });
  if (settings.acceptsBankTransfer) {
    methods.push({ label: "Bank transfer", detail: settings.bankTransferDetails || undefined });
  }
  if (settings.acceptsPaypal && settings.paypalLink) {
    methods.push({ label: "PayPal", link: settings.paypalLink });
  }
  if (settings.acceptsStripeLink && settings.stripePaymentLink) {
    methods.push({ label: "Card (Stripe)", link: settings.stripePaymentLink });
  }
  if (settings.acceptsOtherPayment) {
    methods.push({ label: "Other", detail: settings.otherPaymentDetails || undefined });
  }
  return methods;
}

export function paymentMethodsHtml(settings: PaymentMethodSettings | undefined | null): string {
  const methods = getPaymentMethods(settings);
  if (methods.length === 0) return "";
  const rows = methods
    .map((m) => {
      const parts = [m.label];
      if (m.detail) parts.push(m.detail);
      const linkHtml = m.link ? ` — <a href="${m.link}" style="color:#2563eb;">${m.link}</a>` : "";
      return `<p style="margin:2px 0;font-size:14px;">${parts.join(": ")}${linkHtml}</p>`;
    })
    .join("");
  return `<div style="margin-top:20px;"><h4 style="margin:0 0 5px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Ways to pay</h4>${rows}</div>`;
}
