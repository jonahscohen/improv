---
name: /task-list skill spec drafted
description: Brainstorm + spec for a global, root-level, git-synced task list skill driving TASKS.md at the dotfiles repo root
type: project
relates_to: [tasks_2026-05-21.md]
---

Collaborator: Jonah

Brainstormed `/task-list` skill with Jonah on 2026-05-25. Spec lives at `docs/superpowers/specs/2026-05-25-task-list-design.md`.

## Decisions locked in

- **Storage:** single `TASKS.md` at dotfiles repo root, committed to git.
- **Organization:** `## <area>` top-level, `### Active / Blocked / Done` sub-headers. Empty sub-headers omitted.
- **Verbs:** add, list, done, edit, remove, block, unblock, show. Full set, not minimal.
- **Sync:** git, single-user across machines. No multi-human assignment.
- **Schema per line:** checkbox, `T-NNNN`, `[P#]`, created date, description; optional trailing `[sprint-NN]`, `[BLOCKED: reason]`, `(done YYYY-MM-DD)`.
- **Defaults:** area inferred from cwd subdir; priority P2 when omitted; ID monotonic `T-NNNN` tracked via `<!-- Last ID: T-NNNN -->` comment.
- **Skill location:** global at `~/.claude/skills/task-list/SKILL.md`, installed by dotfiles `install.sh`.
- **Forward vs backward:** TASKS.md is forward-looking; sprint memory stays the backward-looking record. Tasks reference sprints via `[sprint-NN]`; sprint closed-memory references task IDs in prose.

## Rejected / deferred

- Free-form `#tags` (priority + area + sprint enough for now).
- Multi-human assignment.
- Due dates / estimates.
- Standalone `tasks` shell CLI binary.

## Spec self-review fixes

- Skill-location section originally said "walks up from cwd to find the nearest TASKS.md" - that would have picked up unrelated TASKS.md files in other repos. Tightened to **always operates on `~/Documents/Github/claude-dotfiles/TASKS.md`**; cwd is used only for area inference. Matches Jonah's intent ("for the dotfiles").

## Spec approved + committed

Jonah approved 2026-05-25. Committed as `9871ea1` (spec + memory only; other dirty files in working tree left untouched).

## Plan written

Plan at `docs/superpowers/plans/2026-05-25-task-list-skill.md`. Four tasks:

1. Seed `TASKS.md` skeleton at repo root.
2. Write `claude/skills/task-list/SKILL.md` (the full verb spec embedded in the plan).
3. Wire `install.sh` (10 touch-points modeled on the `reflect` component, all referenced by line number).
4. Smoke-test each of the 8 verbs in a fresh Claude session, with expected file diffs documented per step.

Recon used to write the plan: `reflect` component pattern in `install.sh` (lines 18, 55, 68, 83, 109-110, 126, 213, 234, 556, 889-892, 908, 2186-2208, 2298).

Next step: choose execution mode (subagent-driven vs inline) per writing-plans handoff.

## Task 1 complete

TASKS.md skeleton seeded at repo root (Last ID: T-0000).

## Task 2 complete

SKILL.md written at claude/skills/task-list/SKILL.md (123 lines). Verification passed: correct head/tail, line count >100, zero emdashes, no self-attribution. Ready for commit.
