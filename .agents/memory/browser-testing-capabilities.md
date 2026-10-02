---
name: Browser testing capabilities
description: Environment-specific mismatch between the documented testing helper and available callbacks.
---
The documented testing subagent configuration was rejected as an unknown kind in this environment on 2026-10-02. This is a capability mismatch, not evidence that the application is broken.

**Why:** A billing UI verification request could not launch through the documented helper, while Chromium and the installed WebSocket package supported a successful independent browser check.

**How to apply:** Re-evaluate available capabilities rather than assuming the documented helper always exists. If it is unavailable, use an isolated Chromium/CDP check. For financial simulations, intercept all API requests before navigation so test clicks cannot reach live billing or mutate customer data. Describe simulated authentication and billing honestly; they do not verify a real signed-in live-payment flow.