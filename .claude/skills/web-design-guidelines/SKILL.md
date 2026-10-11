---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance (accessibility, focus, forms, animation, typography, content, images, performance, navigation, touch, i18n, hydration). Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or before marking an FE ticket done.
argument-hint: <file-or-pattern>
---

# Web Interface Guidelines (HaYi pinned copy)

Rules are vendored in [guidelines.md](guidelines.md) from `vercel-labs/web-interface-guidelines` (MIT, pinned commit — see `.claude/skills/VENDORED.md`).
Do **not** fetch rules from the network; the upstream skill's live fetch was removed so rule changes go through review.

1. Read the files given as argument (ask which files if none were given).
2. Check them against every rule in `guidelines.md`.
3. Output findings in the `file:line` format defined at the end of `guidelines.md`.

## HaYi overrides

- UI copy is **Vietnamese**: use sentence case for headings and buttons (not Title Case); keep `…` and curly quotes rules.
- Money/time must go through `@hayi/domain-utils` (`formatVnd`, `formatBranchTime`), which satisfies the `Intl.*` rules.
- Customer Web is mobile-first: check safe areas, touch targets and `inputmode` (phone numbers use `type="tel"`).
