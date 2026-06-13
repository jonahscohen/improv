---
name: v8 review + spec-review-loop gut check
description: 9th review round; both P0s were v8-introduced regressions (3rd straight revision to self-introduce P0s); fixed the 2 contradictions, parked the P1s, and put a redirect-to-implementation gut-check to Jonah rather than folding a v9
type: decision
relates_to: [session_2026-06-13_lane-design-v8-declarative-rule-registry.md, feedback_shortcuts_are_lies.md]
---

The v8 review (`reviews/2026-06-13-...-v8-review.md`) is the NINTH review round
of the lane spec. Findings: 2 P0 + 6 P1/P2. Verdict: revise-before-implement.

**Both P0s were regressions v8 ITSELF introduced** (the third straight
revision to self-introduce P0s - v7 did, v8 did):
1. "Exactly-once execution" was an overclaim - AbortSignal is cooperative, a
   timed-out handler keeps running, flow-history/session-memory write OUTSIDE
   the fenced commit, so overlap produces duplicate side effects. Honest
   guarantee = at-most-one COMMITTED transition + idempotent/fenced side
   effects.
2. Universal Flow J source preflight (which I broadened in v8 to fix the v7
   sequence-lane point) rejects `lane_build` on a fresh empty project - the
   lane whose job is to CREATE source. My own acceptance test (every lane
   passes a fresh-build fixture) made the contradiction self-evident.

**What I did:** fixed both P0s in the spec (they were false statements that
must not stand regardless of next step) + the two acceptance lines that
contradicted the fixes. Phase-aware preflight (refinement/loop reject at
start; build defers the gate to its polish step). Lease guarantee corrected to
at-most-one-committed + fencing-token on persistent writes. The absolute-ban
severity P1 is already resolved by the per-rule `severity` field on
ProductRuleDefinition (a rule declares its own canonical severity, overriding
the global P1->major mapping). The remaining P1/P2s (lifecycle-vs-outcome
status separation, lease iteration identity, target containment/glob
semantics, clean-with-findings downstream wording, precondition-id metadata,
derived-field read-only marking) are real but are the TYPE-CHECKER/TEST
category - underspecification, not contradiction.

**Decision: STOP the spec-review fold; recommend redirecting the (clearly
effective) cross-model review machinery from the SPEC to the IMPLEMENTATION.**

**Self-analysis (why the loop keeps generating findings):** each revision is
an untested edit to a large interlocking prose contract. Prose has no
type-checker and no test runner, so interaction defects (universal preflight x
lane_build; global severity x absolute-ban tolerance) slip in and only the
serial human/model reviewers catch them - after the fact. Three straight
revisions self-introduced P0s; I predicted "last review" twice and was wrong
both times. The reviews ARE valuable (they find real things) - which is
exactly the evidence that the spec can't be made defect-free by more prose,
because the feedback loop is structurally weak. In CODE, the same two
reviewers become STRONGER: lane_build-can't-start is a failing test caught on
the first run; exactly-once is a property test; the type system enforces the
severity/finding contracts the reviewers keep finding gaps in; and a fix can't
silently regress. The Codex stop-time review gate (enabled this session) points
the machinery at code automatically.

**The honest meta-read:** 9 rounds, architecture stable since v3, no line of
implementation yet - while the goal Jonah set was "let's get to work on it."
Continuing to harden prose trades old defects for new ones asymptotically.
The high-integrity move (shortcuts-are-lies: produce truth, not motion) is to
surface this plainly and let Jonah decide, NOT to keep folding and re-predicting
convergence.

**Put to Jonah:** (a) keep hammering the spec (round 10), or (b) freeze the
spec at v8+P0fixes as the implementation contract, move to writing-plans
(classifier + 5 sequence lanes first; convergence floor second), carry the
open P1s as implementation acceptance criteria, and re-aim Claude+Codex review
at the running code. Recommended (b).

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (2 P0 fixes + 2 acceptance lines)
