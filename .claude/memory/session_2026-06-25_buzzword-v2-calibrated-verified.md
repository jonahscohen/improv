---
name: buzzword-v2-calibrated-verified
description: buzzword v2 calibrated + wired; lead INDEPENDENTLY re-ran the calibration and reproduced R0.81/P0.81 at thr=1.0 (densNoTesti) over 17 diverse negatives - both axes ~0.3-0.4 above oracle's 0.5/0.4. Principled threshold. Build green. Next = Codex review + the ONE final frozen-90 measure (last clean shot).
type: project
relates_to: [session_2026-06-25_buzzword-v2-labels-ready.md, session_2026-06-25_buzzword-rebuild-mandate.md, session_2026-06-25_sidecoach-buzzword-v2-rebuild.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## V2 OPERATING POINT (buzzword, lead-verified)
scope = densNoTesti (visible non-peripheral content text, testimonial-excluded); vacuity-tiered taxonomy PEAK(3)/STRONG(2)/MILD(1); FIRE when weighted density >= 1.0 (per 100 content words).
- LEAD INDEPENDENT RE-RUN of eval/buzzword-calibrate.mjs reproduced EXACTLY: 48 labeled pages (31 present/17 neg), thr=1.0 -> TP=25 FP=6 FN=6 TN=11, R=0.806 P=0.806 F1=0.806. Matches buzzword's report; zero drift (shipping dist).
- Sweep is monotonic + sane (thr 0.75 R0.87/P0.77 -> thr 2.0 R0.48/P0.94). 1.0 is the balanced principled cut (~2.5x the concrete-register ceiling ~0.4 where docs/editorial/gov cluster), NOT a corner-hunt.
- BEATS oracle on BOTH axes (oracle r0.5/p0.4; v2 dev r0.81/p0.81). Decisive on the diverse dev set.
- Dev confusion FP(6)=accenture/flowbite/nasa/neon/onepassword/resend (borderline marketing-ish judged concrete; nasa = science-superlative NOT special-cased = no corpus-fitting). FN(6)=asana/raycast/scale/solana/supabase/trigger (sparse-fluff + the scale CSS-hidden-copy artifact, faithful to the shipping render).
- Scope tested both (densNoTesti vs full-DOM); densNoTesti dominates the curve (full-DOM dilutes genuine positives e.g. twilio 2.20->0.81). Chose the dominating scope = principled.

## GATE PLAN (this is the LAST clean frozen-90 shot for marketing-buzzword - v1 spent the first)
1. Lead build GREEN (done) + independent calibration reproduced (done).
2. npm test full suite (running).
3. Codex cross-model review of the v2 detector diff (run codex via CLI per the no-relay lesson; the guard hook is now live).
4. Fold any findings + re-verify.
5. ONE frozen-90 measure (--force collect + mapping regen + score). Objective must stay 0.936. Report honestly whatever it shows.

## HONEST EXPECTATION
dev R0.81/P0.81 is a DEV number on a now-REPRESENTATIVE set (the v1 failure was a homogeneous-corpus overfit; v2's diverse set matches the frozen distribution, so the drop should be far smaller). Whatever the frozen-90 shows, we report it - no re-iteration after (would contaminate the held-out).

## Files touched
- (verification beat; v2 in subjective-rendered-scanner.ts + tests + eval/buzzword-calibrate.mjs + 27 dev pages, uncommitted)
</content>
