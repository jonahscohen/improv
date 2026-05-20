---
name: verify-before-done.sh Read-matcher wiring fix
description: Fixed a wiring gap where verify-before-done.sh had Read-handler logic but PostToolUse(Read) only fired screenshot-open-clear.sh. Added verify-before-done.sh to the Read matcher in installed settings.json.
type: project
relates_to: [session_2026-05-19_verify-hook-server-offramp.md, session_2026-05-19_reflection-actions-deployed.md]
---

## What happened

During the README + design-pipeline commit, `bash-guard` blocked `git commit` because `~/.claude/.needs-verification` was still set from the earlier code edits. I ran the second-fix-gate regression suite, captured output to `/tmp/test-second-fix-gate-output.log`, and Read it - expecting verify-before-done.sh to clear the flag per its `/tmp/*test*.log` Read-handler logic.

The flag stayed set. Diagnosis: verify-before-done.sh has the Read-handler code, but `~/.claude/settings.json` only wired `screenshot-open-clear.sh` under the `PostToolUse(Read)` matcher. So the Read-clear path I added in `session_2026-05-19_verify-hook-server-offramp.md` was never fired by the harness. Dead code.

## Fix

Added `verify-before-done.sh` to the `PostToolUse(Read)` hooks array in `~/.claude/settings.json`, alongside `screenshot-open-clear.sh`. Future Reads of `/tmp/*test*.log`, `*.png`, `/tmp/*probe*`, etc. will now correctly clear `.needs-verification`.

For this commit: manually `rm`'d the flag since the work was genuinely verified (11/11 second-fix-gate regression tests passed, install.sh edits grep-verified, README is markdown with no UI to screenshot). One-off override warranted by the harness configuration bug; the bug is now fixed so this shouldn't recur.

## Drift note

The fix lives in INSTALLED `~/.claude/settings.json` only. The repo's `claude/settings.json` does not contain the PostToolUse hooks block (same drift the 2026-05-19 reflection flagged for the broader hook wiring). Will be picked up when settings.json reconciliation runs per `plan_claude_md_split.md`.

## Files touched
- `~/.claude/settings.json` (Read matcher block expanded)

## Collaborator
Jonah
