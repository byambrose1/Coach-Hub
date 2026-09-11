---
name: GitHub upload layout
description: GitHub uploads can leave a duplicate nested app tree beside the active root app.
---

The configured workflow serves the root `client` and `server` directories. A GitHub folder upload may instead create nested `client/client` and `server/server` copies; those copies are not active and can introduce type-check errors if included.

**Why:** The repository can appear updated in GitHub while the preview still runs older root files, and duplicate server files can be compiled unintentionally.

**How to apply:** Before syncing GitHub changes, inspect the workflow root and compare root versus nested trees. Preserve the active root app unless the user explicitly wants a full migration, and exclude or remove confirmed inactive duplicates.