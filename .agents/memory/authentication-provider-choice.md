---
name: Authentication provider choice
description: Owner selected an existing Supabase project for authentication, not a database migration.
---
Use the owner's existing Supabase project for the requested replacement of Replit sign-in. Do not choose Firebase or the default Clerk solution instead.

**Why:** On 2026-10-02 the owner requested Supabase or Firebase authentication and then confirmed they had already set up Supabase for auth.

**How to apply:** Scope the migration to authentication. Preserve existing coach identities, tenant ownership and Stripe links; do not move the application database without a separate explicit request. Existing accounts must be linked through a verified ownership path, not automatically merged by a matching email address.