---
name: A string `patterns` value silently hijacks routing to the most expensive tier
description: route-intent.sh iterates tier patterns without checking the value is a list. A string iterates character-by-character, so any single char present in the prompt matches that tier - and escalation resolves upward, so a malformed opus_executor tier captures every prompt.
type: project
relates_to: [session_2026-07-26_agent-routing-tasks67-live.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: probed with cooldown disabled and isolated cooldown files - patterns='x' on a prompt with no x routes normally, patterns='e' on a prompt containing e routes to opus-executor instead of quick-answer
confidence: high
---

# Lexicon type-validation gap

Found by adversarial probing after Tasks 1-7 were green. Not caught by the
30-assertion suite, which only ever loads well-formed lexicons.

## The defect

`route-intent.sh` does `for pat in tier.get("patterns", [])` with no check that
the value is a list. In Python a STRING is iterable, so a malformed
`"patterns": "some string"` iterates character by character, and every single
character is a valid regex. Any character present in the prompt matches.

Escalation resolves to the most capable matched tier, so a malformed
`opus_executor` entry captures essentially every prompt.

Measured, cooldown disabled and cooldown files isolated per run:

| lexicon state | prompt | routed to |
|---|---|---|
| valid | "where is the cooldown seconds value set..." | quick-answer (correct) |
| `opus_executor.patterns = "x"` (no x in prompt) | same | quick-answer (unaffected) |
| `opus_executor.patterns = "e"` (prompt has e) | same | **opus-executor** |

The `"x"` row is what makes this diagnosis certain rather than plausible: the
tier is only hijacked when a character in the malformed string actually appears
in the prompt.

## Severity: Important, not Critical

It needs a malformed lexicon, which is config error rather than adversarial
input. The hook still exits 0 with valid JSON, so it can never break a turn.
But it silently routes to the MOST EXPENSIVE tier, which is precisely inverted
from the feature's purpose, and it does so with no error anywhere.

**Fix:** type-check before iterating, e.g.
`pats = tier.get("patterns"); if not isinstance(pats, list): continue`.
The same guard is worth applying to `tiers` (dict) and `escalation_order`
(list); both of those already fail safe by accident, so the explicit check is
about intent rather than a new fix.

## Two errors in my own probing, recorded per the self-analysis protocol

1. **Cooldown leaked between probe cases.** Case A fired and wrote the DEFAULT
   cooldown file, which then silenced case B. I read that silence as a result.
   Cause: I disabled cooldown in some probe helpers and not others. Fix: every
   probe now sets both `ROUTE_INTENT_COOLDOWN=0` and a unique
   `ROUTE_INTENT_COOLDOWN_FILE`.
2. **I printed a conclusion the measurement then contradicted.** The narration
   line "a LOOKUP prompt just got routed to the most expensive tier" was
   hardcoded in the script BEFORE the result printed, and the actual output was
   SILENT. That is the same failure I have been flagging in tests all session:
   asserting an outcome instead of measuring one. Echo lines that state results
   must be derived from the measurement, never written alongside it.

Also worth separating: my probe flagged "cooldown path unwritable" as a break.
It is not. The spec requires cooldown read/write failure to degrade to "not in
cooldown," so firing is the designed behavior. The probe's expectation was
wrong, not the hook.

## Files touched
- `.claude/memory/session_2026-07-26_lexicon-type-validation-gap.md` (this beat)
- No repo files changed; all probes used temp lexicons
