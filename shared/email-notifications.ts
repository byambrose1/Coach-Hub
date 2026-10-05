import type { PlanName } from "./subscription-features";

export const FREE_WEEKLY_NOTIFICATION_LIMIT = 10;
export const LOW_SESSION_EMAIL_THRESHOLD = 3;
export type EmailNotificationResult = {
  kind: string;
  status: "sent" | "disabled" | "missing_email" | "limit_reached" | "failed";
  message: string;
};
export type NotificationUsage = {
  plan: PlanName;
  enabled: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetsAt: string;
};
