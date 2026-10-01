---
name: Subscription provider choice
description: Owner-approved provider and account boundary for Practably coach subscriptions.
---
Use the owner's existing live Stripe account for Practably coach subscriptions. Do not switch providers or provision a separate sandbox merely because another billing integration appears in the workspace.

**Why:** The owner explicitly selected the current live account after being told that Practably plans would coexist with the account's existing fitness-coaching products. They want real coach upgrade payments, not a test-only demonstration.

**How to apply:** Preserve the existing Stripe connection when improving billing. Ask before changing the provider/account. Practably subscriptions and payments collected by coaches from their clients are different flows.

Scope Practably checkout branding to this app rather than changing the shared account's identity. Obtain explicit approval before changing account-wide names, logos, or payment descriptors.

**Why:** Existing fitness-coaching products coexist with Practably in the selected account. Fixing Practably's checkout appearance should not unexpectedly rebrand unrelated sales, invoices, or receipts.

**How to apply:** Treat checkout appearance and account-wide invoice/portal identity as distinct scopes. Explain the wider effect before making account-level branding changes.