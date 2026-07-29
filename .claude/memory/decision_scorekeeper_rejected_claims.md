---
name: Claims brought to the scoreboard that were rejected or rewritten
description: A claimed model-currency WIN had nothing on the other side; test line count was replaced with mutation controls; two relayed cost/format figures were admitted only as UNMEASURED
type: decision
relates_to: [session_2026-07-29_scoreboard-harness.md, session_2026-07-29_scorekeeper-instrument-failures.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: each claim re-measured locally against both trees before scoring
confidence: high
---

Four claims arrived for scoring. None was accepted as submitted. Recording the reasoning so the next claim gets the same treatment.

**REJECTED - "sidecoach defaults to a newer model generation than LOCALPROJECTX."** Submitted as a WIN: our `gemini-3.1-flash-image` (Nano Banana 2) against their `gemini-2.5-flash-image` (previous generation). Verified against their tree: they have NO Gemini image path at all. `skill/scripts/generate-image.mjs` hardcodes `gpt-image-2`, and the only string matching `gemini-` anywhere in their source is `gemini-no-image-hover`, an unrelated CSS rule name. There is nothing on their side for our default to be newer than.

Rewritten into two rows that are actually measurable:
- OpenAI model currency, the only provider both projects share: `gpt-image-2` both sides. **TIE.**
- Providers selectable at all: 2 for us (openai, nanobanana) against 1 hardcoded for them. **WIN.**

Worth naming the shape of this error, because it is the mirror image of the reachability mistakes made on this same board: a comparison was constructed against an opponent position that did not exist. A WIN needs both sides measured, not just ours.

**REPLACED - "Test suite size (lines): theirs 39960, ours 23432, LOSS."** Agreed with the objection that this metric is indefensible. Line count is not quality; a project loses that row by writing tighter tests and wins it by padding. Replaced with **mutation controls declared** - does the suite prove it can fail? Ours declares 18 across 4 suites; theirs has no mutation-control harness (the only `mutation` matches in their tests are prose about DOM element mutation). Counted statically rather than executed, because the four suites together exceed a 10-minute wall clock and a harness other agents must run cannot carry that. Execution evidence is out of band: `mutation-check-primitive-icons.sh` ran to completion this session, 4 CAUGHT, `MUTATION CONTROL PASS`, exit 0.

**ADMITTED AS UNMEASURED - cost per generated image.** Relayed figures: 0.043901 USD for one 1024x1024 on the Gemini flash-lite path against 0.0063 on OpenAI, roughly 7x. Not reproduced here, because reproducing it costs money. On the board with both numbers and an explicit note that they are relayed, scored UNMEASURED. A figure I cannot re-run with a command does not get a verdict, even when I believe it and even when it is unflattering to us.

**ACCEPTED AS A LOSS, one half verified locally - pixel checks do not apply to default-provider output.** Verified here: the verifier imports `decodePng` only, and `bin/sidecoach-image.js --help` already states "png is the only format whose pixels can be verified"; the jpeg and webp paths parse headers for geometry and never reach pixels. The other half - that Gemini returns JPEG for a PNG request - is relayed, not independently confirmed, because confirming it means spending a live call. Scored **LOSS** and held there until pixels are readable on default-provider output. This is the one capability no competitor has at all, and it is currently inert on the provider we default to. `unverified` must not become the documented steady state.

**Standing rule this establishes.** A claim is scored only when a command reproduces it against BOTH trees. Absence on the competitor's side is UNMEASURED, never a win. Relayed numbers may appear on the board for context but never carry a verdict.
