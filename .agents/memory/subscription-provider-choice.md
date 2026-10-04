---
name: Subscription provider choice
description: Owner-approved provider and account boundary for Practably coach subscriptions.
---
The owner chose to switch Practably's direct Stripe API credentials to the intended live account after the Replit connector repeatedly resolved to other accounts. The new key has been verified against the intended account; subscriptions on the former account are not migrated.

**Why:** The app uses Stripe's SDK with Replit Secrets, while the Replit connector and agent Stripe session can resolve to different accounts. The owner chose the direct-secret path to avoid repeated connector setup.

**How to apply:** Verify the account ID through the SDK using the configured secret without displaying it. Treat plan prices, webhook signing secrets/endpoints, and Billing Portal configuration as account-specific. Never request keys in chat. Do not claim old-account subscriptions migrated or remain app-manageable after replacing the key.

Validate existing coach billing references separately after switching Stripe accounts; matching the key, prices, and portal configuration is not sufficient.

**Why:** After the account switch, production checkout, portal access, and refund checks all returned Stripe `resource_missing` errors. Existing customer references can still belong to the former account even when the new account's configuration is correct.

**How to apply:** Check existing customer and subscription accessibility before declaring billing ready. Preserve historical payment links and do not blindly recreate subscriptions or clear records, which could lose refund history or cause duplicate billing.

The owner confirmed on 2026-10-04 that nobody had paid and the reported error affected a Free account. Stripe customer records from abandoned checkout are not evidence of a payment.

**Why:** Initial diagnosis treated missing setup references as potentially paid legacy billing, but the owner clarified there was no paid history at the account switch.

**How to apply:** Recover missing unpaid Free setup only on an intentional upgrade, with no linked subscription or active entitlement. Preserve linked subscriptions and block ambiguous cases. Do not assume the launch-time absence of payments remains true indefinitely.

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