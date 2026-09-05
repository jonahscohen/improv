---
name: TASTE-MAP 13-CANDIDATE CONTRADICTION + OVERLAP ASSESSMENT
description: Authoritative sidecoach-consolidate map of the 13 mined net-new candidates vs the live registry; 0 real contradictions, all 5 reasoned candidates refuted; two engine findings (contradiction pass is distilled-only; proposed-rule->DistilledRule is lossy).
type: project
relates_to: [session_2026-08-25_consolidation-map-built.md, session_2026-08-25_consolidation-contradiction-model.md, taste_mine_2026-08-26.md]
author_human: Jonah
author_model: claude-opus-4-8
machine: Mac
source: session
verified: engine-run (sidecoach-consolidate map --dry-run --json, exit 0)
confidence: high
---

Authored against commit 89bc1355. Read-only analysis: no rules/registry/hooks modified, no commit.

## Task
Run the authoritative sidecoach-consolidate contradiction/overlap map on the 13 mined
NET-NEW candidates (data/proposed-rules/*.json minus the 8 polish.* strengthenExisting)
via `--distilled`, reconcile against the live registry, and confirm/refute the 5 reasoned
contradiction candidates against REAL registry contents. Prior (EPERM-blocked) agent had
only reasoned about these; this pass ran the REAL engine. Tree was clean (no EPERM flap).

## Re-run gate (both green)
- `node bin/sidecoach-consolidate.js --help` -> exit 0
- `map --dry-run --json` (headless baseline) -> non-empty, 211 liveRules, exit 0

## The 13 net-new (fed via --distilled)
a11y.icon-button-name, a11y.interactive-div-onclick, a11y.outline-none-no-replacement,
a11y.positive-tabindex, a11y.viewport-zoom-locked, color.p3-no-srgb-fallback,
layout.physical-inset-not-logical, motion.animate-layout-property, motion.ease-in-on-ui,
motion.ui-duration-over-300ms, typography.input-font-below-16px, typography.measure-uncapped,
typography.thin-weight-text. (The 8 polish.* are the separate strengthenExisting bucket.)

## Authoritative map result (13 via --distilled, mechanical normalization)
- 13 distilledClusters, ALL single-source (covered 0, additive 0) -> confirms NO strong-identity
  overlap with the 211 live rules (corroborates miner dedup duplicateDropped=0).
- contradictionsByType ALL ZERO (direction-pair 0, hard-vs-hard 0, standard-calibration 0, cross-type 0).
- 13 normalizationWarnings: every candidate normalized to `principle-guidance`
  ("unknown or missing type '?' -> principle-guidance").

## FINDING A (engine architecture): contradiction pass is DISTILLED-vs-DISTILLED only
buildMap groups ONLY the `distilled` array by normalized axisSubject and runs
classifyContradiction pairwise within it. Live registry rules enter ONLY as
`ruleStoreConcepts` (concept + axisSubject + store + ref) for the OVERLAP/dedup path -
they are never DistilledRule objects (no type/polarity/measured) and can NEVER be a
classifyContradiction operand. So feeding the 13 via --distilled reconciles them against
the registry for OVERLAP ONLY, not for contradiction. Assessing candidate-vs-built-in
contradiction requires re-expressing the built-in as a typed DistilledRule fed alongside.
Why this matters: it is the exact reason "contradiction between the 13 and built-ins was
UNASSESSED" - the map, as designed, has no distilled<->registry contradiction path.

## FINDING B: proposed-rule JSON -> DistilledRule is LOSSY in the contradiction-critical fields
The proposed-rule JSON is a ProductRuleDefinition + provenance. It carries NO
type / polarity / measured / claim / axisSubject / concept. A mechanical normalization
therefore types ALL 13 as principle-guidance, and classifyContradiction rule (6) nulls
every pair (a principle-guidance is involved -> null). The mechanical path is structurally
incapable of surfacing any contradiction. Typing the candidates needs a SEMANTIC pass
(read each rule's meaning to assign hard/measured/direction + polarity/measured value) -
a judgment step, not a transform. This is the "if normalizing is lossy/blocked, say so": it
is lossy, precisely in the dimension the contradiction pass keys on.

## Semantic experiment (REAL engine, closing the gap)
Typed the candidates by meaning + injected the closest real built-ins on aligned axisSubjects
+ one positive control. Results proved the wiring:
- POSITIVE CONTROL: thin-weight-text (hard ban) vs an allowlisted oracle/bolder DESIGN-DIRECTION
  on axis "thin weight text" -> cross-type fired (directionLabel resolved to `bolder`). Proves
  the engine WOULD flag candidate #1 IF a thin/light-weight direction existed.
- outline-none typed `ban` vs focus-visible typed `mandate` -> hard-vs-hard fired, but this is a
  TYPING ARTIFACT: both semantically push the SAME way (ensure a visible focus). Re-typed both
  honestly as `mandate` -> artifact vanished, 0 contradictions. Confirms candidate #3 is complementary.
- Honest typing of all candidates + real built-ins (focus-visible, tiny-text) -> 0 contradictions
  of every type. True negative.

## The 5 reasoned candidates - all REFUTED against real registry (63 keys) + craft-laws + direction deck
Registry has NO counterpart for any of the 5. BUT the craft-laws GUIDANCE store (the miner's
own source) holds soft-principle NEIGHBORS that AGREE with 4 of them (map's lexical dedup missed
these - different slugs, so it reported single-source):

1. thin-weight-text ban vs a light/thin-weight DIRECTION -> REFUTED. No thin/light text-weight
   direction exists anywhere. "light" in the deck = colors / icon-stroke / light-mode substrates;
   quieter.md explicitly warns AGAINST "small and light". craft-law `law/typography/weight-discipline`
   ("body at 400/500; Thin and Light drop contrast below 4.5:1") treats thin weight ONLY as a defect.
   Rec: KEEP - additive (operationalizes weight-discipline). needs-Jonah ONLY if he ever adds a
   thin-weight design direction to the deck (engine control proves it would then flag cross-type).

2. ui-duration-over-300ms vs existing motion duration rules -> REFUTED. Registry has no duration rule.
   craft-law `law/motion/duration-budget` says "UI motion under 300ms; 'over 300ms with no stated
   reason' is a finding" - IDENTICAL threshold + IDENTICAL exception. Candidate is the DETECTOR for it.
   Rec: KEEP - additive/operationalizes; not even a calibration disagreement (300ms agrees exactly).

3. outline-none-no-replacement vs a built-in prescribing outline removal -> REFUTED. Nothing
   prescribes outline removal. a11y/focus-visible + craft-law focus-visible-ring are SAME-polarity
   complementary (all mandate a visible focus). Rec: KEEP - complementary to a11y/focus-visible.

4. input-font-below-16px vs the tiny-text ban -> REFUTED. Distinct axes/properties: iOS-zoom input
   floor (16px on input/textarea/select) vs general legibility (polish/tiny-text). No shared axis.
   Rec: KEEP - calibration-distinct.

5. measure-uncapped vs an existing measure rule -> REFUTED. Registry has none (text-wrap-balance /
   typography-rhythm don't cap measure). craft-law `law/typography/measure-cap` ("45-75 chars,
   max-width 65ch") is the SAME direction/band as the candidate's ~75ch. Rec: KEEP - additive
   (operationalizes measure-cap); ~75ch is consistent with the 45-75/65ch law.

## Net
0 real contradictions among the 13 and 0 against the live registry/deck. 4 of 5 candidates
OPERATIONALIZE an existing soft craft-law (same direction, agreeing thresholds); none conflicts.
All 13 are net-new vs the registry (single-source). The two engine findings (A, B) explain why
the contradiction-vs-built-in question needed a semantic-typing + injection pass, not the bare
--distilled path, to answer.

## Files touched
- None in the repo (read-only). Scratch inputs written to session scratchpad only.
