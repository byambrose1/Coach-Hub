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

Treat webhook configuration, local processing tests, and real Stripe delivery as separate verification steps. An enabled endpoint or a configured marker is not evidence that the endpoint's signing secret matches or that a paid checkout activated a plan in production.

**Why:** Read-only checks and synthetic fixtures can establish configuration and processing correctness without proving the complete live-payment flow.

**How to apply:** Report these checks separately. Do not charge customers, resend production events, or change subscriptions just to claim full verification; obtain approval for a controlled live-payment check.

Do not offer, mention or reintroduce GoCardless client payments without a new explicit owner request.

**Why:** On 2026-10-03 the owner said there is no GoCardless and repeatedly requested its complete removal, including direct-debit unavailability messages.

**How to apply:** Keep coach-client invoicing and payment records separate from Stripe's Practably subscription billing. Older proposals to add client direct debits do not override this decision.

Retiring a payment integration must not delete historical customer/payment data.

**Why:** The owner's removal request concerns the website and inactive integration, not deleting client records or legacy stored statuses.

**How to apply:** Use additive, reviewed migrations for new features. Do not accept schema-push suggestions to drop legacy columns without separate data-deletion approval.