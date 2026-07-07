---
name: Life Group App auth model
description: Auth/roles/categories conventions for the Life Group App (church cell group PWA, pt-BR)
---

Mobile-first PWA (pt-BR) for managing a single church cell group (célula).

**Auth:** passwordless magic-link by email via Resend (no passwords, no SMS). Flow: request magic-link → email with token → verify sets session cookie. Invites create a code; register-with-invite creates the account then issues a magic link. In dev (`NODE_ENV !== 'production'`) magic-link/register responses include `devLink` so you can test without a live email provider connected.

**First user:** the first leader is seeded on server startup from env `SEED_LEADER_NAME` + `SEED_LEADER_EMAIL`.

**Roles:** leader (líder), auxiliary (auxiliar), member (membro), guest (convidado — no login). Privileged routes require leader/auxiliary via `requirePrivileged`.

**Categories (multi):** host (anfitrião), discipler (discipulador), disciple (discípulo).

**Why:** Chosen for zero-cost, no-SMS auth in a small-group context where email is the reliable identifier. Guests intentionally have no email/login (email is nullable; unique index on email is partial `WHERE email IS NOT NULL`).
