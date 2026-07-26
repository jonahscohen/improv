---
name: verify-before-done.sh transient hook error (concurrent live-edit apostrophe leak)
description: A PostToolUse Edit fired verify-before-done.sh mid-concurrent-edit; an apostrophe in a comment closed the python3 -c string early (IndentationError + bash token error). File is now valid on disk - transient, no durable fix needed.
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: bash -n + python ast.parse both clean
confidence: high
---

Logged per the Hook Error Response Protocol (a hook error surfaced in context, so it gets root-caused + recorded in the same turn).

## The error (surfaced on a MEMORY.md Edit)

`~/.claude/hooks/verify-before-done.sh` blocked with:
- `IndentationError: expected an indented block after function definition on line 737` (in the embedded `<string>`), caret on `# sidechain edit can land on the PARENT sessions`.
- `bash: line 768: syntax error near unexpected token '"{}"'` on `print("{}"); sys.exit(0)`.

## Root cause (Debugging Protocol)

The whole hook body is one single-quoted `printf '%s' "$INPUT" | python3 -c '...'` string (opens L25, closes L863). Invariant, documented in the file itself (L47-48, L720, L767): NO literal apostrophe anywhere inside, or it closes the string early and leaks the rest into bash. The bash error `syntax error near '"{}"'` is the signature of exactly that leak - bash tried to execute the trailing python `print("{}"); sys.exit(0)` as a shell command.

Delta between working and broken: a CONCURRENT session was live-editing this hook to add the `arm_and_report` subagent guard (`if IS_SUBAGENT: print("{}"); sys.exit(0)`, comment stamped "Jonah 2026-07-26"). My Edit fired the PostToolUse hook at the instant the new comment still read "...land on the PARENT sessions" and carried an apostrophe that closed the `-c '` string. It has since been reworded to "PARENT session key" with the apostrophe removed.

## Verification - already fixed on disk, no durable action needed

Current on-disk state is valid:
- `bash -n ~/.claude/hooks/verify-before-done.sh` -> exit 0 (quoting balanced, no leak).
- Extracted embedded python (L26-862, 837 lines) -> `ast.parse` OK.
- No apostrophes in the L760-770 subagent-guard region.

So there is NO persistent defect to fix - the concurrent editor already re-applied the file's own no-apostrophe invariant. Deploying an agent to "fix" an already-valid hook would be wrong and would race the concurrent session. My own primary-task artifacts (reference/DESIGN.md fix, the sprint3 resolution beat, the MEMORY.md index line) all persisted - a PostToolUse block runs after the edit applies, so nothing was lost.

## Takeaway for future sessions

If verify-before-done.sh (or any `python3 -c '...'` hook) throws an IndentationError paired with a bash `syntax error near unexpected token` on a python literal, suspect a leaked apostrophe from a concurrent live-edit before assuming a persistent bug. Reproduce with `bash -n` + an `ast.parse` of the extracted block; if both pass, it was transient.

## Files touched
None (investigation only; the hook was already valid on disk).
