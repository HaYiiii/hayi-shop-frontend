---
name: ticket
description: Work a HaYi Shop GitHub issue end-to-end (pick → gate checks → plan → TDD → PR → In Review), or review a PR against the repo standards and its ticket. Use when the user types /ticket, "/ticket <n>", "/ticket review <pr>", or says "làm issue #n" / "review PR #n".
argument-hint: "[<issue-number> | review <pr-number>]"
---

# /ticket — HaYi Shop ticket workflow (frontend)

One command replaces the long per-issue prompt. Reply to the user in **Vietnamese**; code, commits and PR text in English.

Board helper (exact board operations — never hand-build `gh project` commands):

```bash
python3 scripts/board.py wip [--check]        # In Progress across the project (limit 3)
python3 scripts/board.py ready                # Ready items in this repo + open blockers
python3 scripts/board.py show <issue>         # status, labels, milestone, open blockers
python3 scripts/board.py status <issue> "<Status>"   # Backlog | Ready | In Progress | In Review | Done
```

Modes from the arguments:

| Arguments | Mode |
|---|---|
| *(none)* | **Pick** → then Work |
| `<n>` | **Work** issue `#n` |
| `review <pr>` | **Review** pull request `#pr` |

---

## Mode: Pick

1. Run `board.py wip`. If 3 items are In Progress, list them and stop: suggest finishing or handing one back.
2. Run `board.py ready`. Recommend the **unblocked** item that unblocks the most other work (look at the epic and the blockers of Backlog items); show the top 3 with one line each.
3. Wait for the user to choose, then continue with **Work**.

## Mode: Work `<n>`

### 1. Load context (no edits yet)

- `CLAUDE.md` is already loaded. Read `docs/agents/issue-tracker.md` and `docs/agents/domain.md`.
- `gh issue view <n> --comments`: read **What to build**, **Acceptance criteria**, **Canonical refs**, **Seams under test** and every comment.
- Read every canonical section listed under *Canonical refs* (canonical docs path is in `docs/agents/domain.md`). Read the parent epic if there is one.
- Skim the code areas the ticket touches.

### 2. Gate checks — stop and report if any fails

- [ ] Issue is open and on the board (`board.py show <n>`).
- [ ] No open blockers.
- [ ] `board.py wip --check` passes, unless this issue is already In Progress.
- [ ] Working tree is clean and `main` is up to date (`git status`, `git fetch`). Never discard someone else's uncommitted work.
- [ ] Ticket is unambiguous against the canonical docs. If not: list the questions and stop.
- [ ] **Design gate (Decision J5):** a ticket that builds or changes a screen links an **approved** design (Artifact). No approved design → stop. Design tickets (`type:design`) are worked in the general planning chat, not here.
- [ ] Backend endpoints the ticket needs exist in `../hayi-shop-backend/api-spec/*.yaml` (or the BE ticket that adds them is Done).

### 3. Start

```bash
python3 scripts/board.py status <n> "In Progress"
git switch -c feature/<n>-<short-slug> origin/main
```

### 4. Plan — **wait for approval**

Present in Vietnamese, briefly:

- What will be built (one paragraph, from the user's perspective).
- Apps / packages / feature folders / routes touched, respecting `CLAUDE.md` architecture rules; which design screens are implemented.
- The seams under test (from the ticket) and the test list, one line each.
- Risks, assumptions, open questions.

**Stop and wait for the user's go-ahead.** Do not write code before approval.

### 5. Implement

- Follow the `tdd` skill: red → green, one seam at a time (Vitest + Testing Library; Playwright for the slice happy path).
- API types come only from `pnpm generate:api`; never hand-write request/response types. A missing endpoint is a backend ticket, not a frontend workaround.
- Apply `vercel-react-best-practices` and `vercel-composition-patterns` while writing components; use tokens/components from `packages/ui` only (match the approved design).
- Use **Context7** for Next.js 16 / React 19 / Vite 8 / Tailwind 4 / TanStack APIs.
- Stay inside the ticket scope. Anything else worth doing → note it for the summary (candidate ticket), do not do it.
- If the code would contradict the canonical docs, stop and ask.
- Commit in small Conventional Commits (`feat(backoffice-web): …`).

### 6. Verify

```bash
pnpm generate:api && pnpm typecheck && pnpm test && pnpm build
```

- [ ] Typecheck, tests and build green; generated API types unchanged or committed together with the matching backend spec.
- [ ] Run the `web-design-guidelines` skill on every changed UI file and fix all findings (or justify them in the PR).
- [ ] Compare the screens with the approved design (screenshots in the PR).
- [ ] Every acceptance criterion satisfied — show the evidence (test name or command output) for each.
- [ ] Definition of Done (canonical `IMPLEMENTATION-PLAN.md` §1.1) — go through all 8 points; mark N/A explicitly (e.g. FE points for a BE-only ticket).
- [ ] No secrets; no tokens in storage; money/time via `@hayi/domain-utils`.

### 7. Finish

1. Push the branch and open a PR with `.github/pull_request_template.md` filled in; body contains `Closes #<n>`.
2. Tick the acceptance-criteria checkboxes in the issue that are met (edit the issue body).
3. `python3 scripts/board.py status <n> "In Review"`.
4. Report to the user: PR link, CI status (`gh pr checks`), what was done, deviations, follow-up ticket candidates. Suggest `/ticket review <pr>` in a **fresh** session for an independent review.

Never merge the PR yourself unless the user explicitly asks.

---

## Mode: Review `<pr>`

Independent review of a PR before the user merges it. Read-only: do not push to the PR branch.

1. **Load:** `gh pr view <pr> --comments`, `gh pr diff <pr>`, `gh pr checks <pr>`; the linked issue (`Closes #n`) with its acceptance criteria, canonical refs and seams; the canonical sections it cites.
2. **Run the `code-review` skill** with the PR's merge-base as the fixed point, on its two axes:
   - **Standards:** `CLAUDE.md`, `docs/agents/*.md`, SOURCE-STRUCTURE §3 (apps import only packages, feature folders, all HTTP via `@hayi/api-client`, no tokens in storage, server-authoritative totals, Problem Details `code`), `vercel-react-best-practices`, `vercel-composition-patterns`.
   - **Spec:** every acceptance criterion and every canonical rule cited by the issue — is it implemented **and** tested at the agreed seams?
3. **Extra checks:** CI green; run `web-design-guidelines` on changed UI files; UI matches the approved design (design gate); a11y basics; Definition of Done §1.1 items.
4. **Report** in Vietnamese, grouped by severity:

   | Mức | Ý nghĩa |
   |---|---|
   | **Chặn merge** | Sai nghiệp vụ/contract, lệch design đã duyệt, lỗi a11y nặng, vi phạm kiến trúc, thiếu test cho acceptance criterion, CI đỏ, lộ secret |
   | **Nên sửa** | Chất lượng, đặt tên, test chưa ở đúng seam |
   | **Gợi ý** | Có thể làm sau / ticket mới |

   Each finding: `file:line` — problem — suggested fix. End with a verdict: **Approve** / **Request changes**.
5. Ask the user before posting anything to GitHub. If they agree, post the report as a PR review comment (`gh pr review <pr> --comment|--request-changes --body-file …`). Do not approve on GitHub on the user's behalf unless asked.
6. After the user merges: verify the issue closed and the board shows **Done** (`board.py show <n>`); set it with `board.py status <n> "Done"` if the project automation did not.
