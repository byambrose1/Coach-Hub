---
name: Scheduled reminder policy
description: Consent, quota, and retry rules for automated session reminder email.
---

Scheduled client reminders must respect both the coach's session-reminder preference and the main client-email opt-in. They use the same Free-plan weekly notification allowance as other client emails. Attempt each session schedule at most once; do not automatically retry a provider timeout or ambiguous failure.

**Why:** Client messages must not override coach preferences or bypass the shared quota. A provider may accept an email even when its response is lost, so retries can create duplicates.

**How to apply:** For future scheduled-email work, use the existing notification-budget path and durable per-schedule deduplication. Keep provider tests mocked unless the user explicitly authorizes a real inbox test.
