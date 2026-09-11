# Practably update: what changed and what you need to do

Everything below was type-checked (`tsc --noEmit`), linted against the project's own
safe-logging rule, covered by automated tests (21/21 passing, 3 new), and confirmed to
build successfully for production (`npm run build`) before being handed back to you.

## 1. Rebrand: FitTrack / Coach-Hub to Practably

Every user-facing and internal reference to "FitTrack" was renamed to "Practably":
package name, page titles, meta tags, the sidebar logo, email templates and sender
defaults, the terms/privacy/support pages, the social preview image (renamed and its
text updated), and `replit.md`.

**You still need to:**
- Update the `PUBLIC_SITE_URL` / `VITE_SITE_URL` env var once you have a domain
- Fill in the real values in `client/src/config/site.ts` (support email, legal entity
  name, address, etc., currently marked `TODO: OWNER INPUT REQUIRED`, left untouched
  by this pass since only you can supply them)
- Register the domain and do your own final trademark check before anything public ships

## 2. Reliability fix: sign-in no longer takes the whole app down

Previously, if Replit's identity service had a transient blip at startup, the entire
server crashed, not just login. Now:
- OIDC discovery retries automatically (3 attempts with backoff) before giving up
- If it still fails, sign-in returns a clear "temporarily unavailable" message instead
  of crashing, and the rest of the app (marketing pages, already-signed-in sessions)
  keeps working

No new configuration needed. This is automatic.

## 3. Admin: two-tier access (owner and support)

Added a `SUPPORT_USER_IDS` environment variable alongside your existing `OWNER_USER_ID`.

**To give your admin person access:**
1. Have them sign in to the app once (this creates their user record)
2. Find their Replit user ID (you, as owner, can see it in the coach list on
   `/platform-admin`, or they can tell you the `id` field from `/api/auth/user`
   while signed in)
3. Add it to the `SUPPORT_USER_IDS` environment variable/secret. Multiple people can
   be added comma-separated: `SUPPORT_USER_IDS=abc123,def456`

**What support access can do:** view platform stats, view any coach's account and
client list, and use "View as Coach" (impersonation) to help troubleshoot.
**What it can't do:** edit pricing/tier configuration, or change a coach's billing plan.
Those stay owner-only, and the admin UI now visibly disables those controls with a
"view only" note for a support login rather than letting them click something that
silently fails.

## 4. Fixed: double-booking

There was no check at all preventing two 1:1 sessions being booked into the same time
slot. Now:
- Booking a session that overlaps an existing one (same day, overlapping time) is
  rejected with a clear message naming the conflicting time
- Rescheduling into a conflicting slot is rejected the same way
- **Group sessions are exempt.** A coach running a group class is supposed to have
  several bookings at the same time, so that's not treated as a conflict
- Booking a client into time you've blocked off (via "Block Time Off") is also caught
  and rejected
- **The "Block Time Off" bulk action itself still always succeeds**, even on a day that
  already has sessions. This was a deliberate choice to avoid breaking that existing
  workflow; it doesn't retroactively cancel anything, it just marks the day unavailable

## 5. Added: no-show tracking

Sessions could previously only be marked "Complete" or "Cancelled." There was no way
to record that a client simply didn't turn up, distinct from either of those. Now:
- A "Mark as no-show" action sits alongside Complete/Cancel on any scheduled session
- No-shows are visually distinct (amber badge) in the day view and calendar
- **By design, a no-show keeps the session counted as used** against the client's
  package (the coach held the slot), unlike a cancellation, which restores it to the
  package by default. This is a simple, sensible default; if you later want an option
  to waive a no-show back onto the package, that's a small follow-up, not built here.
- No cancellation/reschedule email is sent to the client when a session is marked
  no-show (correct, since the client already knows they missed it)

## 6. Fixed: every error message across the app

A bug existed in the shared API-request helper (`client/src/lib/queryClient.ts`) that
showed raw JSON in every error toast across the entire app. For example, a real error
would have displayed as `409: {"message":"...","conflictingSessionId":"..."}` instead
of a clean sentence. This affected every existing error message in the product, not
just the new conflict-detection feature. Now the actual message is extracted and shown
cleanly. (One dependent helper, `isUnauthorizedError`, was updated to check the HTTP
status code directly rather than pattern-matching the old message format, so it keeps
working correctly.)

## 7. Removed dead code

- `client/src/pages/notes.tsx` and `client/src/pages/referrals.tsx`: unused page
  files not wired into any route (confirmed via search before deleting)
- The `passport-local` dependency: installed but never used anywhere (only Replit's
  OIDC strategy is actually registered)

## 8. New logo

The previous logo was a generic icon (a dumbbell) dropped into a gradient rounded
square, the kind of default treatment that shows up on any auto-generated app. It's
been replaced with a custom mark:

- A hand-drawn "open-bowl P" monogram, not a font glyph in a box but an actual custom
  shape, in your existing violet, with a small orange dot as a terminal accent tying
  it to the app's existing orange highlight color
- Checked for legibility at the size it'll actually render at (32px sidebar badge). It
  stays clean and readable
- A white "inverted" variant for dark backgrounds (used in the landing page footer,
  where the plain violet version read too muddy against near-black)
- Applied everywhere the old logo appeared: sidebar, favicon, landing page header/nav/
  footer, and the Privacy/Terms/Support pages header
- Rebuilt the social share preview image (`practably-social.svg`) to use the new mark
  instead of a hand-drawn dumbbell shape that was hiding in the raw SVG. While in
  there, fixed a genuine pre-existing bug where the heading text overflowed the
  canvas and ran behind the "this week" card mockup (confirmed by actually rendering
  the file with the real Inter font, not just reading the code)

The mark lives in `client/src/components/brand-mark.tsx` as a reusable component
(`<BrandMark />` / `<BrandMark variant="inverted" />`) so it stays consistent
everywhere rather than being copy-pasted.

## 9. Positioning: dropped "fitness" from the outward-facing copy

Following the earlier audit, the business is positioned as an admin hub for
independent coaches generally (personal trainers included, but not limited to
fitness). The copy previously said "independent fitness coaches" in several places
where it should say "independent coaches." Updated in:
- `client/src/config/site.ts` (tagline and description)
- `client/index.html` (page title and meta tags)
- The landing page (document title, meta tags, hero headline, FAQ answer)
- The Terms page copy
- `practably-social.svg` (the visible heading and the image description)
- `replit.md` (internal project description)
- The Settings page business-address placeholder, which was also oddly US-styled
  ("City, State") despite the rest of the app being UK-first; changed to
  "123 High Street, Town, Postcode"

Product-specific terminology that's genuinely industry-standard, like "PARQ form,"
was left alone. That's a real term personal trainers use, not fitness-flavored
marketing language.

## 10. Style pass: em dashes removed

Every em dash in the app's user-facing copy and in this changelog was replaced with a
period, comma, or colon, whichever reads most naturally in context. Also swept the
codebase for other common AI-generated writing tells (words like "seamless," "unlock,"
"elevate," "revolutionize," exclamation-heavy copy, "whether you're X or Y" framing).
None were found; the existing copy was already fairly plain and specific.

## How to apply this

This zip contains the full project with all changes already made. The simplest path:
1. In Replit, delete the existing project files (or start a fresh Repl)
2. Upload/extract this zip's contents in their place
3. Add the `SUPPORT_USER_IDS` secret when you're ready to give your admin person access
4. Run `npm install` (the lockfile has changed slightly since `passport-local` was removed)
5. Redeploy

Alternatively, if you're comfortable with git: this was built from a clean clone of
your GitHub repo, so you can diff this against your existing `client/`, `server/`,
`shared/`, and root config files and apply the changes manually or via your own PR.
