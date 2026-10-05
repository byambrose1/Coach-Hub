import { and, eq, lt, sql } from "drizzle-orm";
import { emailNotificationUsage } from "@shared/schema";
import { FREE_WEEKLY_NOTIFICATION_LIMIT } from "@shared/email-notifications";
import { db } from "./db";

export interface NotificationBudgetStore {
  used(userId: string, weekStart: string): Promise<number>;
  reserve(userId: string, weekStart: string): Promise<boolean>;
  releaseRejected(userId: string, weekStart: string): Promise<void>;
}
export function createNotificationBudgetStore(database = db): NotificationBudgetStore {
  return {
    async used(userId, weekStart) {
      const [row] = await database.select({ used: emailNotificationUsage.usedCount }).from(emailNotificationUsage)
        .where(and(eq(emailNotificationUsage.userId, userId), eq(emailNotificationUsage.weekStart, weekStart)));
      return row?.used || 0;
    },
    async reserve(userId, weekStart) {
      // One atomic upsert across processes: parallel sends cannot reserve
      // more than the Free allowance. The client never supplies a limit.
      const rows = await database.insert(emailNotificationUsage).values({ userId, weekStart, usedCount: 1 })
        .onConflictDoUpdate({
          target: [emailNotificationUsage.userId, emailNotificationUsage.weekStart],
          set: { usedCount: sql`${emailNotificationUsage.usedCount} + 1` },
          setWhere: lt(emailNotificationUsage.usedCount, FREE_WEEKLY_NOTIFICATION_LIMIT),
        }).returning({ used: emailNotificationUsage.usedCount });
      return rows.length === 1;
    },
    async releaseRejected(userId, weekStart) {
      await database.update(emailNotificationUsage).set({ usedCount: sql`greatest(${emailNotificationUsage.usedCount} - 1, 0)` })
        .where(and(eq(emailNotificationUsage.userId, userId), eq(emailNotificationUsage.weekStart, weekStart)));
    },
  };
}
export const notificationBudgetStore = createNotificationBudgetStore();
