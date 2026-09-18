# How to use this

This zip contains every file that's changed or new since your original GitHub repo,
in the same folder structure as your project. It does not include the full app,
just what actually needs to change.

## Step 1: Upload/overwrite these files

Drag this zip's contents into your Replit project's file panel (or hand it to your
Replit Agent), keeping the same folder paths. Say yes to overwriting when prompted.

## Step 2: Delete these 3 files (not included here, deletions can't be "uploaded")

- `client/public/fittrack-social.svg` (replaced by `client/public/practably-social.svg`)
- `client/src/pages/notes.tsx` (unused, confirmed dead)
- `client/src/pages/referrals.tsx` (unused, confirmed dead)

## Step 3: Reinstall dependencies

`package.json` and `package-lock.json` changed. Run:

```
npm install
```

## Step 4: Push the database schema changes

`shared/schema.ts` changed (new fields for leads, payment options, updated pricing
defaults). Run:

```
npx drizzle-kit push
```

## Step 5: Add environment variables (if not already set)

- `SUPPORT_USER_IDS` — comma-separated Replit user IDs for anyone with limited
  admin/support access
- `BREVO_API_KEY` — your Brevo **API key** (not SMTP credentials), from
  SMTP & API → API Keys in your Brevo dashboard

## Step 6: Restart/redeploy

Confirm the app is actually restarted after all the above, not just saved.

Full detail on what each change does is in `CHANGELOG-practably-update.md`,
included in this same zip.
