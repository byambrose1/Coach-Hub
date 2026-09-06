---
name: Whop SDK client API
description: Records the installed Whop SDK constructor shape that differs from older integration examples.
---

Use the named `WhopClient` export and initialize it with the bearer `token` option. Do not use a default `Whop` export or an `apiKey` constructor option.

**Why:** The integration reference targeted an older package shape; the current SDK exposed `Whop` as a namespace, causing the post-merge TypeScript check to fail.

**How to apply:** When touching the Whop server client or upgrading the SDK, inspect the installed declarations and keep the constructor aligned with the package’s actual exports.