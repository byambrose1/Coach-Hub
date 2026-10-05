import type { Settings } from "@shared/schema";
import { getPlan } from "@shared/subscription-features";
import { FREE_WEEKLY_NOTIFICATION_LIMIT, type EmailNotificationResult, type NotificationUsage } from "@shared/email-notifications";
import { notificationBudgetStore, type NotificationBudgetStore } from "./email-notification-budget";
import { logError } from "./safe-logging";

export function notificationWeek(now = new Date()) {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const next = new Date(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  return { weekStart: monday.toISOString().slice(0, 10), resetsAt: next.toISOString() };
}
export function createEmailNotifications(budget: NotificationBudgetStore = notificationBudgetStore, now = () => new Date()) {
  return {
    async usage(userId: string, settings: Settings | undefined): Promise<NotificationUsage> {
      const plan = getPlan(settings);
      const { weekStart, resetsAt } = notificationWeek(now());
      const used = plan === "free" ? await budget.used(userId, weekStart) : 0;
      const limit = plan === "free" ? FREE_WEEKLY_NOTIFICATION_LIMIT : null;
      return { plan, enabled: !!settings?.enableEmailNotifications, limit, used,
        remaining: limit === null ? null : Math.max(0, limit - used), resetsAt };
    },
    async send(input: {
      userId: string; settings: Settings | undefined; clientEmail: string | null | undefined;
      kind: string; deliver: () => Promise<void>; manual?: boolean;
    }): Promise<EmailNotificationResult> {
      const result = (status: EmailNotificationResult["status"], message: string): EmailNotificationResult =>
        ({ kind: input.kind, status, message });
      if (!input.clientEmail?.trim()) return result("missing_email", "Email not sent: the client has no email address.");
      if (!input.manual && !input.settings?.enableEmailNotifications) {
        return result("disabled", "Email not sent: automatic client email notifications are switched off in Settings.");
      }
      const { weekStart } = notificationWeek(now());
      const limited = getPlan(input.settings) === "free";
      if (limited) {
        try {
          if (!await budget.reserve(input.userId, weekStart)) {
            return result("limit_reached", "Email not sent: the Free allowance of 10 notifications this week has been reached. It resets Monday at 00:00 UTC.");
          }
        } catch (error) {
          logError("Notification allowance could not be checked", error);
          return result("failed", "Email not sent: your weekly allowance could not be checked. The session or record has still been saved.");
        }
      }
      try {
        await input.deliver();
        return result("sent", "Email accepted for sending. Inbox delivery is not yet confirmed.");
      } catch (error) {
        logError("Client notification provider did not confirm sending", error);
        const status = Number((error as { statusCode?: number; status?: number })?.statusCode ||
          (error as { status?: number })?.status);
        // A definite 4xx rejection did not send an email. Network failures,
        // timeouts and 5xx responses may have accepted it: retain the slot
        // and never retry automatically, to avoid duplicates or cap bypass.
        if (limited && status >= 400 && status < 500 && status !== 408) {
          try { await budget.releaseRejected(input.userId, weekStart); }
          catch (budgetError) { logError("Rejected email allowance could not be released", budgetError); }
        }
        return result("failed", "The email provider did not confirm sending. The session or record is saved; no automatic retry was made.");
      }
    },
  };
}

export function notificationHttpStatus(result: EmailNotificationResult): number {
  if (result.status === "sent") return 200;
  if (result.status === "limit_reached") return 429;
  if (result.status === "missing_email" || result.status === "disabled") return 400;
  return 502;
}
