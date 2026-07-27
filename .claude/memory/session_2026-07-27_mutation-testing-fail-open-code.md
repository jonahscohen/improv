---
name: Mutation-testing fail-open code - NEUTER the behavior, never DELETE the line
description: Deleting a scrub line to test its assertion broke the assignment chain, raised NameError, hit the outer except, and exited silently. In a fail-open system that silence is indistinguishable from the feature working, so three assertions were wrongly called vacuous.
type: feedback
relates_to: [session_2026-07-26_vacuous-suppression-tests.md, session_2026-07-26_assertion-polarity-mutation-test.md, session_2026-07-27_agent-routing-fixwave-green.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: deleting the fence scrub gave SILENT (false vacuous verdict); replacing the same regex with a never-matching r"(?!x)x" gave FIRES, proving the assertion is real
confidence: high
---

# Mutation-testing fail-open code

**When mutation-testing code that fails open, neuter the BEHAVIOR, never delete
the LINE.** A deleted line can break the program, and a broken fail-open
program goes silent - which is byte-identical to the feature working correctly.

**Why:** `route-intent.sh` scrubs in a chain:

```python
scrubbed = re.sub(r"```.*?```", " ", prompt, flags=re.S)   # line A
scrubbed = re.sub(r"~~~.*?~~~", " ", scrubbed, flags=re.S) # line B reads A's output
```

Deleting line A leaves `scrubbed` undefined at line B. That raises `NameError`,
the outer `except Exception: sys.exit(0)` catches it, and the hook exits 0 with
no output. I read that silence as "the assertion passes without its feature,
therefore vacuous." It was actually "the hook crashed."

Same probe, correct method - replace the regex with a valid one that can never
match, keeping the assignment chain intact:

```python
NEVER = r"(?!x)x"
```

| mutation | result | verdict |
|---|---|---|
| delete the fence scrub line | SILENT | **wrong** - hook crashed |
| fence regex -> `r"(?!x)x"` | FIRES | assertion is REAL |
| fence + inline-backtick neutered | FIRES | still real |

**How to apply:**
1. Mutate by making the behavior inert, not by removing code. For a regex, swap
   in a never-matching pattern. For a condition, force it False. For a lookup,
   return an empty result.
2. Always run two sanity controls alongside the mutation: the UNMODIFIED code
   on the same input (must show the protected behavior) and a positive control
   that must fire. Here: unmodified hook SILENT, same text without the fence
   FIRES. If either control misbehaves, the harness is lying, not the code.
3. In fail-open systems specifically, verify the mutant still RUNS. Silence
   proves nothing until you know the program did not crash to get there.

This was the third methodology error of the same family in one session: probing
a layer other than the one under test. First was measuring tier-pattern latency
and concluding the whole hook was fast while the XML scrub was quadratic. Second
was letting a cooldown file leak between probe cases. Third was this. **The
common root: I built the probe around the mechanism I had in mind rather than
around the specific behavior the assertion claims to protect.**

## Outcome for the branch

All 12 `assert_silent` assertions were re-verified per-feature with valid
mutations, and **every one is real.** The fix wave's corrections to findings 4a
and 4b both hold. The earlier "8 vacuous" reading was entirely an artifact of
the broken mutation method and was never reported as fact.

## Files touched
- `.claude/memory/session_2026-07-27_mutation-testing-fail-open-code.md` (this beat)
- No repo files changed; every mutation was a temp copy
