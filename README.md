# hayi-shop-frontend

Frontend monorepo HaYi Shop — pnpm workspaces + Turborepo (Decision H4).

Tài liệu chuẩn: `../../HaYi-Shop-Canonical-VI/` (đặc biệt `docs/architecture/SOURCE-STRUCTURE.md` §3).

## Yêu cầu

Node 24, pnpm 12.

## Lệnh thường dùng

```bash
pnpm install
pnpm generate:api      # sinh type từ ../hayi-shop-backend/api-spec (hoặc HAYI_API_SPEC_DIR)
pnpm build             # build tất cả app + package
pnpm typecheck
pnpm lint             # ESLint (flat config dùng chung trong packages/config/eslint)
pnpm test
pnpm dev               # customer-web :3000, backoffice-web :5173
```

## CI

Mỗi PR và mỗi push vào `main` chạy `.github/workflows/ci.yml`: cài dependency, sinh type API từ artifact `api-spec` của lần chạy CI xanh gần nhất trên `main` của backend, rồi typecheck, lint, test và build. Nếu type sinh ra khác bản đã commit thì CI đỏ. Để sửa, sinh lại type từ đúng artifact đó rồi commit:

```bash
run=$(gh run list -R HaYiiii/hayi-shop-backend --workflow ci.yml --branch main --status success --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download "$run" -R HaYiiii/hayi-shop-backend -n api-spec -D /tmp/hayi-api-spec
HAYI_API_SPEC_DIR=/tmp/hayi-api-spec pnpm generate:api
```

## Cấu trúc

```text
apps/customer-web     Next.js (App Router), mobile-first
apps/backoffice-web   Vite + React, desktop/tablet; route theo file trong src/routes/ (TanStack Router)
packages/api-client   type sinh từ OpenAPI + openapi-fetch (cookie, CSRF, refresh-on-401, step-up, Idempotency-Key, Problem Details)
packages/ui           design system D2: theme Tailwind 4 (token) + component dùng chung (Button, Field, Dialog, Menu…; Radix + CVA)
packages/domain-utils format VND, giờ theo Branch
packages/config       tsconfig dùng chung
```

`realtime` (SSE client) chưa có; được thêm ở slice S6 Order Board (canonical `IMPLEMENTATION-PLAN.md` §2).

E2E Playwright của Backoffice nằm ở `apps/backoffice-web/e2e` (chạy với backend local, xem README trong đó).

Package chỉ commit mã nguồn (và `src/generated/` của `api-client`); build ra `dist/`.

Quy tắc: app chỉ import `packages/*`; không lưu token trong storage; tổng tiền luôn lấy từ server.
