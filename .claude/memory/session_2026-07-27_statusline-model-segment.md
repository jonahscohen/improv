---
name: statusline model segment
description: Status bar line 1 now leads with the active model name and version (model.display_name, id fallback), at the same level as project/dir/branch
type: project
superseded_by: session_2026-07-27_statusline-two-line-layout.md
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: replayed a real captured statusline payload + 4 edge-case payloads through the script
confidence: high
---

Jonah asked for the CLI status bar to show which model and version number the session is
running on, prioritized at the same exact level as `project`, `dir`, and `branch`.

## Change

`claude/statusline-command.sh` line 1 now renders:

    model Opus 5 (1M context)  |  project <name>  dir <name>  |  branch <name> +14 -4

- New `model_name=$(echo "$input" | jq -r '.model.display_name // .model.id // empty')`.
- New leading segment styled identically to the others (`\033[1;36m` bold cyan on a
  lowercase label), so it carries the same visual weight rather than reading as metadata.
- The `project` segment now emits a `\033[90m|\033[0m` separator only when something
  precedes it, so a payload with no `model` key degrades to the exact previous line.

## Why the payload shape is known, not guessed

Temporarily teed the statusline's stdin to `/tmp/claude-statusline-payload.json`, let the
live status bar render once, then removed the tee. The real payload's top-level keys are:
`context_window, cost, cwd, effort, exceeds_200k_tokens, fast_mode, model, output_style,
prompt_id, rate_limits, session_id, session_name, thinking, transcript_path, version,
workspace`. `model` is `{"id": "claude-opus-5[1m]", "display_name": "Opus 5 (1M context)"}`.

`display_name` already carries both the name and the number, so no string assembly is
needed. Worth knowing for future statusline work: `effort`, `fast_mode`, and `thinking`
are also live keys on this payload and are currently unused by the script.

## Codex finding, folded

Codex (`codex-cli 0.142.5`) caught one real defect in the first pass: `dir` was written to
pair with `project` using two spaces, so once `model` led the line, a payload with a model
and a dir but NO project rendered `model …  dir …` with no gray separator between two
segments that are not a pair. Fixed with a `has_project` flag - `dir` takes the two-space
pairing only when project actually preceded it, and the `|` separator against any other
neighbour. Re-verified across all 7 combinations, not just the flagged line.

## Incidental fix

The old first segment was `line1=$(printf '%b' "project ...")`, which pre-interpreted
escapes inside a command substitution and then hit the final `printf '%b'` a second time -
a double-interpretation the other segments never had. It is now a plain assignment like
every other segment, so all backslash handling happens once, at output.

## Verification

- `sh -n` clean.
- Real captured payload replayed: renders `model Opus 5 (1M context)` in bold cyan ahead
  of project/dir/branch, usage line unchanged.
- Edge cases, all correct: payload with no `model` key (old line, no orphan separator);
  model with no project/dir; `display_name` absent so `id` is used; a `display_name`
  containing `$(whoami)` and backticks (printed literally, no expansion).
- Codex re-review after the fix: NO DEFECTS. It independently exercised all 16
  empty/non-empty combinations of model/project/dir/branch and ran `shellcheck -s sh`
  clean.
- `bash claude/hooks/test-installer-manifest.sh` -> PASS (no new file, manifest unchanged).

## Lead re-verification (2026-07-27, Jonah re-asked)

Re-ran the live script (`bash claude/statusline-command.sh` fed a real-shape payload) from a
separate session. Renders:

    model Opus 5 (1M context)  |  project improv  dir improv  |  branch main +23 -5

`~/.claude/statusline-command.sh` is a symlink to this repo file, and Claude Code re-invokes
the statusLine command on every render, so the change is live with no restart. Still
uncommitted on `main`.

## Files touched

- `claude/statusline-command.sh`
