# Customer Web E2E (Playwright)

Runs the slice happy paths in a phone-sized browser against a **local backend** on `http://localhost:8080`.
Pages are Server Components: the Next.js server (started by Playwright) calls the API itself through
`HAYI_API_ORIGIN` (default `http://localhost:8080`).

## Backend: at least one ACTIVE Branch

`choose-branch.spec.ts` needs one `ACTIVE` Branch. The backoffice E2E creates and activates one, so on a fresh
backend (see `apps/backoffice-web/e2e/README.md` for how to start it) run, in order:

```bash
pnpm --filter @hayi/backoffice-web e2e   # creates + activates a Branch, sets its hours
pnpm --filter @hayi/customer-web e2e
```

Whether the Branch shows "Đang mở" and a pickup time depends on today's hours and pickup config; the test accepts
either state.

```bash
pnpm --filter @hayi/customer-web exec playwright install chromium   # once
```

Set `E2E_SCREENSHOTS=<dir>` to keep one screenshot per screen. Not in CI yet: CI has no backend to run against.
