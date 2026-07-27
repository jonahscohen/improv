---
name: Imperative recall gap confirmed - four natural phrasings miss the opus tier
description: With prompts held over the 40-char bail so the length gate cannot confound, bare and "can you" imperatives route to opus-executor while "i want you to", "lets", "we need to", and "time to" go silent. Reviewer's Minor was exactly right.
type: project
relates_to: [session_2026-07-27_agent-routing-rereview-clean.md, session_2026-07-27_mutation-testing-fail-open-code.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: probed six phrasings all 57-66 chars, above the 40-char min_prompt_chars bail, so only the imperative pattern differs between them
confidence: high
---

# Imperative recall gap

Reviewer Minor confirmed by direct probe. All six prompts held between 57 and
66 characters so the length gate is constant and only the imperative shape
varies.

| prompt | routes to |
|---|---|
| `refactor the parser module across every call site in the repo` | opus-executor |
| `can you refactor the parser module across every call site` | opus-executor |
| `i want you to refactor the parser module across every call site` | **SILENT** |
| `lets refactor the parser module across every call site in the repo` | **SILENT** |
| `we need to refactor the parser module across every call site` | **SILENT** |
| `time to refactor the parser module across every call site now` | **SILENT** |

Fix, per the reviewer: add `\b(?:want you to|need to|lets|let us|time to)\s+`
to the boundary alternation in `route-intent.json`.

## Not a blocker, and the trade is the right way round

A missed nudge costs nothing, since silence is the documented default and the
lead simply handles the prompt itself. A false positive costs a wrong dispatch
to the MOST expensive tier, which is the exact failure the whole feature exists
to avoid. Erring toward silence is correct.

## Methodology note, fourth of the same family

My first pass at this used prompts of 26 to 40 characters and reported all six
as missed, including the two that actually work. They were under the 40-char
`min_prompt_chars` bail, so the LENGTH gate silenced them and the imperative
pattern was never reached.

Same root cause as the previous three: **the probe did not hold constant the
layers that were not under test.** The discipline that fixes it is mechanical -
before reading any probe result, state which single variable differs across
the cases, and confirm every other gate is constant. Here that meant checking
character counts before checking routes.

## Files touched
- `.claude/memory/session_2026-07-27_imperative-recall-gap-confirmed.md` (this beat)
- No repo files changed
