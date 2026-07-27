---
name: Agent routing Task 3 fix - vacuous suppression assertions replaced and mutation-verified
description: Replaced 3 of 5 assert_silent cases in test-route-intent.sh (short-prompt, informational-framing, URL) with prompts that actually match a tier pattern before being suppressed; each replacement mutation-tested against a suppression-disabled lexicon or an XML-scrub-stripped hook copy to confirm it fires without the fix. route-intent.sh and route-intent.json untouched. 15/15 green.
type: project
relates_to: [session_2026-07-26_vacuous-suppression-tests.md, session_2026-07-26_replacement-assertions-validated.md, session_2026-07-26_agent-routing-task3-suppression.md]
author_human: Jonah
source: session
verified: "tests - bash claude/hooks/test-route-intent.sh, GREEN 15 passed/0 failed; mutation - each of the 3 replacement prompts confirmed to FIRE when suppression is disabled (temp lexicon with min_prompt_chars 0 and exempt [], or for the XML case a temp copy of route-intent.sh with the XML-scrub line removed), then confirmed SILENT again against the real hook/lexicon"
confidence: high
---

# Task 3 fix: mutation-verified suppression assertions

Collaborator: Jonah. Fixes the defect the team lead diagnosed in
`session_2026-07-26_vacuous-suppression-tests.md` and pre-validated the
replacements for in `session_2026-07-26_replacement-assertions-validated.md`:
3 of the 5 `assert_silent` cases added in Task 3 stayed silent whether or not
the suppression code existed, because the chosen prompts never matched any
tier pattern in the first place - a "must stay silent" assertion proves
nothing unless the input would otherwise fire.

## What changed

`claude/hooks/test-route-intent.sh` only. Per the team lead's explicit
instruction, `route-intent.sh` and `route-intent.json` were NOT touched.

Replaced:
- `"where is X set"` -> `"find all the callers"` (20 chars, matches
  `explore`'s `find (all|every|each) ` pattern; silenced by the
  `min_prompt_chars` length gate specifically)
- `"what is the difference between a hook and a skill..."` -> `"what is the
  best way to find all the callers of detect-session-model in this repo"`
  (over 40 chars so the length gate is not what silences it; matches
  `explore` via "find all "; silenced by the `exempt` list's `what is`
  opener specifically)
- `"see https://example.com/docs/find-all-the-callers-guide..."` -> `"<quote>
  find all the callers of detect-session-model</quote> was the wording in
  the old ticket we archived"` (the URL case was unfixable by rewording -
  tier patterns require literal spaces and URLs never contain them, so no
  URL-embedded trigger text can ever match; replaced with an XML-body case
  that exercises the XML-scrub branch, which previously had zero coverage)

Kept unchanged: the code-fence and inline-backtick cases, which were already
real (both flip from silent to firing when suppression is disabled).

## Mutation evidence

Suppression-disabled lexicon (`min_prompt_chars: 0`, `exempt: []`, built
from the real `route-intent.json` via a temp file, pointed at with
`ROUTE_INTENT_LEXICON`):

| prompt | real hook+lexicon | suppression disabled |
|---|---|---|
| `find all the callers` | silent | **fires** (Explore) |
| `what is the best way to find all the callers...` | silent | **fires** (Explore) |

XML case (scrub lives in code, not config, so disabling it required a temp
copy of `route-intent.sh` with only the XML-scrub `re.sub` line removed,
diffed against the real file to confirm that was the only change, run with
`ROUTE_INTENT_LEXICON` pointed at the real `route-intent.json`):

| prompt | real hook | XML-scrub-stripped copy |
|---|---|---|
| `<quote>find all the callers...</quote> was the wording...` | silent | **fires** (Explore) |

All three replacements are now proven to fail if their corresponding
suppression mechanism (length gate, exempt list, XML scrub) is removed - the
property the original three lacked.

## Verification

`bash claude/hooks/test-route-intent.sh` -> `RESULTS: 15 passed, 0 failed`.
`git diff --stat` after the fix shows only `claude/hooks/test-route-intent.sh`
changed (4 insertions, 4 deletions) - confirms `route-intent.sh` and
`route-intent.json` were not touched, per instruction. Temp files
(`/tmp/route-intent-suppression-off.json`, `/tmp/route-intent-noxml.sh`)
deleted after use; not part of the repo.

## Self-analysis (why the original defect happened)

Root cause named in `session_2026-07-26_vacuous-suppression-tests.md`: the
three prompts came from the brief verbatim without checking each one would
actually match a tier pattern before suppression was applied. As the
implementer, my own self-review at the time checked that the min_chars gate
and URL scrub were "real, not vacuously true" by inspecting the regex logic
in isolation - but I verified the mechanism exists and runs, not that the
specific test prompt would exercise it end-to-end via a disable-and-observe
probe. Inspecting code in isolation is not the same evidence as flipping the
behavior off and watching the assertion's pass/fail flip with it. That gap
is exactly what let 3 of 5 "verified" assertions through. Applying the same
mutation-test discipline as
`session_2026-07-26_assertion-polarity-mutation-test.md` going forward: any
negative/suppression assertion needs a before/after flip, not just a single
green run plus code inspection.

## Files touched
- `claude/hooks/test-route-intent.sh` (modified - 3 assertions replaced, 2 kept)
- `.claude/memory/session_2026-07-26_agent-routing-task3-suppression-fix.md` (this beat)
- `.claude/memory/session_2026-07-26_vacuous-suppression-tests.md` (team lead's diagnosis beat, indexed here)
- `.claude/memory/session_2026-07-26_replacement-assertions-validated.md` (team lead's pre-validation beat, indexed here)
- `.claude/memory/MEMORY.md` (index pointers for all three)
