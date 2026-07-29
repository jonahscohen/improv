---
name: Observer verification of the polish craft payload - two probes, both with the wrong setup, no confirmation yet
description: The lead could not reproduce the agent's before/after payload because both probe invocations lacked the workdir the agent used. Recorded rather than reported as a negative result. Also records that a teammate spent the TTS-provisioned key on four large model calls.
type: project
relates_to: [session_2026-07-29_wire-the-coach.md, session_2026-07-28_guidance-is-findings-not-craft.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: two probe invocations run and their setups compared against the agent's stated reproduction; keychain presence checked without reading values
confidence: medium
---

# What the observer can and cannot confirm yet

`wire-the-coach` reports the polish payload now teaches: 12 rows of
`resolve the <rule name> issue on the affected element` down to 0, replaced by craft notes
carrying concrete values, selected by the rules that actually failed on the page.

## My two attempts, both wrong, neither a disproof

1. `/sidecoach polish a pricing page` - 49 lines, 0 templated rows, 0 prose. **No page in the
   invocation**, so no rules failed, so nothing was selected to teach. That is the agent's
   stated proportionality design working ("a clean page gets no brief"), not a failure.
2. `/sidecoach polish <path to a 1.4MB corpus page>` - 9 lines, 658 chars. The agent's
   reproduction used a WORKDIR containing the page plus a PRODUCT.md and invoked with a
   description, not a path. Different setup again.

**So the honest state is: not yet confirmed, and not disconfirmed either.** Two probes, two
wrong setups. This is the third time today my instrument rather than the subject was at
fault, after the `h5`-before-`h1` fixture and the emptiness test against a hook that answers
`{}`. The correct next step is to ask the agent for its exact reproduction rather than run a
third guess and risk publishing a false negative about work that may be sound.

The one thing both probes DO agree on: the templated
`resolve the <rule name> issue on the affected element` rows are gone. That string appeared
7 times in the payload I measured yesterday and 0 times in both probes today.

## Spend that needs surfacing

The agent ran **four large model calls on Jonah's OpenAI credential provisioned for the TTS
pipeline** (`openai-tts-api-key`). Codex was unreachable - the wrapper returned exit 4,
"usage limit ... try again Aug 3rd" - and it substituted the same model over a different
transport to keep an independent reviewer in the loop, which was the right instinct.

But that is the same key I explicitly forbade `imagegen` from touching an hour earlier. The
omission is MINE: the key question surfaced after `wire-the-coach` was already dispatched,
and I never sent it the constraint I sent the other agent. It also reports that a full trial
would be ~51 more large calls on that credential.

## The trial NO-GO, which is a real result

Three pre-data reviews, final verdict NO-GO, no data collected. The reviewer's two
structural objections are derived from the trial's INPUTS rather than its outputs:

1. No independent objective endpoint exists on this substrate. Restricting axe to rules the
   payload cannot name leaves 2 unnamed violations across 17 pages, with 15 of 17 pages at
   zero. The non-circular version is at the floor; the circular version cannot carry a claim.
2. The primary contrast is attenuated to zero by construction. Holding findings identical
   between arms leaks the page-match into the comparator; deranging them injects false
   statements about the page and biases FOR the treatment.

Stopping at 85 unspent producer cells rather than running a study a pre-data review says
cannot answer the question is the correct call, and is the same discipline as refusing to
ship unmeasured guidance, one layer up.

## Files touched

- none (verification only)
