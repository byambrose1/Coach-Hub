---
name: Authentication provider choice
description: Owner selected an existing Supabase project for authentication, not a database migration.
---
Use the owner's existing Supabase project for the requested replacement of Replit sign-in. Do not choose Firebase or the default Clerk solution instead.

**Why:** On 2026-10-02 the owner requested Supabase or Firebase authentication and then confirmed they had already set up Supabase for auth.

**How to apply:** Scope the migration to authentication. Preserve existing coach identities, tenant ownership and Stripe links; do not move the application database without a separate explicit request. Existing accounts must be linked through a verified ownership path, not automatically merged by a matching email address.

Email sign-in remains available, and social sign-in must reflect the providers enabled in Supabase. Apple was disabled by the owner on 2026-10-07; do not show it while disabled. Keep GitHub removed as a customer login option.

**Why:** The owner initially selected email, Google and Apple, then disabled Apple in Supabase and asked to remove it from the sign-in choices.

**How to apply:** Treat Supabase's current provider availability as authoritative; hide disabled social options in the login UI and retain server-side availability checks. Keep the existing Supabase project keys: they are independent of social-provider credentials. Preserve email sign-in and existing account ownership. Do not restore GitHub when fixing provider configuration.

Auth-provider migrations need real SDK-construction/configuration probes as well as mocked token tests.

**Why:** Mocked authentication checks passed while the installed Supabase SDK could not construct a client on Node 20 without an explicit WebSocket transport, even though only Auth was used.

**How to apply:** Verify the installed SDK in the actual runtime and inspect provider availability without disclosing credentials or creating real accounts. Do not equate compilation or dependency-injected fixtures with a working external sign-in journey.