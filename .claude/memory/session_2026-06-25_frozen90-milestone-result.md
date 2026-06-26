---
name: frozen90-milestone-result
description: Stage 5/6 frozen-90 milestone RESULT. Objective UNCHANGED 0.936 (detection-preserving held). Subjective precision win holds (significant). BUT the marketing-buzzword detector COLLAPSED on held-out (dev r0.44/p1.0 -> frozen r0.125/p0.25) - same generalization failure as nested-cards. Decision pending (revert vs keep) - re-surfacing to Jonah per the mandate.
type: project
relates_to: [session_2026-06-25_frozen90-milestone-launched.md, session_2026-06-25_sidecoach-marketing-buzzword-operating-point.md, session_2026-06-24_sidecoach-nested-cards-precision-miss.md, session_2026-06-24_sidecoach-motion-flip-verification.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Milestone ran clean (90 pages, sidecoach unavailable on the 2 expected ReDoS pages, oracle 0). scorecard.json regenerated.

## HEADLINE (sidecoach vs oracle)
- OBJECTIVE: sidecoach r=0.936 p=0.917 vs oracle r=0.064 p=0.545. **UNCHANGED from baseline = detection-preserving HELD.** The folds + low-contrast wiring did not move objective (as designed).
- SUBJECTIVE: sidecoach r=0.146 p=0.412 (tp=21/144 det=51) vs oracle r=0.111 p=0.104 (tp=16/144 det=154).
- BOOTSTRAP CIs: subjectiveRecallDiff obs=0.035 ci95=[-0.038, 0.115] = STILL A TIE (crosses zero). subjectivePrecisionDiff obs=0.308 ci95=[0.18,0.441] = SIGNIFICANT WIN. overallRecall [0.286,0.443] WIN, overallPrecision [0.531,0.682] WIN.

## THE MARKETING-BUZZWORD COLLAPSE (the integrity item)
Per-class frozen-90: SC tp=1 fp=3 r=0.125 p=0.25 vs IMP tp=4 fp=6 r=0.5 p=0.4.
- DEV was r=0.4375 p=1.0 (18 negatives). HELD-OUT is r=0.125 p=0.25. Both recall AND precision collapsed = a generalization failure (the dev corpus = 21 SaaS marketing pages, NOT representative of the frozen-90's editorial/dashboard/forms diversity). buzzword HONESTLY pre-flagged the recall risk; precision also fell (3 FP).
- This is the SAME pattern as nested-cards (dev p1.0 -> frozen p0.267, which we DEFERRED). marketing-buzzword frozen p=0.25 is BELOW even that - it FAILS the precision-first shipping gate.
- Net effect on the aggregate: +1 TP (20->21), +3 FP -> subjective precision 0.426->0.412 (still decisive vs 0.104, but eroded). oracle now beats us on the marketing-buzzword class on BOTH axes.
- We CANNOT re-tune to fix the FP (that's training-on-test). The operating point was principled (dev+synthetic); it didn't generalize.

## FP GROUNDING (kills the "register-context" steelman)
The marketing-buzzword detector fired on 4 frozen pages: TP pr_wix_2020 (product); FP mk_gatsby_2020 (MARKETING), pr_github_features (product), ed_smashing_live (editorial). The 3 FP are NOT confined to non-marketing registers - one is a marketing page the labeler judged concrete. So they are genuine over-fires (the detector flags buzzword clusters the labeler accepts), not a context mismatch. It also MISSED 7/8 GT pages incl. both explicit marketing pages (mk_squarespace, mk_tailwind) + the docs. So: over-fires on concrete pages AND under-detects real buzzword pages = a genuinely weak held-out detector; the dev p=1.0 was a narrow-SaaS-corpus artifact. Cannot be salvaged without training-on-test. STRENGTHENS revert.

## THE REAL STAGE 6 WIN (independent of buzzword)
low-contrast (the biggest objective class, r=1.0 p=0.889) is now WIRED to the live NL path (Task #5) - the convergence hole is closed, the headline objective win is DELIVERED to users, not eval-only. This is the genuine Stage 6 achievement and it stands regardless of the buzzword call.

## DECISION PENDING (re-surfacing to Jonah per the convergence-mandate revisit clause)
marketing-buzzword failed the held-out precision gate. Options: REVERT it (restore clean precision 0.426, honestly report it as an oracle-wins class we couldn't close precision-disciplined) vs KEEP it (weak, small net-negative). Lead recommendation = REVERT (precision-first discipline, nested-cards precedent). Surfacing.

## Files touched
- (milestone result beat; scorecard.json regenerated, no src change yet pending the decision)
</content>
