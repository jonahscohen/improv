---
name: Task 6 complete (route-intent fail-open hardening), plus a fourth vacuous-assertion case found and left as-is
description: 21 -> 28 passing. Brief's 7 assertions added verbatim, no code changes needed (both named exceptions already handled). Mutation-proved 6 of 7 non-vacuous; the whitespace-prompt case is vacuous the same way Tasks 1/3/5 were, but is not one of the brief's named exceptions so it was reported, not silently fixed.
type: project
relates_to: [session_2026-07-26_vacuous-suppression-tests.md, session_2026-07-26_agent-routing-task45-verified.md]
author_human: Jonah
source: session
verified: bash claude/hooks/test-route-intent.sh gives 28/28; per-assertion mutation testing documented below, route-intent.sh confirmed byte-identical to pre-mutation state after each probe
confidence: high
---

# Task 6: fail-open hardening

Collaborator: Jonah. Commit: "test: prove route-intent fails open on every bad
input" (see git log for hash).

## What shipped

Appended the brief's 7 assertions verbatim to `test-route-intent.sh` before
the RESULTS block: `assert_failopen` helper plus 5 malformed-stdin cases
(malformed json, empty stdin, null prompt, array payload, whitespace prompt),
a corrupt-lexicon case (`ROUTE_INTENT_LEXICON` pointed at invalid JSON), and
an invalid-regex case (a mutated lexicon copy with an unclosed regex ahead of
a valid one). Ran green on the first try: 28 passed, 0 failed. Per the
brief's own framing, this was expected - "mostly regression coverage for
behavior the outer try/except already provides" - and the brief explicitly
forbids inventing failures or restructuring working code to force a RED
first. Neither of the brief's two named escape hatches applied: `json.load`
was already inside the outer try, and the per-pattern `except re.error` loop
was already present. No code changes to `route-intent.sh`.

## Mutation evidence (the standing lesson from Tasks 1/3/5)

Did not trust the immediate green. Tested each of the 7 assertions by
mutating a scratch copy of `route-intent.sh` in place, rerunning the suite,
and restoring via `git checkout` (confirmed byte-identical after every
probe, `git diff --stat` empty for the file throughout).

Real structural finding first: this hook has two independent fail-open
layers, not one. The bash wrapper ends with an unconditional `exit 0` after
the python heredoc, so the wrapper's own exit code is untouched by whatever
the python subprocess did. Python's own uncaught-exception behavior writes
to stderr, never stdout. So `assert_failopen`'s check (`rc==0 && out==""`)
is actually guarded twice over for anything that reaches the heredoc at all.

Per-assertion mutation results:

- **malformed json**: stripped the outer `try/except` AND the trailing
  bash `exit 0` together (had to remove both layers to see any effect) ->
  FAILED (`rc=1`). Proves this assertion is real, contingent on at least one
  of the two layers existing.
- **corrupt lexicon**: same double-strip -> FAILED (`rc=1`). Proves this is
  real for the same reason; this is the exact failure mode the brief warned
  about ("if it fails, json.load is outside the try") - confirmed it is
  currently inside, and confirmed via mutation that moving/losing that
  protection is a detectable regression.
- **invalid regex**: targeted mutation, outer try/except left intact, only
  removed the per-pattern `except re.error: continue` inside the tier loop
  -> FAILED (`rc=0`, but `out` was silent, so the content check for
  "Explore" failed). This is the cleanest proof in the set: it isolates the
  *specific* inner protection named in the brief, not just the generic
  outer catch-all.
- **empty stdin**: targeted mutation, changed `json.loads(raw) if raw else
  {}` to unconditional `json.loads(raw)` -> FAILED (`rc=1`). Real.
- **null prompt**: targeted mutation, bypassed the `isinstance(..., str)`
  guard and called `.strip()` directly on `payload["prompt"]` (None) ->
  FAILED (`rc=1`, AttributeError). Real.
- **array payload**: targeted mutation, removed
  `if not isinstance(payload, dict): sys.exit(0)` -> FAILED (`rc=1`,
  AttributeError from `.get()` on a list). Real.
- **whitespace prompt**: removed the `if not prompt.strip(): sys.exit(0)`
  guard alone -> still PASSED (min_chars catches it downstream). Removed
  the `min_chars` gate too, on top of that -> **still PASSED**. A
  whitespace-only prompt scrubs down to an empty `text` string, and no tier
  regex in the lexicon can match an empty string regardless of any guard.
  This is the same defect shape as the Task 1/3/5 vacuous tests: the
  assertion's silence is caused by "nothing was ever going to match," not
  by either of the guards it looks like it is testing. It is real fail-open
  behavior (nothing crashes, nothing routes), just not evidence that the
  strip/min_chars guards specifically work. Not fixed: it is not one of the
  brief's two named exceptions, and the brief explicitly says not to
  restructure passing assertions. Flagging it honestly per the standing
  lesson's own instruction ("where you cannot [prove it], say so honestly")
  rather than quietly claiming full coverage.

## Files touched
- `claude/hooks/test-route-intent.sh` (7 assertions appended, no helper
  redefinitions)
- `.claude/memory/session_2026-07-26_agent-routing-task6.md` (this beat)
