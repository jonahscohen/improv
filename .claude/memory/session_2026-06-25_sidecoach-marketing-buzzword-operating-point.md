---
name: sidecoach-marketing-buzzword-operating-point
description: Stage 5a - built a Sidecoach-OWN marketing-buzzword subjective detector. Decision record for the precision-first operating point (prominent-scope + two-tier taxonomy + Rule B cluster threshold), grounded in dev measurement + 13 synthetic negatives.
type: decision
relates_to: [session_2026-06-25_stage5-6-kickoff-grounding.md, session_2026-06-24_sidecoach-nested-cards-precision-miss.md, session_2026-06-24_sidecoach-S5-integration-gap-and-plan.md]
superseded_by: session_2026-06-25_sidecoach-buzzword-v2-rebuild.md
---

NOTE (2026-06-25): v1 operating point below COLLAPSED on the frozen-90 (r0.125/p0.25) - it overfit a homogeneous
SaaS-marketing dev corpus. Superseded by the v2 rebuild (register-diverse corpus + holistic density). The v1
detector code/numbers below are retained as the historical record of what overfit and why.

Collaborator: Jonah Cohen. 2026-06-25. Stage 5a builder unit (teammate under lead).

## What was built
An INDEPENDENTLY-AUTHORED marketing-buzzword detector inside `src/validators/subjective-rendered-scanner.ts`
(reimplement-and-own; oracle's detector/wordlist NEVER opened). Reads VISIBLE rendered text (render-basis
parity with the screenshot labeler), focuses on PROMINENT copy, fires on a buzzword CLUSTER.

## Operating point (the decision)
**Scope = PROMINENT copy** (visible, non-peripheral text rendered at fontSize >= 20px = the display/heading band,
~1.25x the 16px comfortable-body standard). Rationale: isolates the page's own value-proposition voice (hero,
section headings, large taglines) from incidental body text, testimonials, footnotes. EMPIRICALLY FORCED by the
`resend` dev negative: resend has 12 distinct buzzwords whole-page (game-changer x6, 10x x3) but ALL in
body/testimonials - labeled "concrete positioning" by the labeler. Whole-page lexical counting conflates
testimonial/social-proof buzzwords with brand voice; prominent-scope does not. (At 18px the resend body buzzwords
re-enter; 20px is the precision boundary AND the readability-grounded display threshold.)

**Two-tier taxonomy** (authored from my own marketing-copy knowledge):
- STRONG (38 entries, unambiguous hype - includes the rubric's own exemplars seamless/powerful/innovative/
  effortless/revolutionary; plus game-changing, supercharge, world-class, next-generation, cutting-edge, invincible,
  unlock, reimagine, 10x, lightning-fast, all-in-one, ...).
- MILD (23 entries, borderline-descriptive that carry concrete meaning: advanced, modern, robust, scalable,
  enterprise-grade, accelerate, streamline, intuitive, purpose-built, ai-powered, ...). Count toward cluster SIZE
  but do NOT alone satisfy the strong requirement.
The strong/mild split is by SEMANTIC VACUITY, anchored on the rubric's 5 exemplars (all STRONG) - NOT tuned to make
a corpus page pass. It is the neon(absent)/trigger(present) discriminator: neon prominent = {enterprise-grade,
advanced} (both descriptive of a database = no fire); trigger prominent = {advanced, invincible} (invincible is
pure hype).

**Rule B (firing threshold, PRECISION-FIRST):** fire iff
`(distinct >= 3 && strong >= 1) || (distinct >= 2 && strong >= 2)`.
Meaning: a genuine lean = a BROAD cluster (>=3 distinct buzzwords incl. >=1 cliche) OR a SHARP cluster (>=2 distinct,
both cliches). A thin 2-word signal carrying a single soft cliche does NOT qualify. Mission rule honored: never
fire on a single stray word.

**Alternatives considered:**
- Rule A `distinct>=2 && strong>=1`: dev recall 0.50 (matches oracle) BUT FP on resend (dev) + synthetic #13.
  Both FPs are the identical mode: a LONG page with 2 scattered soft prominent buzzwords. 18-negative precision 0.80.
  Rejected: that FP mode is exactly the nested-cards trap (looks fine on 5 dev negatives, erodes held-out precision).
- Whole-page lexical scope: rejected (resend proves it conflates testimonials with brand voice).
- Word-specific vacuity weighting to recover trigger while rejecting resend: rejected as corpus-fitting (trigger &
  resend are LEXICALLY IDENTICAL by count: both 2-distinct/1-strong; only a hand-tuned weight could split them).

**Why Rule B:** the mission's governing principle is PRECISION-FIRST and the kickoff explicitly cites the
nested-cards burn ("the gate that BURNED us once - do not repeat it"). Rule B eliminates the one demonstrated FP
mode entirely (0 FP across 18 negatives) at the cost of ONE dev TP (trigger). trigger and the resend-class are
count-indistinguishable, so the conservative rule necessarily drops trigger. Honest recall cost accepted; precision
governs.

**Revisit when:** if the lead's frozen-90 milestone shows held-out precision comfortably >0.5 with headroom, Rule A
(flip the fire condition - one line) recovers recall to ~0.50 to match oracle. The fire condition is written as
a single commented expression to make that flip trivial.

## Measured result (DEV ONLY - never touched candidates/frozen-90)
- Dev (21 pages, 16 present / 5 negative): Rule B TP=7 FN=9 FP=0 TN=5 -> recall 0.4375, dev-neg precision 1.0.
- Precision validated on dev-neg(5) + 13 SYNTHETIC clean-prose negatives (eval/fixtures/buzzword-negatives/) = 18
  negatives total. Rule B FP = 0/18 -> precision 1.00 on 18 negatives. (The nested-cards lesson: >=10 negatives
  required; 13 synthetic authored to probe the FP modes - legal/docs/editorial/changelog/pricing/status/about/faq,
  a concrete product hero, a mild-only cluster (neon-analogue), a single-strong-word page, and the resend-class
  long-page-scattered-soft probe #13.)
- Honest framing for the lead: recall 0.4375 sits just BELOW oracle's held-out 0.50 (one held-out page on 8
  present). Precision is a decisive flip (~1.0 dev/synth vs oracle 0.4). Held-out precision will be <1.0 but the
  FP-mode elimination gives the best shot at holding it high.

## Verification (DEV + SYNTHETIC only; full suite green)
- `npm run build` clean (codegen + tsc, no drift). `npm test` 64 suites passed / 0 failed (kickoff baseline parity).
- Measured the SHIPPING dist module (`dist/validators/subjective-rendered-scanner.js`, not a reimplementation):
  dev TP=7 FN=9 FP=0 TN=5 -> recall 0.4375; synthetic 0/13 FP; precision 1.0 over 18 negatives. Identical to the
  prototype (no drift between design + implementation).
- New unit coverage in src/__tests__/subjective-rendered-calibration.test.ts (8 mb/* fixtures: 2 PRESENT broad/sharp
  cluster, 6 ABSENT - single-word, thin-1strong-1mild=resend-class, mild-only=neon-analogue, body-only, peripheral,
  concrete). 29 calibration assertions pass.

## Codex P2 fold (cross-model review)
Codex found ONE real gap: polish.marketing-buzzword declared evidenceRequirements ['rendered-scan'] but was ABSENT
from RENDERED_BACKED_RULE_IDS (src/validator-generation.ts) - so it was never promoted-to-required on a renderUrl
and never failed-closed when the subjective scan was unavailable (a render attempted-but-unreadable would read as a
false clean for the buzzword dimension). tiny-text (its rendered-subjective sibling) WAS in the set.
FIX: added 'polish.marketing-buzzword' to RENDERED_BACKED_RULE_IDS; regenerated codegen (it now appears in
polish-standard's renderedRuleIds + renderedCoverageByScope, mirroring tiny-text); added behavioral coverage to
src/__tests__/rendered-scan-integration.test.ts (5b promotion+fail, 5c the fail-closed required+inconclusive-blocks,
5d dormant-no-url). Re-verified WHOLE unit: npm run build clean + generate --check OK + npm test 64 suites/0 failed
+ dev numbers unchanged (recall 0.4375, precision 1.0/18-neg - the fix is wiring-only, the detector is untouched).
NOTE flagged to lead: generate --check does NOT guard the inverse invariant (every rendered-scan-evidence rule must
be in RENDERED_BACKED_RULE_IDS) - that missing guard is exactly why this slipped past the first --check; a future
hardening could add it (out of this unit's scope, touches shared generation logic).

## CONCURRENT-EDIT NOTE for the lead (integration sequencing)
A second teammate (Task #5, low-contrast live-wiring) edited the SAME shared tree concurrently: it changed
`a11y.color-contrast` evidenceRequirements ['contrast']->['rendered-scan'] in product-rule-registry.ts and added
`checkLowContrast` to rendered-checks.ts WITHOUT updating the golden row / regenerating validators.generated.ts.
So the combined tree currently shows golden row-3 mismatch + codegen drift - BOTH from Task #5, NOT this unit. My
unit was 64-suites green in isolation BEFORE that edit drifted in; my marketing-buzzword rule is self-consistent
across registry/generated/golden. Lead must sequence the two units' integration (Task #5 needs its golden+codegen
follow-through). I did NOT touch Task #5's checkLowContrast or regenerate (that would land their half-done change).

## Files
- src/validators/subjective-rendered-scanner.ts (rule union + SUBJECTIVE_RULES + inPageSubjective block)
- src/validators/checks/rendered-checks.ts (checkMarketingBuzzword + RENDERED_CHECKS entry)
- src/product-rule-registry.ts + src/validators.generated.ts + src/__tests__/product-rule-registry.test.ts (registry
  wiring + golden row + counts 59 / polish-standard 23 - pattern from feelbetter-gap-implement beat)
- src/__tests__/subjective-rendered-calibration.test.ts (8 marketing-buzzword calibration fixtures)
- eval/scorecard-score.mjs (RENDERED_SUBJECTIVE += marketing-buzzword - availability-gating consistency for the
  frozen-90; mapping is identity so no scorecard-mapping edit needed)
- eval/fixtures/buzzword-negatives/01..13 (synthetic clean-prose negatives)
