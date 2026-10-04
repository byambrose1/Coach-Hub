---
name: Subscription provider choice
description: Owner-approved provider and account boundary for Practably coach subscriptions.
---
The owner has confirmed that the currently connected live Stripe account is the one Practably should use. Do not replace it with another account or provider without new explicit instruction.

**Why:** After initially not recognizing the account, the owner identified the current connected account ID and confirmed it is theirs and is the intended account.

**How to apply:** Preserve the current Stripe account and key. Never request keys in chat. If new checkouts are paused for account review, obtain explicit approval before re-enabling them. Preserve existing subscriptions and keep them separate from payments coaches collect from their clients.

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