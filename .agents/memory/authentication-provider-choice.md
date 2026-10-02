---
name: Authentication provider choice
description: Owner selected an existing Supabase project for authentication, not a database migration.
---
Use the owner's existing Supabase project for the requested replacement of Replit sign-in. Do not choose Firebase or the default Clerk solution instead.

**Why:** On 2026-10-02 the owner requested Supabase or Firebase authentication and then confirmed they had already set up Supabase for auth.

**How to apply:** Scope the migration to authentication. Preserve existing coach identities, tenant ownership and Stripe links; do not move the application database without a separate explicit request. Existing accounts must be linked through a verified ownership path, not automatically merged by a matching email address.

The owner intends to use GitHub sign-in in Supabase.

**Why:** On 2026-10-02 the owner explicitly clarified that the GitHub link was Supabase sign-in, not the app's code repository.

**How to apply:** Its OAuth credentials belong in Supabase; do not request a GitHub client secret for the application or interpret this setup as a repository connection. Verify the project's actual provider settings: linking a dashboard account to GitHub does not establish that project-level GitHub sign-in is enabled.

Auth-provider migrations need real SDK-construction/configuration probes as well as mocked token tests.

**Why:** Mocked authentication checks passed while the installed Supabase SDK could not construct a client on Node 20 without an explicit WebSocket transport, even though only Auth was used.

**How to apply:** Verify the installed SDK in the actual runtime and inspect provider availability without disclosing credentials or creating real accounts. Do not equate compilation or dependency-injected fixtures with a working external sign-in journey.