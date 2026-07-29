---
name: overused-font, single-font and bounce-easing now fire in the static lane
description: Row 3 of the detector scoreboard - 4 missed slop tells down to 1, each new rule shipped with a proven mutation control
type: project
relates_to: [session_2026-07-29_detector_marketing-buzzword-claim.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: positive fixture trips all three, clean fixture trips none, canary gate PASS, clean fixture still 0 findings
confidence: high
---

Scoreboard row "Slop tells they catch on the canary that we miss": 4 missed -> 1 missed.
The remaining one is marketing-buzzword, for the reasons in the related beat.

Command that proves it (the scoreboard's own row-3 diff):

    LPX_FIND="$(node <their detect> benchmark/fixtures/canary/canary.html 2>&1 | grep -E '^  line |^  \[')"
    OURS_FIND="$(node bin/sidecoach-detect.js benchmark/fixtures/canary/canary.html --no-render 2>&1 \
      | grep -E '^[[:space:]]+\[(blocking|warning)\]')"
    for tell in overused-font single-font bounce-easing marketing-buzzword gradient-text; do ... done
    # -> MISSED: marketing-buzzword  (count 1)

Three new registry rules under the existing `anti-pattern` owner, checks in
`src/validators/checks/typography-motion-tells.ts`:

- `anti-pattern.overused-font` - a declared family in an overused set, read from `font-family` AND
  from Google Fonts hrefs. The set is OURS, with the rationale recorded per group rather than as a
  bare name list: system/browser defaults (reaching for one is the absence of a decision) and
  generated-UI convergence faces (each wave of AI-generated interfaces lands on the same short list,
  which is what makes a page look generated).
- `anti-pattern.single-font` - exactly one non-generic family across the assembled source. `scope:
  'page'`, unlike its two neighbours, because evaluating it per-file would fire on every
  single-purpose stylesheet in a project that pairs two faces across files.
- `anti-pattern.bounce-easing` - a cubic-bezier whose y control points leave [0,1] past a 0.1
  tolerance (the progress axis overshooting means the animation travels past its destination and
  comes back), plus bounce/elastic/wobble/spring animation names and the `animate-bounce` utility.

All three carry DEFECT locations, since all three fire on presence. On the canary: overused-font and
single-font at line 5 (`body { font-family: Inter ... }`), bounce-easing at line 9 (the
`cubic-bezier(0.68,-0.55,0.265,1.55)`), each hand-verified against the source.

**Severity `minor` (non-blocking) on all three, deliberately.** Each is a taste judgment with a real
counter-example: a deliberate Inter, a single-family page whose hierarchy is carried by weight, a
spring curve chosen on purpose. Shipping them as blockers would gate a build on a matter of opinion.

**Mutation controls, because a detector nobody has watched fail is a hope.**
`benchmark/fixtures/mutation/tells-positive.html` trips all three (proven: 3 findings) and
`tells-clean.html` trips none (proven: 0), using two non-overused families and a decelerating curve.
Neither fixture is the canary, so the rules are exercised independently of the benchmark they were
written against.

**The threshold I refused to invent.** `SINGLE_FONT_MIN_LINES = 20` is adopted from the comparison
tool rather than tuned here, and the code says so. There is no labeled corpus for this rule in this
session, and picking a number that happens to fire on our own canary would be fitting to the test.
Recorded as a follow-up: sweep it when a corpus exists, the way subjective-rendered-scanner.ts
records its operating points.

Gate checks: `generate-validators --check` OK (registry valid, no drift); `npx tsc` exit 0; canary
self-test PASS (18 on planted positive, 0 on known-negative); the CSS-free clean fixture still
reports 0 findings, so the three new required rules resolve to not_applicable rather than firing on
a page with no CSS; all four fail-closed exit codes unchanged.

Files touched: src/validators/checks/typography-motion-tells.ts (new),
src/validators/checks/index.ts, src/product-rule-registry.ts, src/validators.generated.ts
(regenerated), benchmark/fixtures/mutation/tells-positive.html, benchmark/fixtures/mutation/tells-clean.html
