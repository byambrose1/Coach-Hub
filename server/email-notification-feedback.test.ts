import assert from "node:assert/strict";
import { test } from "node:test";
import { emailNotificationFeedback } from "../client/src/lib/email-notification-feedback";

test("client email feedback names the purpose and says the provider accepted it for sending", () => {
  const feedback = emailNotificationFeedback({
    emailNotifications: [{ kind: "booking", status: "sent", message: "Email accepted for sending." }],
  }, "Session booking", "session booking");

  assert.equal(feedback.title, "Session booking saved");
  assert.equal(
    feedback.description,
    "1 client email for session booking was accepted for sending. Inbox delivery is not yet confirmed.",
  );
  assert.doesNotMatch(feedback.description, /successfully sent|delivered/i);
});

test("mixed notification feedback describes accepted emails and skipped reasons", () => {
  const feedback = emailNotificationFeedback({
    emailNotifications: [
      { kind: "booking", status: "sent", message: "Email accepted for sending." },
      { kind: "low_sessions", status: "missing_email", message: "Email not sent: the client has no email address." },
    ],
  }, "Session booking", "session booking");

  assert.match(feedback.description, /1 client email for session booking was accepted for sending/);
  assert.match(feedback.description, /Inbox delivery is not yet confirmed/);
  assert.match(feedback.description, /client has no email address/);
});

test("multiple client emails use plural grammar and retain their purpose", () => {
  const feedback = emailNotificationFeedback({
    emailNotifications: [
      { kind: "booking", status: "sent", message: "Email accepted for sending." },
      { kind: "booking", status: "sent", message: "Email accepted for sending." },
    ],
  }, "Session booking", "session booking");

  assert.match(feedback.description, /2 client emails for session booking were accepted for sending/);
});
