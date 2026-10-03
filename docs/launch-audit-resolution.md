# Launch audit resolution

Updated: 2 October 2026. **This is not public-launch approval.**

The attached audit contains both engineering defects and assurance work requiring
operator/provider evidence. The owner considers the legal documents acceptable
and does not require solicitor review; hiring a solicitor is not a project gate.
That decision does not prove provider arrangements or a real payment/sign-in journey. Keep private-beta wording and
use fictional client/health data while these launch gates remain open.

## Findings and current disposition

| Finding | Engineering work | Still required before public launch |
| --- | --- | --- |
| P0 privacy/compliance | Shared browser/server privacy and terms content; clearer intended roles, disabled client payments, cookies and active-database vs provider/backup deletion; in-app fictional-data warning. Owner considers the legal documents acceptable and does not require a solicitor. | Actual regions, applicable processor agreements, transfer arrangements, customer data-processing terms, health-data responsibilities, retention schedule and operational breach process |
| P1 authentication | Explicit session-bound random state and nonce alongside S256 PKCE; ten-minute transaction expiry; invalid, missing-session and replay rejection; safe consent denial; generic account-creation errors; saved refresh sessions; logout destroys local session and requests refresh-token revocation when the provider supports it | Real new-user and returning-user Replit sign-in, provider linking behavior, intended redirects, logout, multiple devices/tabs, expiry/renewal and back-button tests |
| P1 payment claims | Website describes invoices and coach-recorded payments. The inactive client collection scaffold, controls and provider notices have been removed; retired endpoints return 404 | Any future automatic client collection feature requires a separate owner-approved scope and verified provider journey |
| P1 billing/refunds/deletion | Existing mocked billing/refund coverage retained; deletion keeps account/data if subscription cancellation fails; cancellation ownership checked; client-data deletion uses a transaction; all stored browser sessions removed when the auth user is deleted | An isolated Stripe test-mode checkout-to-webhook-to-app test, actual email delivery evidence, failed payments, cancellation, limits, refund and deletion/export checks |
| P2 headers | Express disclosure removed; production script CSP no longer permits unsafe-inline/eval; production legacy SAMEORIGIN frame protection; Replit development embedding retained | Republish and inspect the actual published headers; provider confirmation of infrastructure-cookie behavior |
| P2 indexability | HTTP HTML contains route-specific metadata and content for public pages and published articles; canonical/OG/Twitter data; shared legal content; configurable pricing uses the same projection as the API; missing/draft pages 404/noindex; client navigation updates metadata | Check published canonical URLs, sitemap routes and social previews after publishing |
| P3 copy/beta | Support punctuation corrected without changing the stated 8pm GMT boundary; private-beta/waitlist wording retained deliberately | Operator decides public-launch messaging only after the P0/P1 launch gates are satisfied |

## P0: evidence the operator must gather

Do not substitute a generic provider marketing page for evidence about this
particular deployment/account.

- Confirm the actual hosting and database locations in the published project's
  settings, including backup locations. Confirm authentication processing and
  support access locations separately. General platform defaults do not prove
  the project's selected region.
- Obtain the applicable Replit terms/DPA and current subprocessor list. Identify
  the actual database service provider: PostgreSQL is software, not a processor
  company. Verify Brevo processing locations/DPA and Stripe's relevant roles,
  contractual terms and retention. Document whether terms were executed or apply
  through the account agreement.
- Document the operator's assessment of controller/processor roles, customer
  data-processing terms, Article 6 grounds and applicable special-category
  conditions for health data, safeguards, DPIA needs, transfers and any UK
  transfer instruments/assessments required for the actual arrangements.
- Approve an explicit schedule covering clients, health forms, invoices, usage
  events, support, waitlist entries, account/session data, provider records and
  backups. The Settings retention field does **not** currently automate deletion.
- Define secure subject-access/export, correction, deletion and complaint
  processes; verify recipient identity and coach/client responsibilities.
- Define incident ownership, detection, evidence preservation, containment,
  processor-to-coach notification, reportability assessment and communications.
  Where reportable, ICO guidance requires notification without undue delay and
  within 72 hours. Record incidents and decisions even when not reportable.
- Confirm the hosting infrastructure's GAESA routing-cookie purpose and
  attributes with the provider. The application does not set that cookie and
  cannot change a cookie injected after its response leaves the server.

### Source pointers checked during this work

- Replit deployment metadata verified the public origin as
  `https://www.practably.co.uk`; it did not establish a hosting/backup region.
- Replit documentation search identifies `https://replit.com/dpa` and describes
  GAESA as an infrastructure routing cookie outside the builder's controls.
  Obtain account-specific confirmation before marking the cookie item closed.
- ICO international-transfer guidance:
  https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/
- ICO breach guidance:
  https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide
- ICO 72-hour response guidance:
  https://ico.org.uk/for-organisations/advice-for-small-organisations/personal-data-breaches/72-hours-how-to-respond-to-a-personal-data-breach

## P1: real-provider acceptance matrix

### Additional checklist: terms acceptance

This is a remaining engineering gap identified by the second uploaded checklist.
The current app records a yes/no acceptance only, with no accepted document
version or acceptance timestamp. The modal links to Terms and Privacy, but the
backend does not enforce acceptance of a current legal version.

Implementing this requires versioned, timestamped acceptance tied to the coach,
server-side checks for normal protected workflows, re-prompting when the version
changes, and a clear decline/sign-out path. Existing users would need to accept
the current version once. Keep cancellation, refunds, account deletion and
data-rights/export access available rather than trapping users behind new terms.
Do not conflate terms acceptance with marketing opt-in or client health-data
consent. Record the operational process for notifying users of material changes.

Use a separately authorized, isolated test setup with the **existing Stripe
account's test mode**. Do not replace the live account, switch production keys,
or run real charges/refunds to verify code.

### Authentication

1. New Replit user creates a Practably profile and accepts the terms; returning
   user retains the same subject/profile. Never merge identities solely by email.
2. Confirm secure cookie flags and HTTPS callback; sign-in completes at the
   intended workspace. Test the actual provider rather than an API fixture.
3. Denied consent/provider error, expired/malformed code, absent session,
   different-browser state and replay fail safely without exposing details.
4. Check parallel tabs, logout, other-device sessions, back-button behavior,
   token/session expiry and refresh followed by another request.
5. Verify whether the provider supports refresh-token revocation. Local logout
   clears its session even when provider revocation is unavailable or fails;
   this is not a claim to revoke the entire user's Replit account.
6. Confirm refreshed tokens remain subject-bound, are kept only server-side,
   are excluded from logs, and are covered by the operator's access/retention
   controls. Offline access supports renewing the seven-day application session.

### Billing and data lifecycle

1. Test-mode checkout with each configured price; observe payment, verified
   callback and signed webhook activating the correct coach plan.
2. Duplicate/retried/out-of-order signed webhooks; invalid signatures; failed or
   incomplete payment; ensure no false activation.
3. Period-end cancellation and downgrade at/beyond each client limit; no loss of
   existing data when access becomes limited.
4. Refund inside/outside the first-payment deadline, repeat clicks, pending and
   failed refunds, original-method refund confirmation, immediate cancellation,
   Free settings and retained client data.
5. Verify recovery after refund acceptance followed by cancellation/storage
   failure, including closing the browser. Durable background recovery is a
   separate outstanding follow-up; the current UI provides safe cancellation
   retries and authoritative status polling.
6. Verify actual invoice/receipt delivery and sender identity. Distinguish
   Practably invoice emails from Stripe subscription receipts; no receipt
   behavior should be promised without observing the relevant provider settings.
7. Export before deleting. Delete only disposable fictional test records.
   Confirm active database removal, every application session revoked, no
   cross-coach deletion, and explicit recovery when provider cancellation fails.
8. Verify provider email retention/suppression, in-flight work and backup
   retention with the operator/providers. Do not promise immediate erasure of
   already delivered email, payment records or infrastructure backups.

## Engineering verification

`npm run check`, `npm test`, `npm run build`, and `git diff --check` validate the
code. The OIDC tests exercise the installed library against a fictional token
issuer, including signed ID tokens and negative callback cases. Browser billing
checks intercept every API call and cannot create live financial side effects.
Neither those tests nor a successful build are substitutes for the real-provider
or legal acceptance checks above.