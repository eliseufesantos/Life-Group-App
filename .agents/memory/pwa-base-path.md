---
name: PWA under path-based proxy
description: Base-path rules for manifest, icons, and service worker in Vite PWAs on Replit
---

The app is served under a dynamic Vite `base` (`BASE_PATH` env). Root-absolute URLs break under path-based hosting.

- In `index.html`, use `%BASE_URL%manifest.webmanifest`, `%BASE_URL%icons/...` — Vite substitutes `%BASE_URL%` at build/serve time (includes trailing slash).
- In TS/JS, use `import.meta.env.BASE_URL` for `navigator.serviceWorker.register(...)` and fetch URLs.
- Never hardcode `/manifest.webmanifest` or `/api/...`.

**Why:** review caught root-absolute manifest/icon links that would break PWA install and iOS icons when the artifact is mounted under a path prefix.
