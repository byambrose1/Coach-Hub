---
name: Browser testing capabilities
description: Environment-specific mismatch between the documented testing helper and available callbacks.
---
The documented testing subagent configuration was rejected as an unknown kind in this environment on 2026-10-02. This is a capability mismatch, not evidence that the application is broken.

**Why:** A billing UI verification request could not launch through the documented helper, while Chromium and the installed WebSocket package supported a successful independent browser check.

**How to apply:** Re-evaluate available capabilities rather than assuming the documented helper always exists. If it is unavailable, use an isolated Chromium/CDP check. For financial simulations, intercept all API requests before navigation so test clicks cannot reach live billing or mutate customer data. Describe simulated authentication and billing honestly; they do not verify a real signed-in live-payment flow.

API-intercepted browser checks still depend on a stable development server for HTML and JavaScript assets.

**Why:** Restarting the workflow during a PDF-download check interrupted a dynamically loaded module and produced a false download failure; the same check passed once the server was stable.

**How to apply:** Finish workflow restarts before running browser checks. Also distinguish a newly rendered record from an interactable control: dialog-closing animations and smooth scrolling can intercept or misdirect immediate clicks.

Assert the resulting control state, not merely that a synthetic click ran.

**Why:** Radix tabs and selects may react to focus, pointer or keyboard events rather than a bare DOM click, causing false failures in isolated browser tests.

**How to apply:** Use browser-native interactions or the events the control actually handles, then wait for the selected tab, open options or completed mutation. Do not rewrite working app controls to accommodate an incomplete test interaction.