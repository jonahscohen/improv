---
name: Agent routing Tasks 4-5 (tie-break locked, cooldown works but is UNCOMMITTED)
description: Task 4 committed at 486ba80e. Task 5's cooldown code is written and mutation-verified (prompt 2 silent at 900s, fires at 0s) but sits UNCOMMITTED in the working tree - the teammate went idle before committing. Suite 21/21.
type: project
relates_to: [session_2026-07-26_agent-routing-task3.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller ran the suite (21/21) and mutation-tested cooldown directly - second prompt SILENT at 900s window, FIRES at 0s window, proving the silence comes from cooldown and not from the prompt failing to match
confidence: high
---

# Tasks 4 and 5

Collaborator: Jonah. Implemented by `task45-cooldown` (sonnet).

## Task 4: escalate-up tie-break locked (committed, 486ba80e)

No production code. The behavior was already implemented in Task 2, which
iterates `escalation_order` and returns the first hit. Task 4 exists purely to
regression-lock it, because reordering the lexicon would silently invert the
tie-break with no other symptom. Its tests pass immediately by design.

## Task 5: cooldown - WORKING BUT UNCOMMITTED

Suite reads 21/21 and the cooldown code is present in `route-intent.sh`
(`in_cooldown`, `touch_cooldown`, the `ROUTE_INTENT_COOLDOWN*` env overrides),
but `git status` shows `route-intent.sh` and `test-route-intent.sh` still
MODIFIED. HEAD is still Task 4's commit. The teammate went idle before
committing.

Nothing is lost, but the work is unprotected until it lands.

## Cooldown mutation test (controller, direct)

The standing lesson from Tasks 1 and 3 applies exactly here: "the second nudge
must be SILENT" is another assertion whose success condition is "nothing
happened." So it was proven rather than trusted:

| window | prompt 1 | prompt 2 |
|---|---|---|
| 900s | FIRES | **SILENT** |
| 0s | FIRES | **FIRES** |

Prompt 2 fires when the window is zero, so its silence at 900s really does come
from the cooldown and not from the prompt failing to match a tier. This
assertion is real. Third time this discipline has been applied; first time the
test passed it on the first attempt.

## Files touched
- `claude/hooks/route-intent.sh` (cooldown - UNCOMMITTED at time of writing)
- `claude/hooks/test-route-intent.sh` (6 assertions across both tasks)
- `.claude/memory/session_2026-07-26_agent-routing-task45.md` (this beat)
