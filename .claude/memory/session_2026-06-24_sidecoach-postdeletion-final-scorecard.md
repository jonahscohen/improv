---
name: Sidecoach post-deletion final scorecard (regenerated)
description: Official re-measure after the Stage-2 ReDoS deletion + GT swap; honest head-to-head vs oracle
type: project
relates_to: [session_2026-06-24_sidecoach-probe-and-deletion-verified.md, session_2026-06-24_sidecoach-stage2-deletion-integrity-catch.md, reference_honest_final_scorecard.md]
---

Collaborator: Jonah Cohen

## What was done
Regenerated the official scorecard after the Stage-2 deletion of `scanIdenticalCardGrids`
(ReDoS + 0.375-precision) and the eval-exclude of `taste/fabricated-svg` + `taste/hex-in-interactive-state`
(kept in product, excluded from eval scan). The rule vocabulary changed, which staled the committed
semantic-pass artifact; resolving that required the correct bootstrap order.

## The bootstrap fix (root cause + sequence)
Chicken-and-egg: `scorecard-semantic-pass.mjs` reads its worklist from the COMMITTED
`scorecard-mapping.json`'s `unmapped` list, while `scorecard-mapping.mjs` reads the FRESH cache vocab
and then folds the semantic artifact. So a vocab change deadlocks: mapping aborts on the stale artifact,
and the semantic pass queries the stale worklist.

Why: the semantic pass needs the fresh unmapped list, which only mapping produces; mapping needs a
valid artifact to fold, which only the semantic pass produces.

How (the order that breaks the deadlock):
1. Move the stale `scorecard-semantic-pass.json` aside -> run `scorecard-mapping.mjs` exact-only
   (writes the FRESH `unmapped` list, no artifact to fold).
2. Run `scorecard-semantic-pass.mjs` (now reads the fresh worklist; Codex-run, symmetric).
3. Run `scorecard-mapping.mjs` again (folds the fresh artifact -> `effectiveMapping`).
4. Run `scorecard-score.mjs`.

Also required: added a faithful self-description for the newly-unmapped `taste/hero-radial-blob`
to `rule-descriptions.json` (sourced verbatim from src/taste-validator.ts:216), and removed the 3
now-dead sidecoach descriptions (identical-card-grids deleted; fabricated-svg + hex eval-excluded).
The semantic pass FATALs if any unmapped rule lacks a self-description.

## Official post-deletion numbers (all stages exit 0)
OBJECTIVE (sidecoach owned rendered scanner): R=0.936 P=0.917 - UNCHANGED by the deletion.
  - broken-image 1.0/1.0, skipped-heading 1.0/1.0, low-contrast 1.0/0.889, gray-on-color 0.647/0.786,
    justified-text no corpus instances. oracle has ~0 objective coverage (not its design).
SUBJECTIVE: sidecoach R=0.139 P=0.426 | oracle R=0.111 P=0.104.
  - sidecoach subjective TP=20, of which 17 (85%) come from the OWNED rendered scanner:
    tiny-text 15 TP @ P=1.0, nested-cards 2 TP @ P=0.4. Plus gradient-text 1, side-stripe 2.
  - oracle subjective TP=16, spread across side-stripe 5, marketing-buzzword 4, layout-transition 3,
    bounce-easing 2, numbered-section-markers 1, gradient-text 1.
RAW VOLUME 1746, unmapped 14% (the noise rules are gone; healthy map rate).

## Honest framing (LOCKED, lead-mandated)
1. OBJECTIVE: Sidecoach wins decisively (0.936/0.917 vs oracle's ~0 - oracle does not do
   WCAG/CSS-spec checks).
2. Subjective PRECISION: Sidecoach wins decisively - 0.426 vs 0.104 (~4x fewer false positives).
3. Subjective RECALL: TIE / both weak (0.139 vs 0.111). NO taste-recall-superiority claim.
4. oracle's motion "recall lead" EXPOSED as a method-coupled, high-volume-guessing artifact: under
   the observed-motion GT, layout-transition R=0.5 P=0.067 and bounce-easing R=0.667 P=0.125 - it scatters
   dozens of detections to land a few TP.

## Honest caveats surfaced
- icon-tile-stack GT class now has 0 detections (the deleted identical-card-grids semantic mapping was its
  only coverage). Accepted trade: a 0.375-precision ReDoS scanner removed; the class is now uncovered.
- Sidecoach subjective coverage is NARROW by design (tiny-text, nested-cards, gradient-text, side-stripe).
  The "recall tie" is honest: sidecoach is narrow-but-precise; oracle is broad-but-noisy.
- Mild Codex non-determinism in the symmetric semantic pass: this run mapped oracle side-tab ->
  side-stripe-borders (high) but left border-accent-on-rounded unmapped (prior run mapped both). Does not
  move the headline; oracle's side-stripe credit is included either way.
- Precision landed 0.426 (lead's pre-estimate was ~0.457); the difference is the fresh re-collect changing
  the denominator, not a regression. Objective 0.936 reproduced exactly.

## Re-map principled-confirmation (lead integrity check)
The lead flagged that oracle DETECTED dropped 167->154 (recall 0.125->0.111) on the mapping
regen and required confirmation it was PRINCIPLED, not a lucky Codex re-roll that flatters Sidecoach.

The exact delta: `border-accent-on-rounded` went from STALE `-> side-stripe-borders (medium)` to
CURRENT `null (high)`. The STALE mapping's OWN reasoning hedged: "though the rule emphasizes thickness
and rounded-corner clash rather than recurring vertical side stripes specifically." The CURRENT
unmapping is high-confidence: "thick all-around accent border on a rounded card ... a different idiom"
from "recurring vertical side stripe."

Net effect = 13 net-new detections unmapped (border-accent pages that did NOT also fire side-tab):
2 TP + 11 FP. Detection-level spot-check (decisive):
- 2 "TP" were SPURIOUS page-level coincidences (right page, wrong element):
  - db_sbadmin_live: GT side-stripe = "Metric cards use colored LEFT stripes" but border-accent
    detected `border-top:10px`/`border-bottom:10px` (top/bottom, not the left stripe).
  - ed_smashing_live: GT = "Colored SIDE accents recur" but all 12 border-accent snippets are
    `border-bottom`/`border-top` (zero left/right).
- 11 FP all fired on `border-top`/`border-bottom` while GT says "not side stripes" / "no vertical
  stripe borders" / "full colored backgrounds."

VERDICT: PRINCIPLED. `border-accent-on-rounded` detects HORIZONTAL top/bottom card accents;
`side-stripe-borders` is a VERTICAL left/right stripe. Different idioms. The old medium-confidence
mapping was the over-mapping (confirmed at BOTH the rule level and the detection level). The re-map
removed mostly false positives (11) plus 2 coincidental TP; it is NOT a competitor-nerf (oracle's
precision barely moved, 0.108->0.104).

NON-DETERMINISM note: the two runs differing (medium-map vs high-unmap) shows Codex is borderline on
this rule. STABILITY: the committed `scorecard-semantic-pass.json` is the de-facto pin - map+score
FOLD the committed artifact (scorecard-mapping.mjs:113) and only an explicit semantic-pass re-run
regenerates it. Lead verification should run map+score on the committed artifact (reproduces exactly),
not re-run the semantic pass. An explicit pin facility is optional given the artifact is committed +
lead-reviewed.

## Reproducibility PIN (lead-mandated residual, implemented)
The lead cleared the bias concern structurally (the semantic pass is TOOL-BLIND - namespace stripped,
symmetric, Codex-decided, shas pinned - so it cannot be biased toward sidecoach; the 167->154 shift is
tool-blind non-determinism, not a re-roll). Why sidecoach was stable and oracle shifted: the owned
scanner emits class-NAMES (exact-mapped, stable); oracle's rules need the semantic map (exposed to
Codex variation). Structural, not bias.

Residual = reproducibility. Implemented a PIN on the source of non-determinism (the Codex pass):
- Added `"pinned": true` (+ pinnedUtc + pinnedReason) to the committed scorecard-semantic-pass.json.
- scorecard-semantic-pass.mjs now REFUSES to regenerate when the committed artifact is pinned (prints
  PINNED, exits 0, no Codex call). `--force` re-rolls (then re-pin after lead review); `--dry-run` still works.
- map+score still FOLD the frozen artifact deterministically, so effectiveMapping is reproducible. A genuine
  vocab change is still caught downstream by scorecard-mapping.mjs's worklist validation (aborts on staleness).

Why pin the semantic artifact (not the whole effectiveMapping): the exact-match layer is deterministic from
the cache and SHOULD track legitimate vocab changes; only the Codex pass varies. Freezing just the Codex
output makes effectiveMapping reproducible without over-freezing the exact layer.

Verified: semantic-pass (no --force) skipped with byte-identical checksum (66b84791...); map+score reproduced
the official numbers EXACTLY (OBJ 0.936/0.917, SUBJ 0.139/0.426, oracle 0.111/0.104, volume 1746);
effectiveMapping.oracle.semantic = [side-tab -> side-stripe-borders (high)] only, border-accent unmapped.

## MISSION CLOSURE (lead-verified, 2026-06-24)
FULL WRAP declared by the lead, who independently re-verified every leg:
- Objective 0.936 decisive AND generalizes to real pages (real-page render probe 80/80, re-run-confirmed).
- Subjective precision 0.426 vs oracle 0.104 - decisive.
- Subjective recall an honest TIE (both weak; sidecoach's carried by tiny-text).
- oracle's apparent recall lead EXPOSED + corrected (method-coupled motion artifact); the border-accent
  re-map proven a principled over-mapping correction (tool-blind method + rule-reasoning + detection/GT-note,
  triple-confirmed), not a nerf.
- Simpler: ReDoS scanIdenticalCardGrids deleted, guardrails (fabricated-svg, hex-in-interactive) kept +
  eval-excluded. No regressions. Held-out discipline intact.
- Reproducible: lead ran scorecard-semantic-pass.mjs themselves - PINNED, zero Codex calls, artifact intact;
  the eval is bit-for-bit reproducible. Pin design endorsed (froze only the Codex non-determinism; exact-match
  layer still tracks legit vocab; a genuine vocab drift still aborts via worklist validation).
Commits: 93cec31a (official scorecard), a12a7dce (re-map confirmation), 3b7071f4 (reproducibility pin).
Stood down per lead; book closed unless Jonah opens a new thread.

## Files touched
- sidecoach/eval/scorecard-semantic-pass.mjs (reproducibility pin guard: refuse regen while pinned)
- sidecoach/eval/corpus/rule-descriptions.json (removed 3 dead, added hero-radial-blob)
- sidecoach/eval/corpus/scorecard-semantic-pass.json (regenerated, symmetric Codex)
- sidecoach/eval/corpus/scorecard-mapping.json (regenerated, effectiveMapping)
- sidecoach/eval/corpus/scorecard.json (regenerated, official numbers)
