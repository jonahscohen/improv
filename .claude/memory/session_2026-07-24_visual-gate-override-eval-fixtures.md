---
name: Visual-verify gate armed on eval-fixture HTML writes; overridden (no rendered UI deliverable)
description: The Stop-time visual-verification gate armed because teammates wrote HTML files this session, but those are eval FIXTURES (constructed detector/labeler inputs graded behaviorally), not a product UI surface. A screenshot would prove nothing. Jonah overrode; flag cleared. Recorded so future sessions know eval-fixture writes spuriously arm the visual gate.
type: feedback
relates_to: [session_2026-07-24_autonomous-wave1-dispatched.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none - operational note; the override is Jonah's call, recorded verbatim
confidence: high
---

Collaborator: Jonah. 2026-07-24.

**What happened:** the Stop hook's visual-verification gate BLOCKED reporting because a visual file changed and was never screenshotted. But this turn produced NO rendered UI deliverable - it was agent orchestration (4 teammates dispatched) + a read-only audit verification (greps). The HTML files that armed the flag are eval FIXTURES (e.g. `eval/fixtures/default-typeface/p04-webfont-declared-never-applied.html`, `known-good/clean-page.html`) - constructed inputs whose correctness is BEHAVIORAL (does the detector fire correctly? does the CSSOM labeler read the declared stack?), verified by tests + the A5a gate, NOT aesthetic. Several deliberately paint as plain system fonts, so a screenshot would show unstyled pages and prove nothing.

**Why:** the visual-arm heuristic keys on write TARGETS with visual extensions (.html/.css/.tsx...). It cannot distinguish a product UI file from an eval fixture, so any session that authors test HTML arms the gate. This is a known false-positive shape for eval-heavy sidecoach work.

**How to apply:** when the visual gate fires and the only visual writes are eval/test fixtures graded by a detector/labeler (not a rendered product surface), that is a legitimate override case - state it plainly and take the override, do not perform a meaningless screenshot. When a REAL product UI changed, the gate is right and must be honored with an actual screenshot Read. Jonah overrode this instance; flag cleared (`~/.claude/.needs-verification.*`).

## Update - 3rd recurrence -> durable fix spawned
The gate re-fired a 3rd time in the same session (eval fixtures + `*.test.ts` writes from the parallel wave). Repeatedly clearing a flag is a workaround, not a fix, so a DURABLE narrowing was spawned as `task_03b0922e`: exclude `eval/fixtures/`, `eval/corpus/`, `*.test.*`/`*.spec.*`, and temp-dir write targets from the visual arm, PRESERVING the gate for genuine product UI, with regression cases both ways. This is the same class the hook was narrowed for on 2026-07-23 (`session_2026-07-23_verify-visual-arm-reference-narrowed.md`), a new sub-case. Not fixed inline - the hook is delicate and heavily tested, so it belongs in its own reviewed task, not a mid-wave hack.

## Files touched
- this beat + MEMORY.md index. No code changed (durable fix is task_03b0922e).
