---
name: the validation guard blocked nothing, ever
description: validation-guard.sh read tool_input keys javascript/code/script/expression; chrome MCP sends `text`. JS_CODE was always empty, so the hook allowed getComputedStyle, .click(), dispatchEvent - everything.
type: session
relates_to: [feedback_2026-07-09_falsify-every-probe.md, reference_2026-07-09_fidelity-marker-double-duty.md, feedback_2026-07-10_falsification-can-itself-be-invalid.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: fed real payloads to the pre-patch backup (all ALLOW) and to the patched hook (deny/allow matrix, both marker states); live javascript_tool call now denied
confidence: high
---

## The bug

`claude/hooks/validation-guard.sh` line 19:

    code = inp.get("javascript","") or inp.get("code","") or inp.get("script","") or inp.get("expression","")

The chrome MCP `javascript_tool` sends the source under **`text`**. None of those four
keys exist. So `JS_CODE` was ALWAYS empty, and line 26 fired every single time:

    [ -z "$JS_CODE" ] && echo '{}' && exit 0

**The hook has never blocked anything.** Not `getComputedStyle`. Not
`getBoundingClientRect`. Not `.click()`. Not `dispatchEvent`. Not private-method
calls or array mutation. Every "the guard would have stopped me" statement in this
project - including several I made to teammates tonight, at length, with conviction -
was false.

Proven, not inferred. Fed real payloads to the pre-patch copy: `ALLOW(empty)` for all.
Patched (added `text` first in the chain), re-fed:

| payload | marker absent | marker armed |
|---|---|---|
| `getComputedStyle` | deny | allow |
| `.click()` | deny | deny |
| `dispatchEvent` | deny | deny |
| `CSS.supports` | allow | allow |

Exactly the designed behaviour. The measurement lane now genuinely gates measurement,
and faking input is refused in both states.

## How I found it, which is the humiliating part

I accused the `text-image-alt` agent of fabricating a 54-check manifest. My evidence:
it never asked me to arm the lane, it wrote `measured` values anyway, and only five of
them carried sub-pixel precision.

Every premise was wrong.

- It measured because **nothing was stopping it**.
- Round numbers are not evidence of fabrication. I later measured the same page myself:
  `gap 100.0000`, `column 644`, `card rgb(24,59,124)`. Real DOM reads land on round
  numbers all the time.
- Its claim "every getComputedStyle call succeeded" was TRUE. Its inference that the
  marker must therefore have been armed was a reasonable, and wrong, conclusion drawn
  from a broken guard.

I nearly disciplined an agent for my own harness defect. I built the accusation out of
a heuristic ("sub-pixel or it did not happen") that I never tested, while sitting on
top of a guard I never tested either.

## Two probe failures inside the investigation itself

1. `echo "  patched"` ran after a python `assert` had already failed, because I did not
   chain them. The output said patched; nothing was patched.
2. I read the hook's **exit code** to decide whether it blocked. A `PreToolUse` hook
   denies via its JSON `permissionDecision`, not via exit status. The guard was already
   denying when I declared it broken.

Both are the same mistake as the guard's own: **check the channel that actually carries
the signal.**

## The rule

**A guard nobody has watched deny is not a guard.** Same sentence as "a test you have
never seen go red." I have written that four times in twelve hours and still shipped an
accusation built on an unexercised hook.

Before trusting a hook: feed it a payload that MUST be refused, and watch it refuse.
Before trusting a hook's silence: feed it the payload your tool actually sends, not the
one you imagine it sends.

## Fixed

`claude/hooks/validation-guard.sh` now reads `text` first, keeping the other keys for
compatibility. `bash -n` clean. Falsified in both marker states. NOT committed - the
dotfiles repo is Jonah's to commit.

Unknown and worth checking next: whether `bash-guard.sh` has an analogous field
mismatch for `cmux ... eval`, and whether any other PreToolUse hook reads a key its
tool does not send.
