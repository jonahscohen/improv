---
name: sidecoach-probe-and-deletion-verified
description: Lead verification of the real-page render probe (design + non-trivial) and the Phase 2 deletion (clean - function gone, guardrails kept, tombstones only)
type: project
relates_to: [session_2026-06-24_sidecoach-stage2-deletion-integrity-catch.md, session_2026-06-24_sidecoach-jonah-gtswap-deletion-blessing.md]
---

Collaborator: Jonah Cohen.

## REAL-PAGE RENDER PROBE (Jonah's real-world caveat) - architect reported 100% agreement
Architect: 16/18 live pages scored, REAL (live nav, scripts+external on) vs HERMETIC (stored capture = the 0.936 input), per-class 16/16 all 5 classes = 80/80 = 100%, zero divergence incl contrast. -> objective 0.936 GENERALIZES to real renders.
MY VERIFICATION:
- DESIGN is a genuine A/B (read real-page-render-probe.mjs): REAL arm = page.goto(liveURL, waitUntil networkidle) then page.evaluate(inPageObjective) = externals+scripts load, identical detection logic; HERMETIC arm = scanObjectiveRendered(stored capture). Skip-on-failure (real-fetch fail -> SKIP, not false-agree) -> the 16 scored both-arms-succeeded.
- NON-TRIVIAL: 11/18 sampled live pages carry objective defects in GT (17 instances: low-contrast x many, skipped-heading, gray-on-color, broken-image on vuejs). So 100% is agreement over REAL detections, not empty-empty.
- The scanner edit enabling the probe = ONE line (function inPageObjective -> export), verified benign, 0.936 byte-identical.
- INDEPENDENT RE-RUN DONE (bo0z5zhhf): REPRODUCED 80/80 = 100% exactly (16/18 scored). Per-page detail CONFIRMS non-trivial: mk_vuejs_live H[broken-image,skipped-heading,low-contrast,gray-on-color] R[same 4] - all 4 defects detected IDENTICALLY in hermetic capture AND live external-render; mk_django/db_tabler gray+low-contrast identical; fm_bsforms heading+contrast identical; every contrast detection agrees across both render modes. DECISIVE: objective 0.936 is NOT a hermetic artifact - it generalizes to real live renders with external CSS/fonts. Jonah's real-world caveat CLOSED, lead-confirmed.

## PHASE 2 DELETION (commit 2d1bf774) - VERIFIED CLEAN
Initial flag: grep found "identical-card-grids" refs still in 3 of the 4 "deleted-from" files. Investigated:
- scanIdenticalCardGrids FUNCTION: GONE. Only remaining mentions = DELETION-TOMBSTONE comments (absolute-ban-detector.ts:148/234, anti-pattern-checks.ts:4/64 - "deleted Stage-2... ReDoS + low-precision"). Good documentation, not dangling code.
- Registry entry + check: DELETED (product-rule-registry tombstone comment confirms; build 30->29 rules, anti-pattern owner 6->5).
- "identical-card-grids" rule-name remnants = the KEPT reference-loader design-guidance entry (reference-loader.ts:317, intentional - the advice stays, the auto-scanner goes) + doc/tombstone comments. Build GREEN, so no live call to the deleted function.
- GUARDRAILS KEPT: taste/fabricated-svg present in taste-validator + icon-source-reference + flow-handlers; hex-in-interactive kept. Eval-excluded only.
RULING: deletion is clean + well-documented (tombstones explain what/why; design guidance preserved). Exactly the ruling executed.

## Pending
- My probe re-run (bo0z5zhhf) -> confirm 100% independently.
- Architect re-measure (running) -> post-deletion scorecard: expect precision ~0.434->~0.457, recall tie, objective 0.936 unchanged, volume down. I'll independently verify.

## POST-DELETION SCORECARD (commit 93cec31a) - VERIFIED, one clarification pending
Official: objective sidecoach 0.936/0.917 (88/94 - UNCHANGED, matches my prior verify). Subjective sidecoach R0.139 P0.426 (tp20/present144/det47) | oracle R0.111 P0.104 (tp16/det154). oracle motion exposed (lt P0.067, be P0.125). icon-tile-stack now 0 (deleted scanner was its only coverage - accepted ReDoS trade, honestly surfaced). 85% of sidecoach TP from owned scanner (tiny-text 15 @P1.0, nested-cards 2 @P0.4).
MY VERIFY:
- Objective 0.936/0.917 = matches my independent verify exactly. No regression. CONFIRMED.
- Sidecoach subjective 20/144=0.139 = matches my OWN mapping-independent recompute EXACTLY (I predicted 20 TP pre-commit). present 144 = my recompute. CONFIRMED.
- CONCLUSION robust + honest: sidecoach wins objective + precision (0.426 vs 0.104, ~4x) decisively; recall TIE (0.139 vs 0.111, both weak, sidecoach's carried by tiny-text); oracle's lead = exposed motion artifact. No overclaim this time (architect surfaced the weaknesses).
- CLARIFICATION PENDING: oracle detected 167->154 (recall 0.125->0.111) - NOT from a sidecoach-side deletion; from the SEMANTIC MAPPING regeneration (the deletion's rule-vocab change deadlocked the semantic pass -> architect re-ran mapping). The re-map UNMAPPED ~13 oracle detections (11 FP + 2 TP). Need the architect to confirm the new mapping is SOUND (more accurate, not a degraded/biased re-roll that happens to lower oracle). Minor (±2 TP, conclusion robust) but a re-map that lowers the competitor must be confirmed principled.

## MAPPING SHIFT - INDEPENDENTLY RESOLVED (bias concern CLEARED)
I checked the scorecard-mapping.json semanticPass methodology directly: "symmetric per-rule Codex semantic pass over UNMAPPED rules of BOTH tools; identical tool-agnostic prompt; NAMESPACE PREFIX STRIPPED so the model is BLIND TO TOOL LINEAGE; Codex decides matchedClass/null; NOTHING auto-mapped by the architect" (rubricSha + descriptionsSha pinned). The mapping is TOOL-BLIND - the architect CANNOT bias it toward sidecoach; Codex maps rules without knowing the tool. The oracle shift (167->154) is tool-blind Codex NON-DETERMINISM on pinned inputs, NOT a biased re-roll. Bias concern CLEARED. (Asymmetry, not bias: sidecoach's owned scanner emits class-NAMES = EXACT-mapped = stable [my recompute=20 TP]; oracle's rules need the semantic map = exposed to its variation. Structural.)
RESIDUAL: reproducibility - the semantic pass varies run-to-run. RESOLUTION: PIN the current effectiveMapping (freeze; don't regenerate on future runs). Current roll is valid (tool-blind); pinning makes the eval reproducible. Conclusion unaffected (oracle ~0.11, precision-crushed, below sidecoach).

## FINAL VERDICT: mission complete, all independently verified
Objective 0.936 decisive + generalizes (probe 80/80 re-run-confirmed); subjective precision 0.426 vs 0.104 decisive; recall TIE (both weak); oracle's lead = exposed motion artifact; SIMPLER (ReDoS deleted precision-positive, guardrails kept); no regressions; held-out intact. Only open item: PIN the mapping (reproducibility hygiene).

## MAPPING SHIFT - FULLY RESOLVED + LEAD-CORROBORATED (commit a12a7dce)
Architect spot-checked it; I independently corroborated. EXACT delta: only border-accent-on-rounded changed - OLD mapped it to side-stripe-borders at MEDIUM (with its own hedge "emphasizes thickness/rounded-corner clash rather than recurring vertical side stripes"); NEW unmaps it at HIGH ("a different idiom"). The 13 = 2 coincidental-TP + 11 FP, all firing on border-TOP/border-BOTTOM (horizontal) while side-stripe-borders is a VERTICAL left/right stripe.
MY CORROBORATION: GT notes confirm the idiom is vertical - db_sbadmin_live "colored LEFT stripes", ed_smashing_live "colored SIDE accents". So border-accent (horizontal) detecting on those pages = right-page-wrong-element = spurious. effectiveMapping confirms side-tab (the LEGIT side-stripe detector) STILL mapped HIGH; only the over-mapped border-accent removed. So the re-map is a genuine CORRECTION (old over-mapped horizontal->vertical idiom), NOT a nerf - oracle precision barely moved (0.108->0.104). Triple-confirmed: tool-blind methodology + rule-reasoning + detection/GT-note level. RESOLVED.
PIN: the committed scorecard-semantic-pass.json is the de-facto pin (map+score FOLD it; only an explicit re-run regenerates). Asked the architect to add an explicit hard pin for durability. Then FULL WRAP.

## PIN VERIFIED (commit 3b7071f4) - eval now reproducible
Architect pinned the semantic-pass artifact (the only non-determinism source - the tool-blind Codex pass), not the whole effectiveMapping (the exact-match layer stays deterministic + tracks legit vocab; a genuine vocab change still aborts via worklist validation, so the pin can't mask drift - good design). MY VERIFY: pinned:true flag set; artifact intact (11 results, semanticMatches=[side-tab->side-stripe-borders], border-accent unmapped); ran scorecard-semantic-pass.mjs myself -> prints PINNED, skips regeneration, ZERO Codex calls. map+score fold the frozen artifact -> official numbers reproduce exactly (architect verified; mechanism lead-confirmed). The eval is now bit-for-bit reproducible.

MISSION COMPLETE - every claim independently lead-verified, now reproducible. Sidecoach beats oracle on every real-capability axis (objective decisive + generalizes; precision decisive), exposed+corrected its only apparent lead (motion artifact), ties honestly on weak taste-recall, is simpler (ReDoS deleted, guardrails kept), no regressions, held-out intact.
