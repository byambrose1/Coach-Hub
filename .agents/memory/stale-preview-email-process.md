---
name: Stale Preview email process
description: Why transactional logs can show an old sender after email code changes
---

Preview can keep sending email with an old server-side implementation even when the workspace source and published build have moved on. Frontend hot updates do not prove the server process reloaded.

**Why:** A long-running Preview server continued sending booking notifications using the previous coach-address sender logic after the source had switched to a platform sender. Provider logs faithfully reflected those sends, making the configured secret appear ineffective.

**How to apply:** For sender discrepancies, correlate the Preview server's startup time and notification logs with the server-side change time. Restart the managed workflow after server email or environment changes, then evaluate a fresh send rather than relying on earlier provider events.