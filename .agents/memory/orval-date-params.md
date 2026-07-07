---
name: Orval date params
description: Why OpenAPI `format: date` breaks orval/zod codegen for string date params
---

Rule: In `lib/api-spec/openapi.yaml`, never declare date fields/params as `type: string, format: date`. Use `type: string` with `pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"` instead.

**Why:** Orval maps `format: date` to `zod.date()`, which rejects the "YYYY-MM-DD" strings actually sent over HTTP, causing 400s on every request that includes a date.

**How to apply:** Whenever adding date fields to the API spec, use the string-pattern form, then run codegen (`pnpm --filter @workspace/api-spec run codegen`).
