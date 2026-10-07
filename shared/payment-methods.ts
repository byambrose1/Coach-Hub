import type { Settings } from "./schema";

export type PaymentMethodInfo = { key: string; label: string; detail?: string; link?: string };

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

// Matches the invoice.paymentMethod values set on the invoice form
// (cash/card_machine/bank_transfer/paypal/stripe/other).
const METHOD_KEYS: Record<string, true> = {
  cash: true, card_machine: true, bank_transfer: true, paypal: true, stripe: true, other: true,
};

// The methods a coach has switched on in Settings, in a fixed display order.
// Every one of these is the coach's own arrangement (their own bank details,
// their own PayPal/Stripe link) - Practably never touches or processes any
// of it, it just displays what the coach has told us they accept.
export function getPaymentMethods(settings: PaymentMethodSettings | undefined | null): PaymentMethodInfo[] {
  if (!settings) return [];
  const methods: PaymentMethodInfo[] = [];
  if (settings.acceptsCash) methods.push({ key: "cash", label: "Cash" });
  if (settings.acceptsCardMachine) methods.push({ key: "card_machine", label: "Card (in person)" });
  if (settings.acceptsBankTransfer) {
    methods.push({ key: "bank_transfer", label: "Bank transfer", detail: settings.bankTransferDetails || undefined });
  }
  if (settings.acceptsPaypal && settings.paypalLink) {
    methods.push({ key: "paypal", label: "PayPal", link: settings.paypalLink });
  }
  if (settings.acceptsStripeLink && settings.stripePaymentLink) {
    methods.push({ key: "stripe", label: "Card (Stripe)", link: settings.stripePaymentLink });
  }
  if (settings.acceptsOtherPayment) {
    methods.push({ key: "other", label: "Other", detail: settings.otherPaymentDetails || undefined });
  }
  return methods;
}

// When an invoice has a specific payment method chosen, show only that one -
// not every method the coach has ever switched on in Settings. Falls back to
// showing everything enabled if the invoice has no method set ("no payment
// specified"), or if the one it names isn't actually configured in Settings.
export function getInvoicePaymentMethods(
  settings: PaymentMethodSettings | undefined | null,
  invoicePaymentMethod?: string | null,
): PaymentMethodInfo[] {
  const all = getPaymentMethods(settings);
  if (!invoicePaymentMethod || !METHOD_KEYS[invoicePaymentMethod]) return all;
  const selected = all.filter((m) => m.key === invoicePaymentMethod);
  return selected.length ? selected : all;
}

export function paymentMethodsHtml(
  settings: PaymentMethodSettings | undefined | null,
  invoicePaymentMethod?: string | null,
): string {
  const methods = getInvoicePaymentMethods(settings, invoicePaymentMethod);
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
