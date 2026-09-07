---
name: Logging guard approvals
description: Principle for safely extending the repository's static server logging policy.
---

Server console logging is default-deny for dynamic values. Any exception must match a narrowly defined safe expression; never exempt an entire logger function or file.

**Why:** Broad name- or location-based exemptions let later edits add raw errors, request bodies, or customer fields inside a trusted logger without failing validation.

**How to apply:** When an approved metadata log must change, extend the structural matcher only as narrowly as needed and add tests proving both the intended expression and unsafe neighboring statements are handled correctly.