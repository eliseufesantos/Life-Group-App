---
name: Singleton/idempotent DB rows
description: How to enforce single-row tables (VAPID keys) and once-per-period rows (monthly reports) safely
---

Read-then-insert is racy under concurrent instances/restarts. Enforce at the DB level:

- **Singleton row** (e.g. `chaves_vapid` VAPID keypair): add `singleton integer NOT NULL DEFAULT 1 UNIQUE`, insert with `onConflictDoNothing().returning()`, and if no row returned, select the existing winner.
- **Once-per-period row** (e.g. monthly `relatorios`): partial unique index `(type, period_start, period_end) WHERE type = 'monthly'`, insert with `onConflictDoNothing()`, fall back to select on conflict.

**Why:** the report scheduler runs on every server start + hourly; overlapping starts created duplicate-row risk flagged in review.

**How to apply:** any "generate on first use" or "ensure exists" pattern must have a unique constraint + conflict-safe insert, not a SELECT check.

Also: drizzle-kit push prompts interactively (truncate?) when adding unique constraints to populated tables — apply the DDL manually via SQL, then re-run push to confirm "Changes applied".
