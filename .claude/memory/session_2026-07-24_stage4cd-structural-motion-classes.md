---
name: Stage 4c/4d structural + motion/marker taste classes
description: 10 rendered SUBJECTIVE detectors (7 structural + 3 motion/marker) added to the subjective scanner as two single-source scorers, audit-only, A5a-pending; plus recorded honest exclusions
type: project
relates_to: [session_2026-07-24_stage4b-typographic-extreme-classes.md, session_2026-07-24_stage3c-registry-consolidation.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: stage4cd-teammate
source: session
verified: tests
confidence: high
---

Stage 4c + 4d of the sidecoach upgrade plan (`docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md`). Adds the missing structural + motion/marker taste CLASSES on the rendered Playwright engine, following the 4a/4b single-source split (in-page scorer -> Node threshold) exactly.

**4c structural (7 classes)** - `inPageStructural` (one tree walk + stylesheet read) -> `structuralFindingsFromScore`:
- thin-border-wide-shadow (hairline border + wide shadow-SPREAD, ratio>=4; NOT normal border+blur)
- repeating-stripe-gradients (repeating-linear-gradient or >=6 hard stops)
- text-under-overlay (text over a translucent scrim layered on a url() bg image - STRUCTURE only; hermetic render aborts the image so contrast is unmeasurable, stated in-comment)
- first-viewport-overflow (viewport-height top section that CLIPS overflowing content, not "page taller than viewport")
- decorative-dot-grid (small-tiled radial/grid field)
- soft-radial-glow (large radial-gradient fade-to-transparent or heavy blur() blob)
- image-hover-transform (stylesheet :hover rule naming `img` with a non-none transform)

**4d motion/marker (3 classes)** - `inPageMotionMarker` (DOM + @keyframes/animation read) -> `motionMarkerFindingsFromScore`:
- marquee (`<marquee>` element OR infinite large-translateX keyframe animation)
- blinking-cursor (infinite opacity 0<->1 / visibility blink keyframes)
- numbered-section-markers (prominent standalone decorative numerals; ::before/::after literal content read + font-size prominence gate)

**4d HONEST EXCLUSIONS (recorded in-code, NOT built)**: stock geometric hero ART inside a raster image (DOM-invisible, never OCR); aphoristic-cadence / theater-slop-phrase (copy-semantic, not computed-style; the buzzword density model is the closest we go). Recorded so no later pass claims render-detection of an undetectable class.

**Key precision finding (numbered-section-markers)**: it carries REAL Codex dev labels (present on airtable/calcom/raycast, absent on 45). But airtable renders its 01-04 as CSS pseudo-element counters (invisible to a textContent walk) while polygon (ABSENT) carries literal "01".."06" text tokens. A naive text-count detector false-fires on polygon and misses airtable. Fix: read ::before/::after literal content + gate on display-scale prominence (>=32px) + require a zero-padded/sequential run of >=3. Real recall on the 3 labeled-present pages is bounded (counter() content does not serialize) - reported honestly, not hidden behind fixture recall.

**Why audit-only**: registered in RENDERED_RULE_MANIFEST with ruleId:null (like nested-cards / the 4b classes). A rendered-scan RAW_RULE would trip the inverse invariant -> RENDERED_BACKED_RULE_IDS -> run-validator would consume it as a required decision rule. A5a (held-out Codex detection gate) is PENDING for all 10, so promotion is not intended.

**Status: COMPLETE (built + dev-calibrated + Codex-reviewed, not committed).** All 10 detectors wired into both `analyzeHtmlOnBrowserSubjective` (eval) and `scanRenderedLive` (live), registered audit-only in the manifest, authored in rule-authors.json, 31 fixtures, calibration harness, test file. tsc clean; structural-motion.test.ts 64 asserts exit 0 (all fixtures fire/silent + A2 known-good clean); 6 coupled existing tests green.

**Calibration (dev corpus 48 real pages + 31 fixtures, exit 0).** All 10 fixture-recall R=1.0. numbered-section-markers (only class with Codex dev labels): dev **P=1.000 R=0.000** - all 3 labeled-present pages (airtable=pseudo counter(), calcom=non-padded, raycast=keyboard keys) are DOM-untruthful to catch; honest low recall, not hidden. Presumed-negative dev DETECTION rates (unlabeled; A5a judges defect-ness): text-under-overlay 0/48, thin-border-wide-shadow 1, repeating-stripe-gradients 1, first-viewport-overflow 2, decorative-dot-grid 2, image-hover-transform 2, blinking-cursor 3, marquee 5, soft-radial-glow 10. The high-rate classes (soft-radial-glow 21%, marquee) DETECT REAL common idioms - flagged as "could-not-calibrate-as-defect, A5a-pending" per the plan's low-precision-taste-guess caution.

**Harness exit-semantics refinement (principled, over 4b):** a fire on a LABELED-negative is a real precision regression (exit 4); a fire on a PRESUMED-negative (unlabeled) is a genuine detection reported transparently, NOT conflated as a failure (4b hard-failed on presumed-negatives, safe only because its classes never fired on dev).

**Foreground Codex review: 10 findings, ALL folded + re-verified.** (1) marquee/blink counted any-animation-infinite instead of pairing name<->iteration-count by index (marquee 7->5/48 after fix); (2) marquee keyframe classified by max-abs-translate not travel DELTA (+ bare/mixed-unit 0-endpoint handling); (3) marquee/blink counted before the visibility gate (hidden templates); (4) text-under-overlay ignored layer ORDER (scrim must be above the image) + hasScrimAlpha only checked first color / treated bare `transparent` as scrim; (5) numbered fired on any 3 padded numbers, not a consecutive 01/02/03 RUN; (6) ::before/::after read without display/visibility check; (7) image-hover `\bimg\b` matched `.img-card` + non-subject img (fixed to require img as the selector SUBJECT); (8) first-viewport-overflow keyed off `overflow` shorthand (overflow-x:hidden) instead of overflowY; (9) shadowLengths counted inset-shadow spread; (10) calibration OK line said "0 precision failures" - reworded to distinguish labeled vs presumed-negative.

**run-tests.ts line for integrator (I did NOT edit run-tests.ts - shared-file contention):**
`{ rel: 'src/__tests__/structural-motion.test.ts', required: true },  // Stage 4c/4d: 7 structural + 3 motion/marker taste classes - threshold boundaries + fixtures + A2 non-regression`
(place after the typography-extremes.test.ts line ~96). The calibration harness is NOT gated (matches 4b's typography-extremes-calibrate; run manually after `npm run build`).

**Self-analysis (why the presumed-negative fires happened):** I initially set count>=1 op points expecting rarity, but several 4c/4d idioms (glow, marquee, dot-grid, hover-zoom) are GENUINELY common on modern marketing pages - the dev scan caught this, which is exactly why precision-first calibration on real pages (not just fixtures) is mandatory. The fix wasn't to gut recall to force 0-FP (which would be dishonest for real detections) but to fix true bugs (thin-line stripes, body-scroll-root overflow, keypad numbers) and report the residual honestly.

Files touched: src/validators/subjective-rendered-scanner.ts (+616), src/validators/rendered-live-scan.ts, src/product-rule-registry.ts, src/__tests__/product-rule-registry.test.ts, src/__tests__/structural-motion.test.ts (new), eval/corpus/rule-authors.json, eval/structural-motion-calibrate.mjs (new), eval/fixtures/structural-motion/*.html (31 new).
