#!/usr/bin/env bash
set -euo pipefail

# Keep the main workspace aligned with an isolated task after it is merged.
# All commands are non-interactive; potentially destructive schema changes
# must fail for review rather than being forced automatically.
npm ci --no-audit --no-fund
npm run db:push
npm run check
npm run build