---
name: Whop connection permission updates
description: Whop API permission changes require replacing the attached Replit API key before the connector sees the new access.
---

Whop permission changes are not reliable until the newly scoped API key is regenerated or replaced in the attached Replit connection; an existing key can continue returning `company:basic:read` authorization failures.

**Why:** A connection remained healthy while Whop continued rejecting company discovery after a dashboard permission was selected.

**How to apply:** After changing Whop API key permissions, replace the key in the existing Replit connection and verify `list_companies` before creating products, checkouts, payments, or membership lookups.