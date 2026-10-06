import { createHash } from "node:crypto";
import type { Session, Settings } from "@shared/schema";
import { createEmailNotifications } from "./email-notifications";
import { sendSessionReminderEmail } from "./email";
import { pool } from "./db";
import { storage as defaultStorage, type IStorage } from "./storage";
import { logError } from "./safe-logging";

const SCHEDULER_INTERVAL_MS = 60_000;
const DEFAULT_TIMEZONE = "Europe/London";
const MAX_REMINDER_HOURS = 168;

type SessionReminderStorage = Pick<IStorage, "getAllUsers" | "getSettings" | "getSessions" | "getClient">;
type NotificationService = Pick<ReturnType<typeof createEmailNotifications>, "send">;
type ReminderSession = Pick<Session, "id" | "clientId" | "date" | "startTime" | "status" | "sessionType">;

export type SessionReminderDependencies = {
  storage: SessionReminderStorage;
  notifications: NotificationService;
  claim: (userId: string, session: ReminderSession, key: string) => Promise<boolean>;
  deliver: typeof sendSessionReminderEmail;
  now: () => Date;
};

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function localParts(formatter: Intl.DateTimeFormat, instant: number) {
  const values = Object.fromEntries(
    formatter.formatToParts(new Date(instant))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Converts a coach-local calendar date/time to UTC, including DST boundaries. */
export function sessionStartUtc(date: string, time: string, timeZone: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) return undefined;

  const target = { year, month, day, hour, minute, second: 0 };
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  try {
    const formatter = formatterFor(timeZone);
    let candidate = targetAsUtc;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const local = localParts(formatter, candidate);
      const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
      const adjustment = targetAsUtc - localAsUtc;
      candidate += adjustment;
      if (adjustment === 0) break;
    }
    const actual = localParts(formatter, candidate);
    return Object.keys(target).every(key => actual[key as keyof typeof actual] === target[key as keyof typeof target])
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

function reminderKey(session: ReminderSession, hoursBefore: number): string {
  return createHash("sha256")
    .update(`${session.clientId}\0${session.date}\0${session.startTime}\0${hoursBefore}`)
    .digest("hex");
}

/**
 * Atomically records one attempt per session schedule. A definite or ambiguous
 * provider failure is not retried automatically, avoiding duplicate emails.
 */
export async function claimSessionReminder(
  userId: string,
  session: ReminderSession,
  key: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE training_sessions
       SET reminder_sent_key = $1
     WHERE id = $2
       AND user_id = $3
       AND client_id = $4
       AND date = $5
       AND start_time = $6
       AND status = 'scheduled'
       AND session_type IS DISTINCT FROM 'blocked'
       AND reminder_sent_key IS DISTINCT FROM $1
     RETURNING id`,
    [key, session.id, userId, session.clientId, session.date, session.startTime],
  );
  return result.rowCount === 1;
}

export function createSessionReminderRunner(dependencies: SessionReminderDependencies) {
  let running = false;

  return async () => {
    if (running) return { attempted: 0, sent: 0, failed: 0 };
    running = true;
    const summary = { attempted: 0, sent: 0, failed: 0 };
    try {
      const now = dependencies.now().getTime();
      const accounts = await dependencies.storage.getAllUsers();
      for (const account of accounts) {
        let settings: Settings | undefined;
        let sessions: Session[];
        try {
          settings = await dependencies.storage.getSettings(account.id);
          if (!settings?.enableSessionReminders || !settings.enableEmailNotifications) continue;
          sessions = await dependencies.storage.getSessions(account.id);
        } catch (error) {
          logError("Scheduled session reminders could not load coach data", error);
          continue;
        }

        const hoursBefore = settings.reminderHoursBefore ?? 24;
        if (!Number.isInteger(hoursBefore) || hoursBefore < 1 || hoursBefore > MAX_REMINDER_HOURS) {
          logError("Scheduled session reminder interval is invalid", new Error("Invalid reminder interval"));
          continue;
        }
        const timeZone = settings.timezone || DEFAULT_TIMEZONE;
        for (const session of sessions) {
          if (session.status !== "scheduled" || session.sessionType === "blocked" || !session.clientId) continue;
          const startsAt = sessionStartUtc(session.date, session.startTime, timeZone);
          if (startsAt === undefined || startsAt <= now || startsAt - hoursBefore * 60 * 60 * 1000 > now) continue;

          try {
            const client = await dependencies.storage.getClient(account.id, session.clientId);
            if (!client?.email?.trim()) continue;
            const key = reminderKey(session, hoursBefore);
            if (!await dependencies.claim(account.id, session, key)) continue;

            summary.attempted += 1;
            const result = await dependencies.notifications.send({
              userId: account.id,
              settings,
              clientEmail: client.email,
              kind: "session_reminder",
              deliver: () => dependencies.deliver({
                clientName: client.name,
                clientEmail: client.email!,
                sessionDate: session.date,
                sessionTime: session.startTime,
                trainerName: settings?.trainerName || "Your Coach",
                businessName: settings?.businessName || undefined,
                trainerEmail: settings?.trainerEmail || undefined,
              }),
            });
            if (result.status === "sent") summary.sent += 1;
            else if (result.status === "failed") summary.failed += 1;
          } catch (error) {
            logError("Scheduled session reminder could not be sent", error);
            summary.failed += 1;
          }
        }
      }
    } catch (error) {
      logError("Scheduled session reminder scan failed", error);
    } finally {
      running = false;
    }
    return summary;
  };
}

export function startSessionReminderScheduler(): () => void {
  const runner = createSessionReminderRunner({
    storage: defaultStorage,
    notifications: createEmailNotifications(),
    claim: claimSessionReminder,
    deliver: sendSessionReminderEmail,
    now: () => new Date(),
  });
  const tick = () => {
    void runner().catch(error => logError("Scheduled session reminder scan failed", error));
  };
  tick();
  const timer = setInterval(tick, SCHEDULER_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
