---
name: Atomic single-use token consumption
description: Why magic-link/invite consumption must be a single atomic UPDATE, not SELECT-then-UPDATE
---

Consume any single-use token (magic link, invite code, password reset, etc.) with a single atomic statement:

```
UPDATE tokens SET used_at = now()
WHERE token = $1 AND used_at IS NULL AND expires_at > now()
RETURNING *
```

Proceed only if exactly one row is returned. Drizzle: `db.update(table).set({usedAt}).where(and(eq(token), isNull(usedAt), gt(expiresAt, now))).returning()`.

**Why:** A `SELECT ... WHERE unused` followed by a separate `UPDATE used_at` lets two concurrent requests both pass the SELECT and both succeed — token replay under concurrency. Code review caught this in the Life Group App auth flow (verify + register).

**How to apply:** Any time you validate-then-mark-consumed on a credential-bearing row. The WHERE clause carries the freshness/unused predicate so the DB serializes it; the RETURNING tells you if you won the race.
