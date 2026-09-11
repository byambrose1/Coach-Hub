# How to use this

This zip contains ONLY the files that changed or are new, in the same folder
structure as your project. It does not include the full app.

## Step 1: Upload/overwrite these 28 files

Drag this zip's contents into your Replit project's file panel (or your local
checkout), keeping the same folder paths. Replit and most file browsers will ask
to overwrite when a file already exists. Say yes.

## Step 2: Delete these 3 files (not included in this zip, since deletions can't be "uploaded")

- `client/public/fittrack-social.svg` (replaced by `client/public/practably-social.svg`)
- `client/src/pages/notes.tsx` (unused, confirmed dead)
- `client/src/pages/referrals.tsx` (unused, confirmed dead)

## Step 3: Reinstall dependencies

`package.json` and `package-lock.json` changed (the `passport-local` dependency
was removed). Run:

```
npm install
```

## Step 4: Add the new environment variable (when ready)

`SUPPORT_USER_IDS` — comma-separated Replit user IDs for anyone you want to give
limited admin/support access to. See `CHANGELOG-practably-update.md` for details.

## Step 5: Redeploy

That's it. `CHANGELOG-practably-update.md` in this same folder has the full
detail on what each change does and why.
