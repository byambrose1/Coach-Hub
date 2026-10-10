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
export function emailNotificationFeedback(payload: unknown, operation: string, emailPurpose: string): ToastFeedback {
  const results = notificationResults(payload);
  const sent = results.filter(result => result.status === "sent").length;
  const skipped = results.filter(result => result.status !== "sent");
  const reasons = Array.from(new Set(skipped.map(result => result.message)));
  const acceptedMessage = `${sent} client email${sent === 1 ? "" : "s"} for ${emailPurpose} ${sent === 1 ? "was" : "were"} accepted for sending. Inbox delivery is not yet confirmed.`;

  if (sent > 0 && skipped.length === 0) {
    return {
      title: `${operation} saved`,
      description: acceptedMessage,
    };
  }
  if (results.length === 0) {
    return { title: `${operation} saved`, description: "The change was saved." };
  }
  return {
    title: `${operation} saved`,
    description: [
      sent > 0 ? acceptedMessage : "",
      reasons.length ? reasons.join(" ") : "",
    ].filter(Boolean).join(" "),
  };
}

