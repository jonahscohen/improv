---
name: Capability breadth - long-tail design guidance (font-pairing + clamp fluid type)
description: Survey of borrow-list long-tail rows 19-33; built font-pairing composition + clamp() fluid type-scale as SHARED_DESIGN_LAWS.typography guidance
type: project
relates_to: [session_2026-07-25_typeface-line-fuller-validation.md, session_2026-07-23_borrow-list-reconciliation.md, session_2026-07-23_sidecoach-upgrade-plan.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + build + codex
confidence: high
---

# Capability breadth: the documented-only long-tail

Task: take on "capability breadth" - the long-tail design capabilities that the borrow-list
reconciliation (`docs/superpowers/plans/2026-07-23-borrow-list-reconciliation.md`, section 5,
rows 19-33) listed as OPEN + UNSCHEDULED and never built. NOT to build all 15 (that is sprawl),
but to survey, rank by value x tractability, and build the 1-2 highest-value self-contained ones
end to end.

## Ranked survey of the long-tail (rows 19-33), by value x tractability

Guidance-only = a prose rule appended to a `SHARED_DESIGN_LAWS.<domain>.rules` array (reaches
building models verbatim via flow-handler-design-tokens + flow-handler-font-research). That is the
self-contained, testable shape. Validator/engine = needs a new detector/loader, not self-contained.

| Rank | Row | Gap | Shape | Value x tractability |
|---|---|---|---|---|
| 1 | 20 | Font-pairing composition (display + text face, one sans + one serif) | guidance-only (typography) | HIGH x HIGH - composes with the just-shipped typeface-selection line; pairing failure is common; names concrete safe pairings. BUILT. |
| 2 | 21 | clamp() fluid type-scale between breakpoints | guidance-only (typography) | HIGH x HIGH - modern technique AI under-uses; one concrete formula; real WCAG-zoom gotcha makes it truthful. BUILT. |
| 3 | 19 | Heading-size-by-role (card-title vs modal-title vs display) | guidance-only (typography) | MED-HIGH x HIGH - concrete sizing table; AI tends to flatten all headings. Strong next pick, deliberately left. |
| 4 | 24 | iOS 100vh trap (svh/dvh/lvh) | guidance-only (responsive) | MED-HIGH x HIGH - very concrete real bug. Good next pick. |
| 5 | 22 | Frequency-first motion matrix (100+/day = no animation) | guidance-only (motion) | MED-HIGH x HIGH - double-sourced (05-25 + 06-12); "should this animate at all". |
| 6 | 26 | Bencium 5-tier breakpoint table + pattern transitions | guidance-only (responsive) | MED x HIGH - canonical responsive model. |
| 7 | 23 | Motion sophistication (Emil easings, asymmetric enter/exit, Framer x/y) | guidance (motion) | MED x MED - OVERLAPS existing motion.rules ("exit 75% of enter", "ease-out entrance/ease-in exit"); only named-easings + Framer x/y gotcha are net-new. |
| 8 | 28 | hero-eyebrow accent-bold refinement | guidance (typography) | LOW-MED x HIGH - narrow taste refinement. |
| 9 | 29 | Strategic Omissions / "what AI forgets" (legal, 404, skip-to-content, cookie) | guidance/checklist (multi-domain) | MED-HIGH x MED - spans domains, larger than one rule. |
| 10 | 25 | Saturated-aesthetic lanes / 2nd-order category-reflex AVOID-list | partial engine (category-reflex/loader) | MED x LOW - already partially built (CATEGORY_REFLEX.oversaturated_families via reference-loader); negative avoid-check touches the loader. |
| 11 | 27 | ALWAYS-ASK protocol | process/orchestrator behavior | MED x LOW - not a design-laws rule; overlaps shape's questions. |
| 12 | 30 | fact-check / plan-review-vs-codebase / banned-truncation | process | LOW x LOW - out of design-laws frame. |
| 13 | 31 | Surface-purpose modes replacing the register | product decision | n/a - explicitly deferred (Section 6), Jonah's call. |
| 14 | 32 | Domain-coverage cluster (data-viz palettes, security-as-UI, empty-state taxonomy...) | many separate efforts | LOW - aspirational cluster; sprawl. |
| 15 | 33 | Lineage-B capability cluster (Forms validator, gesture physics, chart-type matrix, CSS Scroll/View Timelines) | validators/engines | LOW - not self-contained; each is a validator, high effort. |

## What I built (and why these two)

Picked rows 20 + 21: both guidance-only, both live in `SHARED_DESIGN_LAWS.typography.rules`, both
compose with the recently-added typeface-selection line (session_2026-07-25_typeface-line-fuller-validation),
both testable, zero new engine. Building both keeps the change coherent (one domain, one test file) -
tight, not sprawl. Chose the pair the task named as strongest.

**Why guidance-only is the right shape (How):** flow-handler-design-tokens.ts and
flow-handler-font-research.ts map `SHARED_DESIGN_LAWS.typography.rules` VERBATIM into the guidance
lines that reach building models (`typography.rules.map((rule) => `- ${rule}`)`). Array membership IS
emission. No detector warranted - these are compositional guidance ("pair deliberately", "scale with
clamp"), not geometry a scanner reads. Kept them guidance, mirroring the typeface line.

Two rules appended to `typography.rules` (after the typeface line), in existing voice, no emojis/emdashes:

1. **Font-pairing (row 20):** "Pair typefaces deliberately, and cap it at two: give one characterful
   display face to headings and one readable text face to body, contrasting across classification (one
   serif with one sans) while sharing a mood. Safe self-contained pairings from the OS-installed faces
   above: Futura or Gill Sans headings over Charter or Iowan Old Style body; Baskerville or Cambria
   headings over Avenir or Optima body. One family used everywhere is fine when it is carried by real
   weight and size contrast, and a superfamily drawn as a matched sans-plus-serif set is the safest pair;
   a third typeface is noise. Never pair two faces from the same class, since two similar sans read as a
   mistake rather than a decision."
   - Consistency: the named faces are a strict subset of the faces the typeface-selection line names
     (serif: Iowan Old Style/Charter/Baskerville/Cambria; sans: Optima/Avenir/Futura/Gill Sans). The two
     typography rules cannot contradict each other on which faces are "chosen". Guarded by the test.

2. **clamp() fluid type-scale (row 21):** "Scale display and heading type fluidly with clamp() between
   breakpoints instead of fixed sizes or a stack of media-query font-size overrides: font-size:
   clamp(MIN, PREFERRED, MAX), where PREFERRED mixes a rem base with a viewport term, e.g., clamp(2rem,
   1.5rem + 2.5vw, 3.5rem). The rem term is mandatory: a pure-vw preferred value defeats browser zoom and
   fails WCAG 1.4.4 (text must still reach 200%). Use one clamp per scale step so the hierarchy breathes
   between a min and a max viewport while preserving the >=1.25 ratio at both ends; keep body text on a
   fixed rem so measure stays stable."
   - The mandatory-rem / WCAG-1.4.4 clause is the load-bearing, truthful part: a "use clamp()" rule
     without the pure-vw zoom caveat is actively harmful. Guarded by the test.

## Test

`src/__tests__/typography-fluid-pairing.test.ts` (plain-assert, pure, mirrors typeface-vocabulary.test.ts):
- both rules present in `SHARED_DESIGN_LAWS.typography.rules`;
- clamp rule carries the mandatory-rem / WCAG-1.4.4 zoom caveat (discriminating: a clamp rule without it fails);
- pairing rule caps at two families ("a third typeface is noise") and names concrete pairings;
- CONSISTENCY guard: every human-face name in the pairing rule is also named in the typeface-selection line (single-source, mirrors the vocabulary drift-guard);
- EMISSION guard: flow-handler-design-tokens.ts + flow-handler-font-research.ts source map `SHARED_DESIGN_LAWS.typography.rules` into guidance (so any added rule reaches builders).

## Verification (finalized)

- `npm run build` green (exit 0) - generate-lanes/validators/counter-rules + tsc, no drift.
- new test PASSES via ts-node (both rules present, clamp WCAG-1.4.4 caveat, two-family cap, consistency, emission).
- Negative controls (scratchpad, proved each load-bearing assertion BITES): stripping the clamp WCAG/rem caveat
  -> clampOk FALSE; removing the two-family cap -> pairCapOk FALSE; removing a handler's map+spread -> emits FALSE
  (both handlers); injecting 'Roboto'/'Times New Roman' -> disallowed-face guard fires. Not vacuous.
- Codex 0.142.5, TWO foreground rounds:
  - R1: 4 findings (no blockers). (1) MED content: "Never pair two faces from the same class" overbroad ->
    SOFTENED to allow same-class pairs with a real contrast axis (weight/width/optical-size/era), serif+sans
    the safe default. (2) MED test: emission guard matched ANY `.typography.rules` reference (incl. non-emitting
    ones) -> TIGHTENED to require the actual map+SPREAD shape, tracing domain-local -> mapped-local -> spread.
    (3) MED test: no rejection of disallowed faces -> ADDED a DISALLOWED_FACES negative guard. (4) LOW test:
    bare `200%` could satisfy the WCAG check -> now requires literal `WCAG 1.4.4`. Codex independently confirmed
    the pure-vw / WCAG-1.4.4 claim is CORRECT (cited W3C F94). All 4 folded + each backed by a negative control.
  - R2: all 4 folds confirmed addressed, NO new content defect. R2's one new finding (the test is absent from
    scripts/run-tests.ts SUITES) is the EXPECTED reporting-contract gap, not a code defect: I was told not to
    touch run-tests.ts and to report the entry for the lead. Handled below, not by editing the runner.
- dist restored to HEAD (source-only diff: design-laws.ts M + new test ??); run-tests.ts NOT edited; NOT committed.

run-tests entry for the lead to add (keeps alph.-ish grouping with the other typography/typeface suites):
`{ rel: 'src/__tests__/typography-fluid-pairing.test.ts', required: true },`

### Self-analysis (why the emission guard took three passes)
The source-scraping emission guard was FIRST too narrow (literal `SHARED_DESIGN_LAWS.typography.rules` only -
failed immediately because font-research emits through a local alias), then after fixing that it was too LOOSE
(a bare reference passed - Codex R1 caught it). Failure mode: I asserted TOKEN PRESENCE instead of the
load-bearing SHAPE. Lesson for future source-guards: assert the actual dataflow shape you care about
(here: map -> spread into the guidance array), not that a symbol merely appears. The test's own first-run
failure (too narrow) and Codex's R1 (too loose) bracketed the correct assertion from both sides.

### Flagged in passing (NOT fixed - out of scope)
flow-handler-font-research.ts:86 hardcodes the guidance label `'Typography Domain Rules (16 principles):'`.
That count was already stale before this change (typography.rules had 9 entries, not 16) and my two additions
make it 11 - still not 16. It is a pre-existing literal, unrelated to the guidance additions; deriving it from
`.length` is a handler-logic change out of this task's scope. Flagged for a separate task.

## Deliberately left (so it is not mistaken for done)

Rows 19, 22, 24, 26 are all tractable guidance-only next picks (ranked 3-6 above) but NOT built - the
brief was 1-2, not the whole tail. Rows 23/28/29 are guidance but lower value or overlapping. Rows
25/27/30/31/32/33 are NOT self-contained guidance (engine work, process protocols, or product
decisions) and were correctly left out of a guidance pass.

Files touched:
- sidecoach/src/design-laws.ts (2 rules appended to typography.rules)
- sidecoach/src/__tests__/typography-fluid-pairing.test.ts (new)
