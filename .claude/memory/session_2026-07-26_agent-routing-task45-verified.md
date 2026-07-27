---
name: Tasks 4-5 committed and mutation-verified; test-isolation export proven not to mask the defect
description: Task 4 at 486ba80e, Task 5 at 1c8db6fc, 21/21. Neutering the cooldown gate drops the suite to 20/21, proving the global ROUTE_INTENT_COOLDOWN=0 export isolates state without masking. Teammate's "hook is live" claim was wrong - the stray cooldown file came from my own probes.
type: project
relates_to: [session_2026-07-26_agent-routing-task45.md, session_2026-07-26_vacuous-suppression-tests.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: mutation test through the suite - cooldown gate neutered gives 20 passed 1 failed with the correct label, restore gives 21/21 byte-identical; settings.json grep shows 0 route-intent refs
confidence: high
---

# Tasks 4-5 verified

Collaborator: Jonah. Task 4 `486ba80e`, Task 5 `1c8db6fc`. Suite 21/21, stable
across repeated runs.

## The risk that needed settling

`task45-cooldown` hit a real regression: the pre-existing `assert_routes` tests
shared the REAL `~/.claude/.route-intent-cooldown` file, so one test's nudge
cooled down the next. It fixed this with a four-line isolation block exporting
`ROUTE_INTENT_COOLDOWN_FILE` to a temp path and `ROUTE_INTENT_COOLDOWN=0`, with
a cleanup trap.

That fix is correct but carried a specific danger: **a global
`ROUTE_INTENT_COOLDOWN=0` could disable the very cooldown the Task 5 tests
exist to verify**, turning them into another pass-for-the-wrong-reason case.
That is the third variant of the recurring defect in this build.

Settled by mutation rather than by reading:

```
cooldown gate neutered (if in_cooldown() -> if False):
  FAIL: second nudge suppressed by cooldown   <- correct label
  RESULTS: 20 passed, 1 failed
restored:
  RESULTS: 21 passed, 0 failed   (git diff --stat empty)
```

The test DOES fail when cooldown breaks. The global export isolates state
without masking, because a per-invocation `VAR=x cmd` override beats an
exported default in bash. Verified, not assumed.

## Teammate misdiagnosis, corrected

The report claimed "this hook is already live/dogfooded in this session." It is
NOT: `grep -c route-intent ~/.claude/settings.json` returns 0 and there is no
`~/.claude/hooks/route-intent.sh` symlink. Wiring is Task 7 and has not run.

The real `~/.claude/.route-intent-cooldown` file did exist, but **I created it**
with my own earlier verification probes, which invoked the hook without
redirecting the cooldown path. `touch_cooldown()` runs before the nudge prints
even when the window is zero, so those probes wrote the file.

The symptom was real and the fix was right; only the cause was misattributed.
Worth recording because "the hook is live" would have been an alarming and
false conclusion to carry into Task 7.

## Cleanup performed

- Killed three hung `codex exec` processes (31639, 31641, 31643) left from a
  review that stalled 9+ minutes at near-zero CPU. The teammate correctly fell
  back to an independent Claude reviewer per the verification mandate.
- The stray `~/.claude/.route-intent-cooldown` must be removed before Task 7
  wires the hook, or a stale timestamp there will silently suppress the first
  real nudge.

## Files touched
- `.claude/memory/session_2026-07-26_agent-routing-task45-verified.md` (this beat)
- No repo files changed; the mutation was reverted and verified byte-identical
