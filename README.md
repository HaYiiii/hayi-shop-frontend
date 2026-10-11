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
