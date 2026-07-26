---
name: Visual-gate narrowed (agent D) + memory-nudge over-correction fixed (my regression)
description: Integrated agent D's visual-verification-gate narrowing (3 sites, shared regex, subagent-no-arm) AND fixed a regression I shipped in fccb5c0e - my memory-nudge scratchpad exclusion blanket-matched all /tmp, breaking 3 test-nudge-debounce cases. Narrowed to /scratchpad/ only; 58/58 green.
type: project
relates_to: [session_2026-07-26_visual-gate-narrowed.md, session_2026-07-26_tail-cleanup.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: hook unit suites all green (test-verify-visual-gate 44/44, test-nudge-debounce 58/58, bash -n on all 4 edited hooks); agent D's suites 179/179 + 156/156 + Codex(gpt-5.5) no-blocking
confidence: high
---

Collaborator: Jonah. 2026-07-26.

## Agent D - visual-verification gate narrowed (the "reckless tyrant")
The gate false-fired on non-app changes. D narrowed all THREE sites that independently classify "visual file", kept byte-identical (a test asserts they match): verify-before-done.sh (ARM), verify-before-done-stop.sh (STOP), bash-guard.sh (COMMIT ~L1592). Shared regex `_NON_APP_DIR_RE = (^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/`. Fixes:
- DELETIONS no longer arm/block (STOP skips `D` in porcelain XY; COMMIT uses `git diff --cached --diff-filter=d`; ARM never armed on rm).
- Non-app dev-doc/test/fixture paths exempt (reference-site != reference, docs-panel != docs - verified still arm).
- SUBAGENT/teammate edits skip set_flag entirely (IS_SUBAGENT) - a sidechain edit no longer arms the PARENT session's flag (this was the exact dep-map false-fire I hit).
- Still ARMS on real app UI (marketing-site/components, src/styles/app.css, reference-site/pages, src/docs-panel) - guard intact, not gutted.
D verified both directions + suites green + Codex clean. D softened 2 of my directives to not contradict the 2026-07-24 Codex-reviewed decision (nested product UI under /tmp still arms) + existing tests (.test.tsx arms "code" not a screenshot demand) - reasonable; net effect matches intent.

## MY REGRESSION (fccb5c0e) - fixed
My earlier memory-nudge scratchpad exclusion used `file_path.startswith(("/tmp/","/private/tmp/")) or "/scratchpad/" in file_path` + a Bash strip of `> /tmp/...`. That blanket-excluded ALL /tmp, and test-nudge-debounce.sh uses `/tmp/fake-project/src/file.ts` as a stand-in for a PROJECT edit - so my change made that legit edit skip -> 3 cases red (Case A no nudge/dirty, Case B no dirty). NARROWED both to `/scratchpad/` only (the actual over-fire target; matches D's scratchpad-not-bare-/tmp call). Now: scratchpad write -> no dirty (over-fire still fixed); /tmp/fake-project edit -> nudges + dirties (test green). test-nudge-debounce 58/58.

## SELF-ANALYSIS (why I shipped it)
I unit-tested my scratchpad exclusion with a REAL project path (/Users/.../sidecoach/src/foo.ts) + a scratchpad path - but never a /tmp path, and I did NOT run the hook's OWN existing suite (test-nudge-debounce.sh) after editing memory-nudge.sh. The hook's tests encode expectations I didn't know (a /tmp/fake-project fixture = a project). LESSON: after editing ANY hook, run its existing test-*.sh suite, not just ad-hoc fake-input checks. Ad-hoc checks only test what I already think; the suite tests what the hook actually promises.

## Also
Apostrophe trap: my first narrowing edit put `test-nudge-debounce's` inside the single-quoted `python3 -c '...'` block -> bash syntax error (the file's own header warns about this; A + D hit it too). Removed the apostrophe. bash -n clean.

## Files (for the hooks commit)
- agent D: claude/hooks/{verify-before-done.sh, verify-before-done-stop.sh, bash-guard.sh, test-verify-before-done.sh, test-verify-visual-gate.sh, test-bash-guard-commit.sh}
- mine: claude/hooks/memory-nudge.sh (narrowed to /scratchpad/)
