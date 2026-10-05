import type { EmailNotificationResult } from "@shared/email-notifications";

type ToastFeedback = {
  title: string;
  description: string;
  variant?: "default" | "destructive";
};

function notificationResults(payload: unknown): EmailNotificationResult[] {
  if (!payload || typeof payload !== "object" || !("emailNotifications" in payload)) return [];
  const value = (payload as { emailNotifications?: unknown }).emailNotifications;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is EmailNotificationResult =>
    !!item && typeof item === "object"
    && typeof item.kind === "string"
    && ["sent", "disabled", "missing_email", "limit_reached", "failed"].includes(item.status)
    && typeof item.message === "string",
  );
}

/** “sent” means accepted by the mail provider, never proof of delivery. */
export function emailNotificationFeedback(payload: unknown, operation: string): ToastFeedback {
  const results = notificationResults(payload);
  const sent = results.filter(result => result.status === "sent").length;
  const skipped = results.filter(result => result.status !== "sent");
  const reasons = Array.from(new Set(skipped.map(result => result.message)));

  if (sent > 0 && skipped.length === 0) {
    return {
      title: `${operation} saved`,
      description: `${sent} client email${sent === 1 ? " was" : "s were"} accepted for sending.`,
    };
  }
  if (results.length === 0) {
    return { title: `${operation} saved`, description: "The change was saved." };
  }
  return {
    title: `${operation} saved`,
    description: [
      sent > 0 ? `${sent} client email${sent === 1 ? " was" : "s were"} accepted for sending.` : "",
      reasons.length ? reasons.join(" ") : "",
    ].filter(Boolean).join(" "),
  };
}

