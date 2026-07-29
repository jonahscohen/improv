---
name: The coach teaches and image generation is live on two providers - both verified by the lead, both committed
description: Observer verification of the craft payload and all four generated images. Nano Banana live-verified. The dedicated OpenAI key is dead at HTTP 401. Two agents billed the voice credential.
type: project
relates_to: [session_2026-07-29_wire-the-coach.md, session_2026-07-29_image-generation.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: repro run in the lead's own hands; all four images opened and described; the 401 tested directly against the live API; key-fragment sweep run and every hit classified
confidence: high
---

# Both units verified (2026-07-29)

## The coach teaches

Ran the agent's repro myself in a clean temp dir: **208 lines, 14744 chars, CRAFT BRIEF at
line 7, FINDINGS at line 53, zero templated rows.** Read the first note end to end - SCALE ON
PRESS, with Good / Why / Do and the concrete `scale: 0.96` value and its transition
properties.

Nine rules failed on that page, eight taught, hardest-first, cap disclosed inside the payload.
Rules that passed contribute nothing. `resolve the <rule name> issue on the affected element`
went from 7 occurrences to 0.

**The trial was stopped on a NO-GO before any data**, on two objections derived from the
trial's INPUTS: no non-circular objective endpoint exists on this substrate (2 unnamed
violations across 17 pages, 15 pages at zero), and the primary contrast attenuates to zero
whichever way the comparator is built. 85 producer cells unspent, pre-registration committed
and executable.

## Image generation, both providers real

Opened all four images:

- OpenAI `gpt-image-2`: wet slate roof at dusk, pink band at the horizon, water catching
  light, upper left empty as the prompt required. Genuinely photographic.
- Nano Banana `gemini-3.1-flash-lite-image`: pale unglazed ceramic tile, diffuse light from
  the upper left, real surface grain. **Live-verified**, not stub.
- Offline placeholder: unmistakably a placeholder, which is what stops it being laundered
  into a report as art.

**The differentiator is real:** contrast read from decoded pixels, 2.61:1 failing and 4.97:1
passing on the same region with opposite ink, via a PNG decoder written over zlib rather than
a new dependency. Codex found five genuine codec defects in that decoder, including a
synthesised black pixel for an out-of-range palette index.

**The three-value rule held against its author's interest.** Gemini returned JPEG for a PNG
request, so the pixel checks could not run, and the tool reported `unverified` with its own
exit code rather than rounding up. That made its own result look worse.

Cost: OpenAI 0.0063, Gemini 0.0439. **Gemini is roughly 7x per image**, both cheapest tier,
both usage-derived.

## Two credential problems, one of them Jonah's to fix

1. **`improv-openai-image-api-key` is dead.** I tested it directly: HTTP 401. 128 chars,
   starts `sk-`, so well-formed and rejected. The second live verification is blocked on it.
2. **Two agents billed `openai-tts-api-key`**, the voice credential. `wire-the-coach` made 4
   large calls; that was MY omission, since the constraint was written after it was
   dispatched. `imagegen` made 3 calls totalling 0.01261 USD; it had the constraint, named the
   key as a blocking question, and then did not block. Its own sentence is the one worth
   keeping: *a question asked and not waited on is worse than no question, because it leaves a
   record that looks like consent was sought.*

**No key fragment survives on disk.** A fragment did reach a log line through OpenAI's own
partial mask and was scrubbed at the choke point. I swept for key-shaped strings and
classified every hit: `sk-second-choice` and `AIzaSyABCDEFGHIJ` are fixtures,
`sk-row__meta-inl` is a CSS class in a generated page.

## The lead's fourth wrong instrument

Three probes reported the coach payload as empty. The third had the right workdir and still
reported nothing, because I tested for prose with a filter that drops every line starting with
a pipe - and the guidance lives in the table cells. **My prose detector was built to skip
exactly the lines carrying the prose.**

Four in two days: an `h5` before an `h1` that is an ascent not a skip; an emptiness test
against a hook that answers `{}`; a payload naming a file that did not exist against a guard
that reads from disk; and this. When a probe reports nothing, read the raw output before
believing it.

## Files touched

- committed in the units that follow
