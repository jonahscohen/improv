---
name: buzzword-rebuild-mandate
description: Jonah REJECTED revert/defer/keep for the collapsed marketing-buzzword detector - "make me a WORKING buzzword detector." Rigorous rebuild mandated - richer diverse dev corpus + a graded detector that matches the holistic label, developed WITHOUT ever touching the frozen-90, targeting beat oracle r0.5/p0.4.
type: decision
relates_to: [session_2026-06-25_frozen90-milestone-result.md, session_2026-06-25_sidecoach-marketing-buzzword-operating-point.md, session_2026-06-24_sidecoach-nested-cards-precision-miss.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## JONAH'S CALL
Presented the 3-option fork (revert / keep / defer) after the held-out collapse. Jonah rejected all three: "make me a WORKING buzzword detector." Directive = do NOT settle for the honest-miss framing; BUILD one that actually generalizes and beats oracle (r0.5/p0.4). This is consistent with the standing mission ([[feedback_sidecoach_mission_beat_oracle]]) - beat oracle on every axis, for real.

## WHY V1 FAILED (root cause, for the rebuild)
Dev corpus = 21 SaaS-marketing pages ONLY = NOT representative. The precision-first prominent-cluster operating point (>=20px scope, distinct>=2-3) overfit that narrow corpus (dev p1.0 was an artifact). On the diverse frozen-90 it got r0.125/p0.25: over-fired on a marketing + product + editorial page (genuine over-fires, not register mismatch) AND missed both explicit marketing pages. The prominent-scope was over-forced by the resend negative (a sample of ONE). marketing-buzzword is a HOLISTIC "buzzword-heavy fluff" gestalt, not a tight prominent cluster - v1 modeled the wrong thing.

## THE REBUILD PLAN (buzzword teammate, lead gates + labels)
Develop WITHOUT ever touching the frozen-90 (training-on-test = eval-disqualifying):
1. Re-derive from the PHENOMENON (holistic buzzword-density across visible copy, not a prominent cluster).
2. Capture a RICHER DIVERSE dev corpus (~15-20 NEW real pages, ALL registers, buzzword-heavy AND concrete-clean), DISJOINT from frozen-90 (dev-corpus-disjoint.test enforces). buzzword captures HTML only.
3. LEAD runs the Codex labeling (author != labeler; buzzword is rule-author, cannot label its own dev pages).
4. buzzword redevelops: graded vacuity-weighted density model, threshold calibrated on the richer LABELED dev set to beat oracle (target r>=0.5 at p>0.4, >=15 diverse negatives behind precision).
5. Freeze on principle+dev, lead runs ONE final frozen-90 measurement + Codex review.

## INTEGRITY GUARDRAIL
The frozen-90 result (r0.125/p0.25, the 3 FP pages, the missed pages) is now KNOWN - it must NOT leak into the redevelopment (no tuning to dodge those specific pages). Develop purely on the new dev signal. This is the LAST clean frozen-90 shot for marketing-buzzword; further iterations would contaminate the held-out.

## STATUS
buzzword dispatched on steps 1-2. low-contrast wiring (the real Stage 6 win) + objective 0.936 + subjective precision win all STAND regardless. The converged-engine scorecard is measured; only marketing-buzzword is being rebuilt.

## Files touched
- (decision beat; rebuild in flight)
</content>
