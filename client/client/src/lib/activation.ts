export type ActivationEvent =
  | "signup_started"
  | "signup_completed"
  | "first_client_created"
  | "first_booking_created"
  | "first_parq_form_sent"
  | "first_invoice_created"
  | "first_payment_initiated";

export function trackActivationEvent(event: ActivationEvent) {
  if (typeof window === "undefined") return;
  void fetch("/api/activation-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {
    // Activation tracking is intentionally non-blocking and never affects product workflows.
  });
}