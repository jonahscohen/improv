---
name: lane intent detection design v2 - review revision
description: Independent review (3 P0 / 5 P1 / 3 P2) verified and folded into spec v2; Jonah chose wire-converge-now, engine phrase feature, build runLane now
type: decision
relates_to: [session_2026-06-12_lane-intent-detection-design.md]
superseded_by: session_2026-06-12_lane-design-v3-action-model.md
---

Spec revised to v2 after the independent review at
`docs/superpowers/reviews/2026-06-12-sidecoach-lane-intent-detection-design-review.md`.
Every factual claim verified against the codebase before adoption; all checked
out. Jonah's three scope calls (2026-06-12):

**Choices made:**
- `lane_converge` is WIRED this release (not deferred): runLane wraps the
  convergence loop with runFlow + applyFixes injected from the engine;
  truthful exit statuses; e2e convergence/stall/cap/error/interruption tests.
- `/sidecoach <phrase>` is a REAL ENGINE FEATURE: slash-command-router gets an
  unknown-command fallback into the shared lane classifier with structured
  resolution + parser and e2e tests (not a model-only SKILL.md convenience).
- `runLane(laneId, target, context) -> SidecoachResult` IS BUILT NOW on
  FlowExecutionEngine, reusing runCompositeLoop/checkpoint machinery for
  sequence lanes. (I had recommended the lighter document-the-contract path
  on all three; Jonah chose the ambitious option each time - consistent with
  the augment-never-nerf standing intent.)

**Major v2 additions from the review:** design-eligibility gate before lane
scoring (reuses intent-tier targets/standalone; cooldown never grants
eligibility); explicit-verb conflict policy (verb + route-grade lane =
CLASSIFY, never silent expansion; /sidecoach <verb> always wins); coherent
outcome table (eligible + top>=1 always reaches CLASSIFY - classify_floor
dropped); JSON-canonical registry with generated mirrors + parity tests, no
silent TS fallback; full MCP migration (registries, keyword-resolver weighted
scoring for hook parity, resolve-keyword -> classify-intent, schemas, docs,
all test tiers, dist); evidence groups (max weight per group, no
double-counting); occurrence-aware informational suppression; registry
validation + regex compile checks + caps; evidence ids in directives instead
of raw user substrings; named test commands + sidecoach/test-all.sh aggregate
runner; release acceptance targets including zero routes on the non-design
negative corpus.

**Self-analysis (mandatory):** my v1 claim "no TS importers of MODES exist"
was false - `sidecoach/mcp-server/src/registries.ts:22` imports MODE_LIST and
getMode from `../../dist/modes`. Why it happened: I scoped the importer grep
to `sidecoach/src` only, and the consumer imports the COMPILED path
(`dist/modes`), which my source-path pattern would have missed anyway. The
failure mode: treating a narrowly-scoped negative grep as a verified
repo-wide fact. Rule going forward: a "no consumers" claim requires grepping
the whole repo for both the source module name and its compiled/dist path.

**Live evidence captured:** while Jonah pasted the review text, the keyword
hook false-fired the `shape` verb from the pasted document - quoted/discussed
text treated as intent, the same bug family as occurrence-insensitive
suppression. Logged in spec section 3 as motivation.

**Revisit when:** implementation finds runCompositeLoop unsuitable as the
sequence-lane substrate, or convergence-loop fix application cannot be wired
without orchestrator redesign - either reopens the execution-contract scope
question.

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v2 rewrite)
