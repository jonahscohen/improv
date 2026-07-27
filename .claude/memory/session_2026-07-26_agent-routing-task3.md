---
name: Agent routing Task 3 complete (suppression live, vacuous tests replaced)
description: Suppression shipped at 338f537f, tests corrected at 89de5010. Suite 15/15. Three assertions that passed regardless of the code were replaced with mutation-verified ones, and the plan was corrected to match so the defect cannot be re-transcribed.
type: project
relates_to: [session_2026-07-26_vacuous-suppression-tests.md, session_2026-07-26_replacement-assertions-validated.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller confirmed the 5 assertions on disk, git show --stat proving only the test file changed in 89de5010, and suite 15/15
confidence: high
---

# Task 3: suppression rules

Collaborator: Jonah. Implemented by `task3-suppress` (sonnet). Commits
`338f537f` (suppression) and `89de5010` (test correction). Suite 15/15.

## What shipped

`route-intent.sh` now scrubs and gates before any tier matching:

1. Strip code fences, tilde fences, inline backticks, URLs, and XML bodies.
   A pattern inside those is being DISCUSSED, not requested.
2. Reject anything shorter than `min_prompt_chars` (40). This is the design's
   break-even point, not an arbitrary threshold: the lead reads every prompt at
   full context before it can dispatch, so routing only saves on the
   continuation. Dispatching a short question costs more than answering it.
3. Reject informational openers via anchored `exempt` patterns ("what is",
   "explain", "how do", and similar). Anchored on purpose - "what" mid-prompt
   is not an informational framing.

Order matters: scrub, then length, then exempt, then match. The length gate
measures the SCRUBBED text, so a short question wrapped in a long code block
cannot slip through.

## The defect that mattered more than the feature

Three of the five suppression assertions passed whether or not the suppression
code existed. Full analysis in
[[session_2026-07-26_vacuous-suppression-tests]]; replacements pre-validated in
[[session_2026-07-26_replacement-assertions-validated]].

Replaced with prompts that each match a tier and are silenced by exactly one
rule. Count unchanged at 15, so downstream task counts were unaffected.

**The plan was corrected too, with comments explaining WHY each prompt is
shaped the way it is.** Fixing only the code would have left the defect sitting
in the plan for the next person to re-transcribe faithfully. That is the second
time this session a plan defect reached shipped code through correct
transcription.

## Pattern across Tasks 1 and 3

Both defects were the same shape: a test whose success condition is "nothing
happened," passing for a reason unrelated to the code under test. Task 1's was
a possible inverted polarity; Task 3's was prompts that never matched. Neither
would have been caught by a green suite, and neither was in the implementer's
control - both came from plan text.

## Files touched
- `claude/hooks/route-intent.sh` (scrub + length gate + exempt)
- `claude/hooks/route-intent.json` (exempt patterns populated)
- `claude/hooks/test-route-intent.sh` (5 assertions, 3 later corrected)
- `docs/superpowers/plans/2026-07-26-agent-routing.md` (Task 3 block corrected)
- `.claude/memory/session_2026-07-26_agent-routing-task3.md` (this beat)
