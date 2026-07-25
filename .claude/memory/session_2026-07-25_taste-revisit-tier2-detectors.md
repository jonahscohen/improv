---
name: Taste-revisit - Tier-2 detector tuning (tight-leading, blinking-cursor, oversized-h1, marquee)
description: Tuning the 4 weak Stage 4b/4c/4d taste detectors flagged by the A5a grade (350dcd38). Honest precision/recall tradeoff - tune only where real recall rises without tanking precision; report unfixable classes as audit-only or PULL.
type: project
relates_to: [session_2026-07-25_stage4bcd-a5a-results-lead.md, session_2026-07-24_stage4b-typographic-extreme-classes.md, session_2026-07-24_stage4cd-structural-motion-classes.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

Collaborator: Jonah. 2026-07-25. Task from lead after the A5a grade: the 15 taste classes catch constructed fixtures but have WEAK real-world recall. Tune ONLY the 4 worst, honestly.

## The 4 problem classes (from the A5a grade)
- tight-leading: Rreal 0.000, 2 FP (typography-extremes scorer; LEADING_SHARE_MIN=0.10, LEADING_TIGHT_RATIO=1.10, LEADING_MAX_BODY_PX=28, LEADING_MIN_RUN_CHARS=40)
- blinking-cursor: Rreal 0.000, 3 FP (motion scorer; BLINK_OPACITY_LOW=0.1, BLINK_OPACITY_HIGH=0.9, infinite-anim gate)
- oversized-h1: Rc 0.500, Rreal 0.000 (typography-extremes scorer; H1_VW_RATIO=0.11)
- marquee: LOSES to oracle on real recall (0.188 vs 0.563); MARQUEE_MIN_X_PCT=50, MARQUEE_MIN_X_PX=200

## Ownership / constraints
- May touch: src/validators/subjective-rendered-scanner.ts (these 4 classes' scorers/thresholds ONLY), rendered-live-scan.ts if a threshold const lives there, fixtures if adding real-derived cases.
- MUST NOT touch: labels, rubric, product-rule-registry.ts, orchestrator, bins, the other 11 classes (flag if a shared threshold forces it).
- Do NOT edit scripts/run-tests.ts (report the line). Do NOT commit. Do NOT commit dist (rebuild locally only to run the eval, restore via git checkout at end).
- Foreground Codex review (blocking) of threshold changes; A2 precision non-regression on known-good corpus.

## Approach (verify plan)
1. Reproduce BEFORE numbers: SIDECOACH_ORACLE_DETECT=/tmp/oracle-v4/skill/scripts/detect.mjs node eval/stage4bcd-a5a.mjs (baseline running in bg -> scratchpad/baseline.txt).
2. For each class, inspect the real pages MISSED (Codex-present) and FALSE-FIRED, in the labels json.
3. Tune only where real recall rises WITHOUT precision loss; else report audit-only/PULL honestly.
4. Rebuild dist locally, re-run eval, show honest before/after per-class Rreal/precision.
5. tsc --noEmit clean; taste suites (typography-extremes, structural-motion) pass standalone; A2 non-regression.

## Status: INVESTIGATION. Diagnostics from scores-cache (render-once harness).

### tight-leading = CONSTRUCT-MISMATCH (leaning PULL/audit-only)
8 real Codex-present pages ALL missed; their tightestLeading is 1.2-1.5 (linear 1.5, asana 1.5, mintlify 1.33, retool/arstechnica/jasper 1.2) = NORMAL/comfortable leading. Codex notes all say "SMALL body copy appears crowded/dense" - it judges small-font visual density, NOT line-height ratio. The 2 FP (nasa 1.05, polygon 1.10) are the OBJECTIVELY TIGHTEST pages yet Codex labels them absent ("small but readable"). Perfect inversion: no line-height threshold catches linear@1.5 without firing on ~every page. Not fixable via a ratio threshold.

### oversized-h1 = mostly UNFIXABLE (h1-only scoping ceiling)
6 real present pages: 4 (resend/inngest/polygon/nasa) have NO <h1> at all (largestH1Px=0) - hero headline is a div/h2, structurally unreachable by an h1-only detector. gong (present, 0.047) is indistinguishable from many absent pages (trigger/amplitude/databricks/flowbite all 0.047 absent). Only upstash (present, 0.100) is genuinely large but sits below the 0.11 bar; asana(absent)=0.080 is next. Lowering 0.11->0.10 gains ONLY upstash at 0 new FP = 0/6 -> 1/6, razor-thin + overfit to one page. Real ceiling with h1-scope ~1/6.

### marquee + blinking-cursor = keyframe DECLARATION vs hermetic USAGE gap (measured, both UNFIXABLE)
Codex labels from keyframe BODIES (rubric MOTION signal). Our hermetic render STRIPS scripts, so JS-built marquees / focus-driven carets vanish from the DOM while their @keyframes survive in CSS -> Codex(declaration)=present, ours(usage)=absent. Measured firing rules against fixed labels:
- MARQUEE: usage-only (current) Rreal 3/16=0.188 FP 1/26; declared-OR-usage Rreal 13/16=0.813 but FP 9/26 (Preal 0.65) = FALSE FIX. "kf referenced by any element (drop infinite)" gains only +1 page (0.250) and catches a sprite-sheet anim, not principled. Oracle 0.563@3FP is a better operating point we can't reach without eating precision. VERDICT: not threshold-fixable, oracle wins, keep audit-only. NO CHANGE.
- BLINK: usage-only Rreal 0/12 FP 3/30; declared Rreal 0.75 but FP 10-22/30 = FALSE FIX. Keyframe SHAPES prove the double bind: the 3 FP (linear/twilio real code-carets op 1..0..1, amplitude a text-rotator) are GENUINE infinite opacity blinks Codex calls ABSENT (functional caret != decorative idiom - a screenshot taste call we can't read from keyframes); the 12 present carets aren't in the hermetic DOM. Non-monotonic refinement DROPS the fixture (Rc 1/2->0/2, it's a 1->0 square wave). No change raises recall without declaration-firing FP or dropping Rc. VERDICT: recommend PULL / strict audit-only. NO CHANGE.

### oversized-h1 = ONE clean precision-preserving gain (making it)
4/6 real positives have NO <h1> (hero is a div/h2, largestH1Px=0) - unreachable by h1-scope. gong (present, 0.047) indistinguishable from many absent. Only upstash (present, h1=128px=0.100) is catchable, sitting in a clean gap above asana (absent, largest absent h1=102px=0.080). Sweep: threshold 0.09 (115px) catches upstash with 13px margin each side, realFP 0/36, cNegFP 0/43, Rc preserved 1/2. Any-text broadening reaches 0.333 (upstash+inngest) at 0 measured FP but re-scopes the class + adds a big-non-heading-text failure mode (declined - out of lane, wild-corpus precision risk). DECISION: lower H1_VW_RATIO 0.11 -> 0.09 (Rreal 0.000->0.167, precision preserved). Honest ceiling: h1-scoping, 4/6 heroes non-h1.

## VERDICT SUMMARY (1 change, 3 honest unfixables) - VERIFIED

### DONE. One detector change: subjective-rendered-scanner.ts H1_VW_RATIO 0.11 -> 0.09 (+ expanded honest comment).
VERIFIED (real output):
- A5a grader before/after (SIDECOACH_ORACLE_DETECT=/tmp/oracle-v4/skill/scripts/detect.mjs node eval/stage4bcd-a5a.mjs):
  - oversized-h1: Rreal 0.000 -> 0.167 (upstash flips MISS->FIRES, only catchable page); Preal held 1.000 (0/35 real FP); Rc held 0.500; cNegFP 0/43. NOW BEATS ORACLE on real recall (0.167 vs 0.000).
  - tight-leading / blinking-cursor / marquee: BYTE-IDENTICAL before vs after (no change made) - proves scoping.
  - exit 2 both runs = pre-existing databricks oracle 120s timeout (unrelated).
- tsc --noEmit exit 0. typography-extremes.test.ts OK (36 asserted, incl. clean-page A2 non-regression). structural-motion.test.ts OK (64 asserted). Both via ts-node standalone.
- Foreground Codex review (codex-review.py, real codex-cli 0.142.5, exit 0, 42s): "Findings: None" - no precision regression, boundary invariant intact, comment matches behavior.

### VERDICTS (honest, per class):
- oversized-h1: GENUINELY IMPROVED but MODEST. 0.000 -> 0.167 real recall at ZERO precision cost. Ceiling is h1-scoping: 4/6 Codex-present heroes render as NON-<h1> (div/h2, largestH1Px=0) + gong's h1 (0.047) is indistinguishable from tasteful absent h1s. An any-text-in-first-viewport re-scope reaches ~0.333 at 0 measured FP but changes class identity + adds a big-non-heading-text failure mode = LEAD PRODUCT CALL, not taken.
- tight-leading: UNFIXABLE via ratio (construct-mismatch). Codex "crowded" = SMALL-FONT visual density, not line-height/font-size. The 8 missed positives have leading 1.2-1.5 (linear/asana 1.5 = comfortable!); the 2 FP (nasa 1.05, polygon 1.10) are the OBJECTIVELY TIGHTEST pages, Codex-labeled "readable". No ratio catches linear@1.5 without firing on the 1.2 browser default (every page). Recommend PULL or strict audit-only.
- blinking-cursor: UNFIXABLE. Hermetic render strips JS/focus-driven carets -> 12 present carets absent from the DOM (Rreal structurally 0); declaration-firing to catch them = 10-22 FP (every fade/pulse). The 3 current FP (linear/twilio code-carets, amplitude text-rotator) are GENUINE infinite opacity blinks Codex calls "absent" (functional != decorative idiom, a screenshot call). Non-monotonic refinement drops the fixture (Rc 1/2->0/2). Recommend PULL or strict audit-only.
- marquee: UNFIXABLE to oracle parity. Hermetic strips JS-built marquees -> keyframes survive (Codex sees) but no element runs them (we miss). declared-OR-usage = Rreal 0.813 but 9 FP (Preal 0.65 < oracle 0.88) = FALSE FIX. Only precision-preserving tweak gains +1 sprite-sheet page (0.250), not principled. Keep audit-only / accept oracle wins (0.563 vs 0.188).

### CONSTRAINTS honored:
- run-tests.ts NOT edited. No new suite needed: typography-extremes.test.ts (already at run-tests.ts:96) covers the threshold via the IMPORTED H1_VW_RATIO constant, so its boundary assertions auto-track the new value.
- dist NOT committed/left-rebuilt: built locally to run the eval, then `git restore dist/` + removed stray untracked build artifacts -> dist byte-clean = committed HEAD.
- Labels/rubric/registry/orchestrator/bins/other-11-classes UNTOUCHED.
- CONCURRENT SESSION flag: src/sidecoach-orchestrator.ts (+59/-2 domain-validation persistence) + new src/__tests__/domain-validation-coverage.test.ts appeared mid-session (mtimes 09:42-43, NOT mine, NOT build artifacts). Left fully untouched. Not my unit.

## Files touched (mine only): sidecoach/src/validators/subjective-rendered-scanner.ts (H1_VW_RATIO 0.11->0.09 + comment). Nothing committed.
