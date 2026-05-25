---
name: task-list
description: Manage the dotfiles TASKS.md. Triggers on `/task-list <verb>` where verb is add, list, done, edit, remove, block, unblock, or show. Always operates on `~/Documents/Github/claude-dotfiles/TASKS.md` only; never touches TASKS.md files in other repos. Forward-looking layer above sprint memory.
---

# /task-list skill

A global, dotfiles-only task list. The single source of truth for "things to do" across every subproject in the dotfiles repo. Forward-looking; sprint memory remains the backward-looking record.

## Target file

**Always and only:** `~/Documents/Github/claude-dotfiles/TASKS.md`.

Do not pick up `TASKS.md` files in other repos. If the dotfiles file does not exist, create it before performing any verb:

```markdown
# Dotfiles tasks

<!-- Managed by /task-list skill. Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0000 -->

```

## Verbs

### `add` - `/task-list add [area] [P#] <description>`

1. **Determine area.** If the user passed an area arg, use it. Otherwise infer from cwd:
   - cwd path contains `/sidecoach` -> `sidecoach`
   - cwd path contains `/improv` -> `improv`
   - cwd path contains `/marketing-site` -> `marketing-site`
   - cwd path contains `/test-site-1` -> `test-site-1`
   - anything else -> `dotfiles`
2. **New area confirmation.** If the chosen area does not already appear as `## <area>` in the file AND is not one of the known names above, confirm via AskUserQuestion before creating the section ("Create new area `<name>`?" with options Yes / cancel / pick existing).
3. **Determine priority.** If the user passed `[P0]`, `[P1]`, `[P2]`, or `[P3]`, use it. Default `P2`.
4. **Read** the target file.
5. **Get next ID.** Find `<!-- Last ID: T-NNNN -->`. Increment to `T-(NNNN+1)`, zero-padded to 4 digits.
6. **Locate or create** the area's `## <area>` section, alphabetically ordered against existing areas. Within it, locate or create `### Active`.
7. **Append the task line** at the end of `### Active`:
   ```
   - [ ] T-NNNN [P#] YYYY-MM-DD <description>
   ```
   where YYYY-MM-DD is today.
8. **Update the comment** to `<!-- Last ID: T-NNNN -->` with the new ID.
9. **Report:** `Added T-NNNN to <area> (P#): <description>`.

### `list` - `/task-list list [area] [--done] [--blocked] [--p0|--p1|--p2|--p3]`

1. Read the file.
2. Filter:
   - If `area` given, restrict to that area's section.
   - Default status is `### Active`. `--done` shows only Done. `--blocked` shows only Blocked.
   - If `--p#` given, keep only lines whose priority tag matches.
3. Render as plain text. Group by area when more than one area is shown; preserve sub-section headers; one task per line.

### `done` - `/task-list done T-NNNN`

1. Find the line containing ` T-NNNN ` (with surrounding spaces, anchored).
2. **Not found:** error with `T-NNNN not found. Closest IDs: <up-to-3 nearest used IDs>.`
3. Flip the checkbox: `- [ ]` -> `- [x]`.
4. Append ` (done YYYY-MM-DD)` if not already present.
5. Move the line to the area's `### Done` sub-section (create it if missing, immediately after `### Active` / `### Blocked`).
6. If the source sub-section is now empty, drop the header.

### `edit` - `/task-list edit T-NNNN [P#] [<new description>]`

1. Find the line. Not found -> same error as `done`.
2. If the args include `[P#]`, replace the priority tag.
3. If the args include a description string, replace the description (everything after the created date, up to but not including trailing tags like `[sprint-NN]`, `[BLOCKED: ...]`, or `(done ...)`).
4. Preserve checkbox, ID, created date, and all trailing tags.

### `remove` - `/task-list remove T-NNNN`

1. Find the line. Not found -> same error as `done`.
2. Delete the line entirely.
3. If the resulting sub-section is empty, drop the sub-header. If the resulting area section is empty, drop the area `## <area>` header too.

### `block` - `/task-list block T-NNNN <reason>`

1. Find the line. Not found -> same error as `done`.
2. Append ` [BLOCKED: <reason>]` if no `[BLOCKED: ...]` is present; otherwise replace the existing tag.
3. Move the line to the area's `### Blocked` sub-section (create it if missing, between `### Active` and `### Done`).

### `unblock` - `/task-list unblock T-NNNN`

1. Find the line. Not found -> same error as `done`.
2. Strip the trailing `[BLOCKED: ...]` tag.
3. Move the line back to `### Active`.
4. If `### Blocked` is now empty, drop the header.

### `show` - `/task-list show`

Run, via Bash: `cmux open /Users/spare3/Documents/Github/claude-dotfiles/TASKS.md`. Report `Opened TASKS.md in cmux.`

## Sub-section ordering

Within each `## <area>` section, sub-sections appear in this order when present (omit when empty):

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

The skill re-reads the file on every invocation; hand-edits are always honored. The only structural invariant: `Last ID` >= max used `T-NNNN`. If a hand-edit violates this (e.g. the user pasted in `T-9999` directly), the next `add` resets `Last ID` to `max_used + 1` and warns once: `Last ID was stale; reset to T-(max_used+1).`

## Out of scope

- Operating on TASKS.md files outside the dotfiles repo.
- Git operations (push, pull, conflict resolution). Git is the user's job.
- Free-form `#tags`, due dates, estimates, assignment. Hand-edit if you need more.
- A `tasks` shell binary alongside the skill.
