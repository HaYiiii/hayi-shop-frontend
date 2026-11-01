# Backoffice E2E (Playwright)

Runs the slice happy paths in a real browser against a **local backend** on `http://localhost:8080`.
Vite (started by Playwright) proxies `/api` to it, so the HttpOnly cookies stay same-origin.

## Backend: fresh database with a bootstrap Owner

`owner-sign-in.spec.ts` signs in as the bootstrap Owner with its temporary password, so each run needs a
fresh database. In `hayi-shop-backend`, the Testcontainers runner gives one per start and leaves the
compose database alone:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@25
HAYI_BOOTSTRAP_OWNER_EMAIL=owner@hayi.local HAYI_BOOTSTRAP_OWNER_PASSWORD='mat khau tam thoi 01' \
  ./gradlew bootTestRun --args='--spring.docker.compose.enabled=false --hayi.security.allow-ephemeral-key=true --hayi.security.mfa-encryption-key=ZGV2LW9ubHktbWZhLWtleS1ub3QtYS1zZWNyZXQhISE='
```

(The MFA key is the public dev-only value from the backend's `bootRun` task.) Restart it before re-running.

## Run

```bash
pnpm --filter @hayi/backoffice-web exec playwright install chromium   # once
pnpm --filter @hayi/backoffice-web e2e
```

Override the account with `E2E_OWNER_EMAIL`, `E2E_OWNER_TEMP_PASSWORD`, `E2E_OWNER_NEW_PASSWORD`.
Not in CI yet: CI has no backend to run against.
