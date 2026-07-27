---
name: Three of Task 3's five suppression tests asserted nothing (proven by disabling suppression)
description: Built a lexicon with min_prompt_chars=0 and exempt=[] and re-ran. The short-prompt, informational-framing, and URL cases stayed SILENT with suppression fully disabled, so they never tested the suppression code. Only the code-fence and backtick cases were real.
type: feedback
relates_to: [session_2026-07-26_assertion-polarity-mutation-test.md, session_2026-07-26_agent-routing-plan.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: probed all 3 prompts against a suppression-disabled lexicon; every one stayed silent, proving the assertions pass independent of the code under test
confidence: high
---

# Vacuous suppression tests

**A "must stay silent" test proves nothing unless the prompt would otherwise
FIRE.** Three of Task 3's five did not, and passed for reasons unrelated to the
code they were written to verify.

**Why:** the tests came verbatim from my plan. I chose natural-sounding
prompts for each suppression rule without checking whether those prompts
matched any tier pattern in the first place. A prompt that never matched is
silent before and after the feature exists.

Measured by rebuilding the lexicon with `min_prompt_chars: 0` and `exempt: []`:

| assertion | suppression ON | suppression OFF | verdict |
|---|---|---|---|
| short prompt | SILENT | SILENT | proves nothing |
| informational framing | SILENT | SILENT | proves nothing |
| URL | SILENT | SILENT | proves nothing |
| code fence | SILENT | FIRES | real |
| inline backticks | SILENT | FIRES | real |

Root causes, one per case:

- `"where is X set"` never matched `quick_answer`, whose pattern needs 2-40
  characters between "where is" and "set". The single `X` is one character.
- The informational prompt matched no tier at all, so the `exempt` list was
  never consulted.
- Tier patterns all require literal SPACES (`find (all|every|each) `), and URLs
  contain none, so `find-all-the-callers-guide` in a path could never match
  with or without the URL scrub.

**How to apply:** for any negative or suppression assertion, first prove the
input triggers the behavior you are suppressing. Disable the suppression, watch
it fire, re-enable it, watch it go silent. Same discipline as
[[session_2026-07-26_assertion-polarity-mutation-test]] - the passing run is the
weakest available evidence about a test whose success condition is "nothing
happened."

Note the third case is not fixable by rewording: with space-requiring patterns
the URL scrub cannot be exercised at all. It is replaced by an XML-body case,
which tests a real scrub branch that had no coverage.

## Files touched
- `.claude/memory/session_2026-07-26_vacuous-suppression-tests.md` (this beat)
- No repo files changed by this investigation; the probe lexicon was a temp file
