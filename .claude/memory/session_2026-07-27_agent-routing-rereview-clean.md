---
name: Agent routing re-review clean - all 11 findings addressed, ready to merge
description: The final reviewer mutation-tested each of the 11 fixes and scanned all 21 new assertions; none pass with their feature deleted. Two Minor follow-ups remain - the imperative tightening lost recall on four natural phrasings, and one band-table comment is wrong.
type: project
relates_to: [session_2026-07-27_agent-routing-fixwave-green.md, session_2026-07-26_final-review-findings.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: reviewer mutation-tested all 11 fixes and all 21 new assertions; controller independently reproduced the registry audit, the three suite results, the latency drop, and spot-checked findings 4b and minor 7
confidence: high
---

# Re-review clean

Collaborator: Jonah. Reviewer `final-review` (opus). Verdict **Ready to merge**.

## All 11 addressed, each proven by mutation

The reviewer did not read the fixes, it broke them:

- **C1 registry:** `hook-registry-guard.sh --audit` now exits 0 silent.
- **I2 quadratic scrub:** three independent guards (bash length guard at `:29`,
  python bail at `:60-61`, bounded `.{0,2000}?` at `:85`), each tested alone.
- **I3 deploy mode:** ran the new `link_or_copy_data` in a sandbox with
  `REPO_DIR` under /tmp; files land as real COPIES and survive clone deletion.
- **I4a fence:** neutralizing the fence scrub now makes the assertion FIRE.
- **I5 stderr:** 1.2MB payload gives 0B/0B intact, 75B on stderr with the guard
  removed. Fix correctly lives in the bash wrapper, since python3 is never
  reached on that path.
- **I6 installer:** putting a bare `ln -sf` back into a copy of install.sh is
  DETECTED by the new block assertion.
- **m7 softeners:** restoring bare `\brefactor\b` makes all four negatives fire.
- **m10 type guards:** removing the guard and setting `patterns="refactor"`
  routes to opus-executor; with the guard, Explore.

## The check I asked for specifically

The assertion count jumped 30 to 51, and a count going up is not coverage going
up. **None of the 21 new assertions pass with their feature deleted.** The three
timing assertions are the honest soft spot and the suite says so in its own
comments; the structural `assert_bounded_scrub` and the behavioral length-bail
case cover each half individually.

A character-vs-byte check I had not thought to ask for: `${#INPUT}` counts
CHARACTERS while ARG_MAX counts BYTES. Worst case at the 100,000-char cap is
400KB of four-byte emoji, leaving ~600KB of headroom. No gap.

## Two Minor follow-ups, neither blocking

1. **Recall loss from the imperative tightening.** Four natural instructions no
   longer route: "i want you to refactor the parser module", "lets refactor...",
   "we need to refactor...", "time to refactor...". Adding
   `\b(?:want you to|need to|lets|let us|time to)\s+` to the boundary
   alternation recovers them. The reviewer's judgment, which I agree with: this
   is the right direction to err, since a missed nudge costs nothing and silence
   is the documented default, while a false positive costs a wrong dispatch to
   the most expensive tier.
2. **A wrong comment.** The band table at `test-route-intent.sh:394` attributes
   the 156KB case to the bash ARG_MAX guard, but the in-python bail catches it
   first. The guard is genuinely covered elsewhere at `:304`; only the comment
   is inaccurate.

Also noted for the future: `assert_bounded_scrub` greps the whole file including
comments, so a comment quoting the bounded form beside unbounded code would
satisfy it. Sound today (one line matches), and `code_only` would close it
permanently.

## Files touched
- `.claude/memory/session_2026-07-27_agent-routing-rereview-clean.md` (this beat)
- No repo files changed by the review
