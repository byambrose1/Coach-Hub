import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session, Settings } from "@shared/schema";
import { createEmailNotifications } from "./email-notifications";
import { createSessionReminderRunner, sessionStartUtc, type SessionReminderDependencies } from "./session-reminders";

const now = new Date("2026-10-06T09:00:00.000Z");

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    userId: "coach-1",
    clientId: "client-1",
    title: "Coaching session",
    date: "2026-10-07",
    startTime: "10:00",
    endTime: "11:00",
    sessionType: "1:1",
    location: null,
    status: "scheduled",
    notes: null,
    reminderSentKey: null,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: "settings-1",
    userId: "coach-1",
    enableEmailNotifications: true,
    enableSessionReminders: true,
    reminderHoursBefore: 24,
    timezone: "Europe/London",
    subscriptionPlan: "free",
    ...overrides,
  } as Settings;
}

function makeDependencies(
  sessions: Session[],
  settings: Settings,
  overrides: Partial<SessionReminderDependencies> = {},
) {
  const claimed = new Map<string, string>();
  const sent: Array<{ clientName: string; sessionDate: string; sessionTime: string }> = [];
  const dependencies: SessionReminderDependencies = {
    storage: {
      getAllUsers: async () => [{ id: "coach-1" }] as any,
      getSettings: async () => settings,
      getSessions: async () => sessions,
      getClient: async (_userId, id) => id === "client-1"
        ? { id, name: "Client", email: "client@example.test" } as any
        : undefined,
    },
    notifications: {
      send: async input => {
        await input.deliver();
        return { kind: input.kind, status: "sent", message: "accepted" };
      },
    },
    claim: async (_userId, session, key) => {
      if (claimed.get(session.id) === key) return false;
      claimed.set(session.id, key);
      return true;
    },
    deliver: async ({ clientName, sessionDate, sessionTime }) => {
      sent.push({ clientName, sessionDate, sessionTime });
    },
    now: () => now,
    ...overrides,
  };
  return { dependencies, sent };
}

test("session local date/time conversion handles standard time, daylight time, and missing DST times", () => {
  assert.equal(sessionStartUtc("2026-01-15", "09:30", "Europe/London"), Date.parse("2026-01-15T09:30:00Z"));
  assert.equal(sessionStartUtc("2026-07-15", "09:30", "Europe/London"), Date.parse("2026-07-15T08:30:00Z"));
  assert.equal(sessionStartUtc("2026-03-29", "01:30", "Europe/London"), undefined);
  assert.equal(sessionStartUtc("2026-02-30", "09:30", "Europe/London"), undefined);
  assert.equal(sessionStartUtc("2026-10-07", "09:30", "Not/A-Timezone"), undefined);
});

test("due reminders are sent once per schedule and a reschedule gets a fresh attempt", async () => {
  const sessions = [makeSession()];
  const { dependencies, sent } = makeDependencies(sessions, makeSettings());
  const run = createSessionReminderRunner(dependencies);

  assert.deepEqual(await run(), { attempted: 1, sent: 1, failed: 0 });
  assert.deepEqual(await run(), { attempted: 0, sent: 0, failed: 0 });
  sessions[0] = makeSession({ startTime: "09:00" });
  assert.deepEqual(await run(), { attempted: 1, sent: 1, failed: 0 });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].sessionTime, "09:00");
});

test("disabled, cancelled, and blocked sessions do not send reminders", async () => {
  const sessions = [
    makeSession({ id: "cancelled", status: "cancelled" }),
    makeSession({ id: "blocked", clientId: "__blocked__", sessionType: "blocked" }),
  ];
  const { dependencies, sent } = makeDependencies(sessions, makeSettings());
  const run = createSessionReminderRunner(dependencies);
  assert.deepEqual(await run(), { attempted: 0, sent: 0, failed: 0 });
  assert.equal(sent.length, 0);

  const disabled = makeDependencies([makeSession()], makeSettings({ enableSessionReminders: false }));
  assert.deepEqual(await createSessionReminderRunner(disabled.dependencies)(), { attempted: 0, sent: 0, failed: 0 });
});

test("reminders use the same Free weekly notification allowance as other client emails", async () => {
  let sends = 0;
  const budget = {
    used: async () => 10,
    reserve: async () => false,
    releaseRejected: async () => {},
  };
  const { dependencies } = makeDependencies([makeSession()], makeSettings(), {
    notifications: createEmailNotifications(budget, () => now),
    deliver: async () => { sends += 1; },
  });
  const result = await createSessionReminderRunner(dependencies)();
  assert.equal(result.attempted, 1);
  assert.equal(result.sent, 0);
  assert.equal(sends, 0);
});
