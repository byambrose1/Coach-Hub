# Supabase authentication

Practably uses the owner's existing Supabase project for authentication, with
GitHub, email/password and email magic-link options. Application data remains in
the existing PostgreSQL database; Stripe customer and subscription IDs do not
change.

## Supabase configuration

The project URL, publishable key and server-only secret key are stored in Replit
Secrets. Do not copy keys into source control, client code, screenshots or logs.
The server-only key is used for authentication-account deletion and logout.
GitHub OAuth credentials stay in Supabase.

The login page checks the configured project's actual enabled providers. An
unavailable provider is disabled in the UI rather than advertised as working.
If GitHub is unavailable, check Authentication → Sign In / Providers → GitHub
in the same Supabase project as the stored URL and keys. Connecting a GitHub
account to the Supabase dashboard is not the same as enabling this provider.

Supabase Authentication → URL Configuration must allow the application's
callback URL. The callback includes a random session-bound state query parameter:

- Published primary site:
  `https://www.practably.co.uk/api/auth/supabase/callback?state=*`
- If the verified alternate published origin is used:
  `https://coach-hub-uzmon92.replit.app/api/auth/supabase/callback?state=*`
- For development, use the current development origin with the same
  `/api/auth/supabase/callback?state=*` suffix.

Do not use a wildcard covering arbitrary production hosts or paths. Set the Site
URL to the intended public origin. Keep email confirmation enabled. If custom
email templates replace Supabase's generated confirmation URL, preserve its
PKCE-compatible callback and state; a generic homepage link cannot finish the
exchange. Magic links and confirmation links must open in the browser that
started the request.

## Existing coaches

1. On `/login`, choose **Connect your existing coach account**.
2. Authenticate with the original Replit account.
3. Back on the login page, choose GitHub or an email sign-in/signup option.
4. After successful Supabase verification, the new identity is linked to the
   original local coach ID. Client ownership, settings and billing remain intact.

Existing application sessions remain usable during this transition. Replit
authentication is retained as an explicit linking bridge, not the default
sign-in provider. Do not remove the bridge until existing coaches have migrated
or an independently verified recovery process has been provided.

Matching an email address does not merge accounts. An existing identity cannot
be reassigned to another coach. New Supabase identities have namespaced local
IDs and a separate identity mapping.

## Sessions and deployment

OAuth uses server-held PKCE and a random, ten-minute, single-use callback state.
Email mutations require a session-bound CSRF token. Access and refresh tokens
remain in the server session store behind an HttpOnly/Secure/SameSite=Lax cookie.
Refresh validates the provider subject and preserves the local coach ID. Each
protected request validates the provider user, mapping and surviving local
account. Logout destroys the local session and attempts provider revocation.

The `auth_identities` table is added idempotently at startup, with a foreign key
to existing users. This is additive; no database relocation or bulk account
rewrite occurs. Deployments must have permission to create this table. Failure
is explicit rather than silently creating disconnected coach accounts.

Account deletion cancels owned billing first, then deletes linked Supabase auth
accounts, then removes local client/account data and all browser sessions.
Provider-deletion failure retains client data and returns a retryable error.
Remote provider deletion and local database deletion are not a single distributed
transaction: if local deletion fails after provider deletion, support must
recover the retained account through verified ownership. Never run real provider
deletions or charges as a test.

## Verification boundaries

Unit tests cover callback expiry/replay, stable identity mapping, email collision,
cross-account reassignment rejection, provider subject validation, deleted-account
rejection, token rotation and saved refresh sessions. Live configuration probes
may read provider settings and start OAuth redirects, but must not create users,
send emails, charge, refund or delete real accounts.

A full external GitHub consent/callback journey and actual email delivery need
an authorized interactive test account. Starting an OAuth redirect alone does
not verify those final steps.