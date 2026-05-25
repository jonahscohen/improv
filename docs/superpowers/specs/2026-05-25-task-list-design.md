---
title: /task-list skill design
date: 2026-05-25
collaborator: Jonah
status: approved-for-planning
---

# /task-list skill design

A global, repo-root, git-synced task list for the dotfiles repo, callable as `/task-list <verb> ...`. Forward-looking layer; sprint memory remains the backward-looking layer.

## Goals

- One place to capture "things to do" across every subproject in the dotfiles repo (sidecoach, improv, marketing-site, test-site-1, dotfiles core).
- Low-ceremony capture: `/task-list add fix the scroll trap` from inside any subproject just works.
- Human-readable, git-diff-friendly, hand-editable.
- Cross-machine continuity via git, matching the rest of the dotfiles model.
- No duplication of detail with sprint memory files; tasks reference sprints, sprints reference task IDs.

## Non-goals

- Multi-human assignment / collaboration features. Single-user (Jonah) across machines.
- Rich UI. The file is the UI; the skill is a thin convenience layer.
- Replacing sprint memory or per-project planning docs.

## File layout

`TASKS.md` at dotfiles repo root, committed to git.

```markdown
# Dotfiles tasks

<!-- Managed by /task-list skill. Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0044 -->

## sidecoach
### Active
- [ ] T-0042 [P1] 2026-05-25 Wire validator-coverage CLI flag
- [ ] T-0044 [P2] 2026-05-25 Add reduced-motion smoke test [sprint-13]
### Blocked
- [ ] T-0050 [P1] 2026-05-25 Backfill memory index [BLOCKED: waiting on tooling decision]
### Done
- [x] T-0040 [P1] 2026-05-24 Sprint 12 dogfood verification (done 2026-05-24)

## improv
### Active
- [ ] T-0043 [P1] 2026-05-25 Fix property-panel scroll trap

## dotfiles
### Active
- [ ] T-0045 [P2] 2026-05-25 Audit hook layer for redundant checks
```

Areas are added on demand. Empty status sub-headers (e.g. no `### Blocked`) are omitted. The `Last ID` HTML comment near the top is the source of truth for ID assignment.

## Skill location

`~/.claude/skills/task-list/SKILL.md`, installed by the dotfiles `install.sh`. Global, so the slash command is available in every project, but it **always operates on `~/Documents/Github/claude-dotfiles/TASKS.md`** - it does not pick up unrelated `TASKS.md` files in other repos. cwd is used only for area inference (see below).

## Verbs

| Verb | Form | Behavior |
|---|---|---|
| `add` | `/task-list add [area] [P#] <desc>` | Appends to `## <area> > ### Active`. Area inferred from cwd if omitted; priority defaults to P2. ID auto-assigned from `Last ID` comment + 1. |
| `list` | `/task-list list [area] [--done] [--blocked] [--p1]` | Renders matching tasks. No args = all active across all areas. |
| `done` | `/task-list done T-0042` | Flips checkbox, moves the line from `### Active` to `### Done`, appends ` (done YYYY-MM-DD)`. |
| `edit` | `/task-list edit T-0042 <new desc>` or `edit T-0042 [P0]` | In-place edit of description or priority. |
| `remove` | `/task-list remove T-0042` | Deletes the line entirely. |
| `block` | `/task-list block T-0042 <reason>` | Moves the line to `### Blocked`, appends `[BLOCKED: <reason>]`. |
| `unblock` | `/task-list unblock T-0042` | Moves the line back to `### Active`, strips the `[BLOCKED: ...]` suffix. |
| `show` | `/task-list show` | `cmux open <abs-path>/TASKS.md` in a cmux pane. |

## Smart defaults

- **Area inference:** cwd inside `sidecoach/` resolves to area `sidecoach`. Same for `improv/`, `marketing-site/`, `test-site-1/`. Any other location inside the dotfiles repo (including the root) resolves to `dotfiles`. If the user passes a new area name, the skill confirms via AskUserQuestion before creating the section.
- **ID assignment:** monotonic `T-NNNN` across the whole file, never reused. The `Last ID:` HTML comment is read, incremented, written back.
- **Priority:** `P2` when omitted. Valid values: `P0` (drop everything), `P1`, `P2`, `P3`.
- **Created date:** today, derived from session context.
- **Completed date:** appended only by `done`, in the form `(done YYYY-MM-DD)`.

## Relationship to sprint memory

TASKS.md is the **forward-looking** layer: things to do.
Sprint memory files are the **backward-looking** layer: what was done and why.

When a task closes inside a sprint, `/task-list done T-0042` records the completion in TASKS.md, and the sprint closed-memory file links back via the `[sprint-NN]` tag on the original task line. No duplication: TASKS.md says *what*; the sprint memory says *how* and *why*.

## Schema (per task line)

Required fields, in order:

1. Checkbox: `- [ ]` (active or blocked) or `- [x]` (done).
2. ID: `T-NNNN`.
3. Priority tag: `[P0]`, `[P1]`, `[P2]`, or `[P3]`.
4. Created date: `YYYY-MM-DD`.
5. Description: free text until end of line, except trailing tags.

Optional trailing tags (any order, space-separated):

- `[sprint-NN]` - links task to a sprint where it was planned or closed.
- `[BLOCKED: <reason>]` - present only when the task is in `### Blocked`.
- `(done YYYY-MM-DD)` - appended only on `### Done` lines.

## Edge cases

- **Merge conflicts on `Last ID`:** two machines add a task with the same ID before pulling. Resolution: git conflict; the later push fails, the user pulls, and the skill renumbers on next add. Practically rare because each machine increments locally before pushing.
- **Hand edits:** always allowed. The skill re-reads the file on every invocation and trusts whatever's there. Only structural invariant: the `Last ID` comment value must be greater than or equal to the highest used ID in the file. If a hand-edit violates this, the skill warns once on the next add but proceeds by setting `Last ID` to `max(used) + 1`.
- **ID not found:** `done T-9999` against a missing ID returns an error listing the nearest matching IDs.
- **Area typo:** `add sidecaoch foo` is detected as a new area name and triggers an AskUserQuestion confirming whether to create the section or correct to an existing one.
- **No TASKS.md found:** skill creates one at the fallback path (dotfiles root) and warns.

## Installation

Added to `install.sh` as a new component. Components are installed in their declared order; this one slots in alongside the other `~/.claude/skills/*` installs. The skill ships as a single `SKILL.md` containing the verb table, smart defaults, and edge cases - the file IS the implementation contract; Claude executes the file ops directly per invocation.

## Out of scope (explicit YAGNI)

- Free-form tags (`#bug`, `#refactor`). Defer until priority + area + sprint linkage prove insufficient.
- Multi-human assignment. Single-user repo.
- Estimates, due dates. Sprint memory tracks completion; estimates haven't been needed.
- A `tasks` shell CLI binary alongside the skill. The skill is enough; a binary is premature.
