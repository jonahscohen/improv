---
name: buzzword-v2-frozen90-RESULT
description: v2 marketing-buzzword frozen-90 RESULT - the rebuild WORKED. Recall generalized (frozen r0.875, beats oracle 0.5 decisively) where v1 collapsed (0.125). This pushed the AGGREGATE subjective recall from a TIE to a STATISTICALLY SIGNIFICANT WIN (CI off zero) while keeping the precision win significant. Honest caveat - the detector over-fires (frozen p0.333 < oracle 0.4); we win the class on recall, lose on precision.
type: project
relates_to: [session_2026-06-25_buzzword-rebuild-mandate.md, session_2026-06-25_buzzword-v2-p0-fold-verified-measure-next.md, session_2026-06-25_frozen90-milestone-result.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25). Measure ran clean (90 pages, sidecoach unavailable on the 2 expected ReDoS pages).

## HEADLINE (v2 frozen-90)
- OBJECTIVE: sidecoach r=0.936 p=0.917 vs oracle r=0.064 p=0.545. UNCHANGED = detection-preserving held.
- SUBJECTIVE: sidecoach r=0.188 p=0.397 vs oracle r=0.111 p=0.104.
- BOOTSTRAP: subjectiveRecallDiff obs=0.076 ci95=[0.006, 0.156] = **STATISTICALLY SIGNIFICANT WIN** (excludes zero - v1/baseline were TIES at [-0.038,0.115]/[-0.041,0.106]). subjectivePrecisionDiff obs=0.293 ci95=[0.183,0.408] = SIGNIFICANT WIN.

## THE REBUILD WORKED (mission axis)
marketing-buzzword frozen-90: SC tp=7 fp=14 fn=1 **r=0.875 p=0.333** vs IMP tp=4 fp=6 fn=4 r=0.5 p=0.4.
- RECALL GENERALIZED: v1 0.125 (1/8) -> v2 0.875 (7/8). DECISIVELY beats oracle's 0.5. The diverse-corpus rebuild fixed the v1 homogeneous-overfit collapse exactly as intended.
- This single class lifted AGGREGATE subjective recall 0.139(baseline)->0.146(v1)->0.188(v2), pushing the CI OFF ZERO = we now SIGNIFICANTLY win subjective recall (the mission-winning axis that was a tie through v1).
- HONEST CAVEAT (precision): v2 frozen p=0.333 (14 FP / 21 fired) is BELOW oracle's 0.4 and below dev's 0.81. The detector OVER-FIRES on the diverse held-out (same FP mode as the dev FP: marketing-ish-but-concrete pages). So per-class: we CRUSH recall (0.875 vs 0.5), LOSE precision (0.333 vs 0.4). The 14 FP eroded aggregate subjective precision 0.426->0.397 but it REMAINS a significant win (4x oracle's 0.104).

## NET COMPETITIVE POSITION (honest, all AGGREGATE axes now won)
Objective decisive win + DELIVERED live (low-contrast wiring) | subjective recall now SIGNIFICANT win (was tie) | subjective precision SIGNIFICANT win | one engine + simpler. The per-class marketing-buzzword precision (0.333<0.4) is the one honest blemish - oracle's precision edge there is bought at half our recall.

## LAST CLEAN SHOT SPENT
This is the 2nd (final) marketing-buzzword frozen-90 measurement - the held-out is now spent for this class (further re-tunes = contamination). v2 is the committed result. Cannot reduce the 14 FP without a fresh held-out (the FP pages are now known).

## Files touched
- eval/corpus/scorecard.json (v2 measure)
</content>
