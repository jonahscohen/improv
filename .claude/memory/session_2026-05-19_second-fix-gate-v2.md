---
name: second-fix-gate v2 - false-positive refinements
description: Refined second-fix-gate.sh to warn at most once per file per window, suppress additive edits, add manual override; 11/11 smoke tests pass
type: project
relates_to: [session_2026-05-19_second-fix-gate-hook.md, session_2026-05-19_fontshare-reference-skill.md, reflection_2026-05-19.md]
---

## Why v2

The v1 hook (shipped earlier today) warned on every chained edit that hit the same file or directory. Real-world result during the fontshare-reference task: 3 warnings fired across 5 sequential install.sh edits, all of which were additive parts of ONE coherent change (wiring a new skill into 5 spots). The gate couldn't distinguish:

- **True positive (warn)**: edit-fix-on-same-file-while-needs-verification-still-set
- **False positive (silent)**: edit-N-times-as-part-of-one-additive-change

## v2 changes

1. **WARN AT MOST ONCE per file per 10-min window.**
   Per-file flag `~/.claude/.fix-gate-warned-<sha1[:12]>` written when warning fires; subsequent edits to the same file within the window see the flag and stay silent.

2. **SUPPRESS pure-additive Edit/MultiEdit.**
   For Edit: if `new_string` contains `old_string` as a substring, the old content was preserved AND new content was wrapped around it - this is additive, not a fix attempt. For MultiEdit: every edit in the array must be additive for suppression. Write tool: can't tell from tool_input (no diff), so stays warn-eligible.

3. **MANUAL OVERRIDE flag** at `~/.claude/.suppress-fix-gate`.
   When the user knows they're doing a multi-file coherent task, `touch ~/.claude/.suppress-fix-gate` silences the gate entirely. Auto-expires after 30 minutes via mtime check so it can't be left on accidentally. Warning text now includes this instruction.

## Verification - 11/11 smoke tests pass

Test script at `claude/hooks/_tests/test-second-fix-gate.sh`. Uses a temp HOME so it doesn't pollute real `~/.claude` flags. Scenarios covered:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | First edit, no prior state | silent |
| 2 | Two edits, no `.needs-verification` set | silent |
| 3 | Two modify edits, verify pending - first true positive | **warn** |
| 4 | Third edit in same window after warning | silent (already warned) |
| 5a-c | Three additive edits, verify pending | silent (additive detection) |
| 6 | Override flag set | silent |
| 7 | Override expired (>30 min old) | **warn** |
| 8 | Edit to `.claude/memory/` path | silent (exempt) |
| 9 | Same dir, different file, modify | **warn** (cross-cutting bug detection still works) |

All scenarios passed on first run.

## What this preserves

The hook still catches the real case it was built for: today's morning bug where Fix A landed on transport.ts, Fix B landed on the same file before the WSS handler bug (#2 of 3) was found via external probe. With v2, that flow still triggers exactly one clear warning - the user just isn't spammed if the fix pattern is actually a coherent multi-edit task.

## Files touched

- `claude/hooks/second-fix-gate.sh` - rewrote with v2 logic
- `claude/hooks/_tests/test-second-fix-gate.sh` - new regression test (run any time the hook is touched)
- Live via symlink: `~/.claude/hooks/second-fix-gate.sh` → repo path (active immediately)

## Collaborator

Jonah
