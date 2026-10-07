---
name: Authentication provider choice
description: Owner selected an existing Supabase project for authentication, not a database migration.
---
Use the owner's existing Supabase project for the requested replacement of Replit sign-in. Do not choose Firebase or the default Clerk solution instead.

**Why:** On 2026-10-02 the owner requested Supabase or Firebase authentication and then confirmed they had already set up Supabase for auth.

**How to apply:** Scope the migration to authentication. Preserve existing coach identities, tenant ownership and Stripe links; do not move the application database without a separate explicit request. Existing accounts must be linked through a verified ownership path, not automatically merged by a matching email address.

Only an explicit Create account action may create a Practably coach account. Email links are existing-account-only; Google is existing-account-only on Sign in and may create an account only from the Create account tab. Apple was disabled by the owner on 2026-10-07; hide it while disabled. Keep GitHub removed.

**Why:** The owner asked that only the explicit Create account path register new users, while preserving Google signup as an explicit choice and disabling Apple.

**How to apply:** Treat Supabase's provider availability as authoritative and hide disabled social options. Default identity resolution to existing accounts; opt into local account creation only for the explicit email-signup action or Google OAuth started from the Create account tab. Disable automatic account creation for email links. Supabase may create an upstream Auth identity during a first Google OAuth attempt, but the app must not create the Practably coach account unless the signup intent was explicit. Preserve existing account ownership and do not restore GitHub.

Auth-provider migrations need real SDK-construction/configuration probes as well as mocked token tests.

**Why:** Mocked authentication checks passed while the installed Supabase SDK could not construct a client on Node 20 without an explicit WebSocket transport, even though only Auth was used.

**How to apply:** Verify the installed SDK in the actual runtime and inspect provider availability without disclosing credentials or creating real accounts. Do not equate compilation or dependency-injected fixtures with a working external sign-in journey.