# CLAUDE.md — hayi-shop-frontend

HaYi Shop frontend monorepo: pnpm 12 + Turborepo, Node 24, TypeScript 5.9.
`apps/customer-web` (Next.js 16 App Router, mobile-first) · `apps/backoffice-web` (Vite 8 + React 19, desktop/tablet) · `packages/*`.
The user communicates in Vietnamese; reply in Vietnamese. Code and commit messages are English; **UI copy is Vietnamese**.

## Source of truth

Canonical docs live outside this repo (no git): `/Users/hayi/Documents/projects/HaYi-Shop-Canonical-VI`.
See [docs/agents/domain.md](docs/agents/domain.md). Docs win over code; if they disagree, stop and ask.
API behaviour comes from canonical `docs/architecture/api/*.md` and the backend's `api-spec/*.yaml`.

## Commands

```bash
pnpm install
pnpm generate:api   # types from ../hayi-shop-backend/api-spec (or HAYI_API_SPEC_DIR)
pnpm build          # all apps + packages
pnpm typecheck
pnpm test
pnpm dev            # customer-web :3000, backoffice-web :5173
```

## Design gate (Decision J5)

**Do not build a screen whose design is not approved.** Designs (Track D: brief → design system → mockups) are published as Artifacts and listed in the canonical `IMPLEMENTATION-PLAN.md` §2.1. A ticket for an FE screen must link its approved design. Visual tokens come from the approved design system via `packages/ui` — no ad-hoc colours/spacing.

## Architecture rules

- Apps import only `packages/*`; never import across apps.
- Feature folders by bounded context (`features/order`, `features/payment`, …) — same names as the backend modules.
- All HTTP goes through `@hayi/api-client` (generated types + `openapi-fetch`); server state via TanStack Query. No hand-written `fetch` to the API.
- Never store tokens in `localStorage`/`sessionStorage` (cookies are HttpOnly). `localStorage` only for guest-cart intent and UI preferences.
- Never compute authoritative prices/totals on the client; show server values. Format money/time with `@hayi/domain-utils`.
- UI permission guards are UX only; the backend enforces.
- Errors: branch on Problem Details `code`, never on message text.
- Customer Web: public pages (menu, product) are Server Components calling `/api/public/v1`; authenticated pages are client components.

## Quality

- Before marking an FE ticket done: run `web-design-guidelines` on the changed UI files and fix findings.
- Write and refactor components with `vercel-react-best-practices` (no request waterfalls, bundle discipline, re-render hygiene) and `vercel-composition-patterns` (compound components over boolean-prop APIs).
- Tests: `tdd` skill; Vitest + Testing Library at component/hook seams; Playwright for slice happy paths.

## Workflow

- **Start every ticket with `/ticket <n>`** (or `/ticket` to pick the next Ready one); review PRs with `/ticket review <pr>`, ideally in a fresh session. The skill encodes the whole flow: context → gate checks → plan (wait for approval) → TDD → verify → PR → In Review. Board operations go through `scripts/board.py`.

- Tracker: GitHub Issues + Project "HaYi Shop" — see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
- **WIP ≤ 3 In Progress items across the project.** Check before starting a ticket.
- Definition of Done: canonical `IMPLEMENTATION-PLAN.md` §1.1.
- Branch `feature/<ticket>-<slug>`; Conventional Commits; PR links the ticket, the canonical sections and the approved design.
- This repo is **public**: never commit secrets or real API keys.

## Agent skills (vendored in `.claude/skills`, pinned — see VENDORED.md)

| When | Skill |
|---|---|
| Design interview in the browser (Track D1) | `grill-with-ui` |
| Sharpen a plan with the user | `grill-with-docs` (uses `grilling`, `domain-modeling`) |
| Break a plan into tickets | `to-tickets` |
| Implement a ticket | `tdd` |
| React/Next.js code | `vercel-react-best-practices`, `vercel-composition-patterns` |
| UI review (a11y, forms, UX) | `web-design-guidelines` (pinned rules, HaYi overrides) |
| Hard bug | `diagnosing-bugs` |
| Review a branch/PR | `code-review` |
| Architecture health check | `improve-codebase-architecture`, `codebase-design` |

### Library docs

Use the **Context7 MCP** (`.mcp.json`) for Next.js 16, React 19, Vite 8, Tailwind 4, TanStack Query/Router, openapi-fetch at the versions in the lockfile — APIs changed recently; do not rely on memory.
