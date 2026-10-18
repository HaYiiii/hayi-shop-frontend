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
pnpm test
pnpm dev               # customer-web :3000, backoffice-web :5173
```

## CI

Mỗi PR và mỗi push vào `main` chạy `.github/workflows/ci.yml`: cài dependency, sinh type API từ artifact `api-spec` của lần chạy CI xanh gần nhất trên `main` của backend, rồi typecheck, test và build. Nếu type sinh ra khác bản đã commit thì CI đỏ. Để sửa, sinh lại type từ đúng artifact đó rồi commit:

```bash
run=$(gh run list -R HaYiiii/hayi-shop-backend --workflow CI --branch main --status success --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download "$run" -R HaYiiii/hayi-shop-backend -n api-spec -D /tmp/hayi-api-spec
HAYI_API_SPEC_DIR=/tmp/hayi-api-spec pnpm generate:api
```

## Cấu trúc

```text
apps/customer-web     Next.js (App Router), mobile-first
apps/backoffice-web   Vite + React, desktop/tablet
packages/api-client   type sinh từ OpenAPI + openapi-fetch (cookie, CSRF, Idempotency-Key, Problem Details)
packages/domain-utils format VND, giờ theo Branch
packages/config       tsconfig dùng chung
```

`ui` (Tailwind + shadcn/ui) và `realtime` (SSE) được thêm ở P0.4.

Quy tắc: app chỉ import `packages/*`; không lưu token trong storage; tổng tiền luôn lấy từ server.
