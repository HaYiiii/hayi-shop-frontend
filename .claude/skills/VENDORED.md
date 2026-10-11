# Vendored agent skills

Skills are copied from upstream at a **pinned commit**, reviewed before use, and updated only through a PR (Decision J3).
Project-specific deviations are appended as a **"HaYi overrides"** section in the skill, or listed below.
Reviewed 2026-10-11: no network fetches, no remote code execution, no instructions outside the skill's purpose.

| Skills | Source @ commit | License | Local changes |
|---|---|---|---|
| `grill-with-docs`, `grilling`, `domain-modeling`, `tdd`, `diagnosing-bugs`, `improve-codebase-architecture`, `codebase-design`, `code-review`, `to-tickets`, `setup-matt-pocock-skills` | [mattpocock/skills](https://github.com/mattpocock/skills) @ `49dd158d1076` | MIT (`_licenses/mattpocock-skills.LICENSE`) | Removed Codex-only `agents/openai.yaml`. Repo config in `docs/agents/` instead of running `setup-matt-pocock-skills`. |
| `vercel-react-best-practices`, `vercel-composition-patterns` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) @ `063bee94c3f4` (`skills/react-best-practices`, `skills/composition-patterns`) | MIT (declared in each SKILL.md) | Folder renamed to match the skill `name`. Content unchanged. |
| `web-design-guidelines` | Rules: [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) @ `434b7f913646` `command.md` → `guidelines.md` | MIT (`_licenses/web-interface-guidelines.LICENSE`) | `SKILL.md` is HaYi-written: reads the pinned `guidelines.md` instead of fetching rules from GitHub on every run; Vietnamese copy overrides. |
| `grill-with-ui` | [jasonku09/grill-with-ui](https://github.com/jasonku09/grill-with-ui) @ `c8f699d3dd99` | MIT (`_licenses/grill-with-ui.LICENSE`) | Kept `SKILL.md`, `server.mjs`, `page.html`, `visual-brief.md`; dropped upstream demo images. Server binds 127.0.0.1 only and writes to `~/.grill-with-ui`. |

## Updating

1. Diff the upstream folder between the pinned commit and the new one.
2. Review for scope creep, network/exec instructions and conflicts with canonical decisions.
3. Copy, re-apply local changes, update the commit hash here, open a PR.
