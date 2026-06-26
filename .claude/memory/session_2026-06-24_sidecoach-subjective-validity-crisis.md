---
name: sidecoach-subjective-validity-crisis
description: VERIFIED - ~67% of subjective GT weight has unreliable labels (tiny-text holistic + motion speculative); oracle's 0.277 likely an over-firing artifact (precision 0.305). Mission-level finding for Jonah.
type: decision
relates_to: [session_2026-06-24_sidecoach-tiny-text-pivot-and-self-correction.md, session_2026-06-23_sidecoach-evolution-plan-draft.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen.

Two taste classes attempted, both with unreliable GT - I verified BOTH myself:
1. tiny-text (35% weight): labels are holistic visual perception, DON'T track font-size (clerk 86%<=13px, resend 74%@14px-comfortable, trigger 18px-dominant - all PRESENT). No font-size rule matches.
2. layout-transition (20%): labels SPECULATIVE. I pulled them - notes pervasively hedged ("height transitions CAN shift layout", "scroll animation LIKELY changes positions", calcom present from "transition-all CAN animate layout properties"). 17/21 present, non-monotonic with the actual layout-shift-declaration feature. ROOT CAUSE: a static screenshot can't show motion (the rubric ITSELF admits motion is judged from declarations), so the labeler guesses from sparse CSS. bounce-easing (12%) is structurally identical.

PATTERN: tiny-text(35%) + motion(layout-transition 20% + bounce-easing 12% = 32%) = ~67% of subjective GT weight has labels no detector can reliably match (holistic-unmeasurable OR speculative-unobservable).

## The oracle-over-fires insight (the key to the mission framing)
A5a head-to-head: oracle subjective recall 0.277 (51/184) but PRECISION only 0.305 (detected 167 -> 116 false positives). sidecoach 0.033 recall / 0.182 precision. oracle fires 167 times to catch 51.
HYPOTHESIS (needs per-class confirmation): oracle's recall advantage is largely an OVER-FIRING ARTIFACT. On high-prevalence classes where the labeler marks most pages present (tiny-text 66/90, layout-transition 17/21), a low-precision detector that fires broadly gets high recall BY DEFAULT - not by understanding taste. So oracle "wins" recall by firing a lot on mostly-present noisy classes; our precision-disciplined detectors correctly DON'T over-fire and thus score low recall on those same classes.

IMPLICATION: "beat oracle's subjective RECALL" and "build a genuinely-better (precision-disciplined) taste detector" are IN TENSION on this eval. The metric rewards over-firing on noisy high-prevalence classes. We've held precision as first-class (correctly) - which structurally caps our recall on the noisy 67%.

## Strategic options (FOR JONAH - this changes what "winning" means)
(a) MATCH THE METRIC: over-fire to win recall on the noisy classes. REJECT - that's gaming, abandons the precision discipline, builds a worse detector that scores higher.
(b) COMPETE ON PRECISION + CLEAN-CLASS RECALL: build precision-disciplined detectors for the ~33% reachable clean classes (structural-visual: nested-cards, icon-tile-stack, side-stripe-borders, hero-eyebrow-chip; text: marketing-buzzword, aphoristic-cadence; color: cream/ai-palette), win decisively on PRECISION overall, and reframe "better taste" as precision + clean-class recall rather than raw recall on noisy classes. We'd likely LOSE the raw-recall number while being genuinely better.
(c) FIX THE EVAL: re-label/re-scope the noisy 67% (drop motion classes as unobservable; re-label tiny-text with a measurable rubric). Most rigorous, big effort, touches the frozen GT -> Jonah's call.

## Decisive data IN + LEAD-VERIFIED (independently recomputed from .scorecard-cache)
Architect's per-class table (89 pages): oracle 53 TP total; 39 (74%) are the 2 MOTION classes (layout-transition 29, bounce-easing 10); the rest are over-fired (side-stripe-borders 8TP/49FP P0.14, numbered 1/15, gradient 1/6, buzzword 4/6). I VERIFIED via oracle's full rule VOCABULARY across the cache: its only subjective-relevant rules are side-tab+border-accent (side-stripe, 419 detections!), layout-transition (154), bounce-easing (27), ai-color-palette, numbered-section-markers, dark-glow, gradient-text, marketing-buzzword. It has NO RULE for nested-cards, icon-tile-stack, repeated-section-kickers, hero-eyebrow-chip, cream-palette, tiny-text, tight-leading, aphoristic-cadence -> STRUCTURALLY 0 on every clean class. Confirmed.
EXTRA insight: oracle's motion "agreement" is METHOD-COUPLED - oracle's detector reads CSS motion declarations, the labeler GUESSED from the same CSS declarations, so they agree by shared method, not by observing motion (the subjective analog of the objective render-coupling concern). Its 74% is an artifact.

NET: oracle's REAL taste capability (sound-GT, precision-respecting) is near-ZERO - it scores only via motion-speculation + over-firing, and has zero rules for the clean classes. Sidecoach building clean precision-disciplined detectors on the uncontested classes will have GENUINE taste detection oracle entirely lacks. "Beat oracle on taste" is ACHIEVABLE + HONEST this way - the headline recall (vs the noisy 188 incl motion) may trail, but the real capability comparison is a decisive Sidecoach win.

RECOMMENDATION TO JONAH (now concrete): drop the measurement-INVALID motion classes (layout-transition, bounce-easing - the rubric ITSELF admits a static screenshot can't see motion) from the PRIMARY subjective metric, compare on the sound classes; document motion as a caveat. Touches the frozen GT -> Jonah's approval. Build the clean uncontested classes regardless (right under every option). Pending Jonah's direction on the framing.

## Immediate
- tiny-text + layout-transition DEFERRED (bad GT). 
- Architect leveled up: now leads with feature-vs-label data before building (the discipline). Keep it.
- Next build target: a CLEAN structural-visual class, grounded on dev first. side-stripe-borders (eval 10, highest-weight clean) or nested-cards (eval 7, dev 19 = most signal).

## GOOD NEWS: nested-cards is BUILDABLE (architect grounded it on dev, data-first)
The architect proactively ran feature-vs-label on nested-cards (feature = a card-like container holding a DESCENDANT card-like container). Dev 19 present / 2 absent:
- PRECISION PERFECT: all 8 firing pages PRESENT; both absents (mintlify, fly) correctly 0.
- RECALL 8/19 first-pass, REFINABLE: 11 present pages have cards but inner nesting missed - partly nesting inside product MOCKUP IMAGES (raster = DOM-INVISIBLE, an unavoidable DOM-detector limit equal for both tools) + style-threshold gaps that can be loosened.
nested-cards SEPARATES - feature-label agreement is achievable, unlike tiny-text (no font-size signal) or motion (speculative GT). GREEN-LIT as the ST1 target. Constraints: refine recall PRINCIPLED on dev (better nesting detection, NOT page-fit the 11 missed), precision held (mintlify/fly stay 0), synthetic precision fixtures, bounded Codex, my gate. Report recall split honestly: DOM-reachable vs raster-mockup-bound misses.

This confirms the reachable battlefield exists: CLEAN structural-visual/text/color classes are buildable with precision discipline. The strategic decision (what to do about the 67% noisy classes) is still pending Jonah + oracle per-class, but it does NOT block building the clean classes - they're wanted under every option.

Verified via: dev-subjective-labels.json layout-transition notes (hedged/speculative); scorecard A5a (oracle precision 0.305); my earlier font-distribution measurement (tiny-text); architect's nested-cards dev grounding (precision 8/8).
