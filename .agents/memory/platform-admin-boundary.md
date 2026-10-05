---
name: Platform administration boundary
description: Owner's account-management scope and delegated administrator expectations.
---
The owner wants `/admin` to be Practably platform account management: overview of coaches, names, emails, businesses, and support for account issues. Ordinary coaches' own practice statistics are separate.

**Why:** On 2026-10-05 the owner clarified that a coach-facing practice page was not the administrator account-management area they needed.

**How to apply:** Preserve server-side authorization even when links are hidden. Only the confirmed owner can grant or revoke delegated account-manager access. Never make the first signed-in account an owner or widen access merely to resolve a missing menu.

Delegated account managers support coach accounts; owner authority over staff, platform pricing and billing-plan overrides remains separate.

**Why:** Granting account-support access should not silently grant financial or staff-management authority.

**How to apply:** Explain delegated permissions when granting access and ensure revocation ends an already-active support view as well as access to admin APIs.
