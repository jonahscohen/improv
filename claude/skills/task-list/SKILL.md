---
name: task-list
description: Manage a forward-looking TASKS.md. Triggers on `/task-list <verb>` where verb is add, list, done, edit, remove, block, unblock, or show. Project-aware - operates on the current project repo's own TASKS.md, falling back to the global dotfiles TASKS.md when inside the dotfiles repo or no repo. Forward-looking layer above sprint memory.
---

# /task-list skill

A forward-looking task list that is **project-aware**: when you are inside a project
repo it uses that repo's own `TASKS.md`; when you are inside the dotfiles repo (or no
repo) it uses the global dotfiles list. Sprint memory remains the backward-looking record.

## Target file

Resolve the target `TASKS.md` from the current working directory, then operate **only** on
that one file:

1. **Project-local mode.** Run `git rev-parse --show-toplevel` from cwd. If it succeeds and
   the repo root is **not** the dotfiles repo (`~/Documents/Github/claude-dotfiles`), the
   target is `<repo-root>/TASKS.md`. This is the normal case when working inside any project
   repo (e.g. `yes-kaufmanrossin`). Tasks live with the project and travel with its git
   history, so teammates on that repo share them.
2. **Global mode.** Otherwise - cwd is inside the dotfiles repo, or not inside any git repo -
   the target is the global dotfiles list `~/Documents/Github/claude-dotfiles/TASKS.md`.

Never operate on a `TASKS.md` other than the resolved target. If the target file does not
exist, create it from the matching template below before performing any verb.

### Templates

**Global mode** (dotfiles, areas enabled):

```markdown
# Dotfiles tasks

<!-- Managed by /task-list skill. Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0000 -->

```

**Project-local mode** (one repo, one list, no areas):

```markdown
# <repo-name> tasks

<!-- Managed by /task-list skill (project-local). Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0000 -->

### Active

```

where `<repo-name>` is the basename of the repo root.

## Modes and areas

- **Global mode** keeps the `## <area>` layer (known areas: `sidecoach`, `improv`,
  `marketing-site`, `test-site-1`, `dotfiles`, plus any existing `## <name>` section), with
  cwd-path inference and new-area confirmation, exactly as the `add` verb describes.
- **Project-local mode** has **no** `## <area>` layer - a single repo is a single list. The
  sub-sections (`### Active`, `### Blocked`, `### Done`) live at the **top level** of the
  file. `add` skips all area parsing/inference/confirmation and appends under the top-level
  `### Active`. Every other verb finds a task by ID and moves it between the top-level
  sub-sections.

The ID counter `<!-- Last ID: T-NNNN -->` is **per-file**: each repo's `TASKS.md` keeps its
own independent T-NNNN sequence.

## Verbs

### `add` - `/task-list add [area] [P#] <description>`

0. **Resolve target + mode** (see "Target file"). In **project-local mode**, skip steps 1-2
   entirely; the destination is the top-level `### Active`. Continue at step 3.
1. **(global mode only) Determine area.** Parse the first whitespace-delimited token as
   `[area]` only if it matches a known area name (`sidecoach`, `improv`, `marketing-site`,
   `test-site-1`, `dotfiles`) or matches an existing `## <name>` section in the file.
   Otherwise the whole arg string is the description and area is inferred from cwd:
   - cwd path contains `/sidecoach` -> `sidecoach`
   - cwd path contains `/improv` -> `improv`
   - cwd path contains `/marketing-site` -> `marketing-site`
   - cwd path contains `/test-site-1` -> `test-site-1`
   - anything else -> `dotfiles`
2. **(global mode only) New area confirmation.** If the chosen area does not already appear
   as `## <area>` in the file AND is not one of the known names above, confirm via
   AskUserQuestion before creating the section ("Create new area `<name>`?" with options
   Yes / cancel / pick existing).
3. **Determine priority.** If the user passed `[P0]`, `[P1]`, `[P2]`, or `[P3]`, use it.
   Default `P2`.
4. **Read** the target file.
5. **Get next ID.** Find `<!-- Last ID: T-NNNN -->`. Increment to `T-(NNNN+1)`, zero-padded
   to 4 digits.
6. **Locate or create the destination.**
   - Global mode: the area's `## <area>` section (alphabetically ordered against existing
     areas), and within it `### Active`.
   - Project-local mode: the top-level `### Active`.
   The `<!-- Last ID: T-NNNN -->` comment always lives at the top of the file.
7. **Append the task line** at the end of the destination `### Active`:
   ```
   - [ ] T-NNNN [P#] YYYY-MM-DD <description>
   ```
   where YYYY-MM-DD is today.
8. **Update the comment** to `<!-- Last ID: T-NNNN -->` with the new ID.
9. **Report:** `Added T-NNNN to <target> (P#): <description>` where `<target>` is the area
   (global) or the repo name (project-local).

### `list` - `/task-list list [area] [--done] [--blocked] [--p0|--p1|--p2|--p3]`

1. Resolve target + mode. Read the file.
2. Filter:
   - Global mode: if `area` given, restrict to that area's section.
   - Default status is `### Active`. `--done` shows only Done. `--blocked` shows only Blocked.
   - If `--p#` given, keep only lines whose priority tag matches.
3. Render as plain text. Group by area when more than one area is shown (global); in
   project-local mode there is a single flat list. Preserve sub-section headers; one task
   per line.

### `done` - `/task-list done T-NNNN`

1. Resolve target. Find the line whose third whitespace-delimited token equals `T-NNNN`.
2. **Not found:** error with `T-NNNN not found. Closest IDs: <up-to-3 nearest used IDs>.`
3. Flip the checkbox: `- [ ]` -> `- [x]`.
4. Append ` (done YYYY-MM-DD)` if not already present.
5. Move the line to the enclosing `### Done` sub-section (the area's in global mode, the
   top-level one in project-local mode; create it if missing, as the last sub-section -
   after `### Blocked` if present, otherwise after `### Active`).
6. If the source sub-section is now empty, drop the header.

### `edit` - `/task-list edit T-NNNN [P#] [<new description>]`

1. Resolve target. Find the line. Not found -> same error as `done`.
2. If the args include `[P#]`, replace the priority tag.
3. If the args include a description string, replace the description (everything after the
   created date, up to but not including trailing tags like `[sprint-NN]`, `[BLOCKED: ...]`,
   or `(done ...)`). If no trailing tags are present, the description runs to end-of-line.
4. Preserve checkbox, ID, created date, and all trailing tags.

### `remove` - `/task-list remove T-NNNN`

1. Resolve target. Find the line. Not found -> same error as `done`.
2. Delete the line entirely.
3. If the resulting sub-section is empty, drop the sub-header. If (global mode) the resulting
   area section is empty, drop the area `## <area>` header too.

### `block` - `/task-list block T-NNNN <reason>`

1. Resolve target. Find the line. Not found -> same error as `done`.
2. Append ` [BLOCKED: <reason>]` if no `[BLOCKED: ...]` is present; otherwise replace it.
3. Move the line to the enclosing `### Blocked` sub-section (create it if missing, between
   `### Active` and `### Done`).

### `unblock` - `/task-list unblock T-NNNN`

1. Resolve target. Find the line. Not found -> same error as `done`.
2. Strip the trailing `[BLOCKED: ...]` tag.
3. Move the line back to `### Active`.
4. If `### Blocked` is now empty, drop the header.

### `show` - `/task-list show`

Resolve the target file, then run, via Bash: `cmux open <resolved-target-path>`. Report
`Opened <target-path> in cmux.`

## Sub-section ordering

Within each section (a `## <area>` in global mode, or the file top level in project-local
mode), sub-sections appear in this order when present (omit when empty):

1. `### Active`
2. `### Blocked`
3. `### Done`

## Line schema (strict)

`- [ ] T-NNNN [P#] YYYY-MM-DD <description>[ <optional trailing tags>]`

Optional trailing tags, any order, space-separated:
- `[sprint-NN]` - links to a sprint memory file.
- `[BLOCKED: <reason>]` - present only when the line is in `### Blocked`.
- `(done YYYY-MM-DD)` - present only when the line is in `### Done`.

Checkbox is `- [x]` for done; `- [ ]` otherwise.

## Hand-edit recovery

The skill re-reads the file on every invocation; hand-edits are always honored. The only
structural invariant: `Last ID` >= max used `T-NNNN` in that file. If a hand-edit violates
this (e.g. the user pasted in `T-9999` directly), the next `add` resets `Last ID` to
`max_used + 1` and warns once: `Last ID was stale; reset to T-(max_used+1).`

## Out of scope

- Operating on any `TASKS.md` other than the one resolved for the current cwd (the project
  repo's file in project-local mode, or the dotfiles global file in global mode).
- Git operations (push, pull, conflict resolution). Git is the user's job.
- Free-form `#tags`, due dates, estimates, assignment. Hand-edit if you need more.
- A `tasks` shell binary alongside the skill.
