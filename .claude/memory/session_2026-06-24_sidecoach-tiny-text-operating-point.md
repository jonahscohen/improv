---
name: sidecoach-tiny-text-operating-point
description: tiny-text v2 gate - resolve the operating point via SYNTHETIC fixture + principle, FREEZE before the milestone (milestone is not a tuning loop); planetscale capture degraded
type: decision
relates_to: [session_2026-06-24_sidecoach-tiny-text-labeler-adjudication.md, session_2026-06-24_sidecoach-taste-prioritization.md]
superseded_by: session_2026-06-24_sidecoach-tiny-text-pivot-and-self-correction.md
---

NOTE: the operating-point ruling below (SMALL_PX=13 via a readable-14px-absent fixture) was SUPERSEDED - verified data showed tiny-text labels don't track font-size at all (clerk 86%<=13px AND trigger 18px-dominant both labeled present), so SMALL_PX=13 collapsed recall to 3/21. See the superseding beat for the self-correction + the pivot-to-layout-transition decision.

Collaborator: Jonah Cohen.

tiny-text v2 surfaced for gate (commit 2ee22609). Architect SELF-CORRECTED cleanly: accepted the labeler is sound (read my pulled notes), accepted min-font-size v1 was the defect, rebuilt as DENSITY/REGION: flag iff proportion of CONTENT-region text (by char) at/<=14px >= 0.15; content excludes peripheral footer/nav/aside + ARIA navigation/contentinfo/complementary (not header); guards min 200 chars, sr-only/transparent/whitespace excluded. Calibration 7/7. Dev recall 17/21 (0.81). Codex review GOT THROUGH this time (bounded + lean-prompt retry after the 2nd wedge); folded High#2 (ARIA roles) + Medium. Codex got the cross-model pass; the SIGKILL handling worked.

## planetscale: degraded capture - VERIFIED + exclusion accepted
Architect flagged 1/22 dev captures broken (planetscale = ~16px monospace wall, CSS failed to inline). I verified: planetscale 160KB / 2 style-blocks / 6 font-family vs linear 923KB / 4 / 27 = CSS largely didn't inline. Claim holds (architect right this time, flagged honestly). Excluded from tiny-text recall (17/21). FLAG: planetscale's labels for ALL 22 classes are on the broken render = suspect; DROP planetscale from the dev corpus entirely (or re-capture disjoint + re-label), not just tiny-text. Cleanup item.

## THE OPEN: operating point (Codex High#1: <=14px+15% may over-fire on readable 14px-heavy pages). Ruling.
Architect offered (A) ship as-is + milestone-measure precision [its rec], or (B) tighten (SMALL_PX=13 or PROPORTION=0.20, ~12/21 recall). RULING: NEITHER blind, and CORRECT the framing.

THE TRAP: the architect called "the milestone's 24 negatives the real precision test." The milestone must NOT choose the operating point - shipping A, measuring, then tightening on what the 24 negatives show is TUNING TO THE HELD-OUT = train-on-test. The milestone is a ONE-SHOT honest final measurement with a FROZEN operating point, never a tuning loop.

THE RESOLUTION (precision answerable WITHOUT the milestone): the dev corpus has 0 tiny-text negatives (22/22 present), so precision isn't measurable on dev as-is - but the Codex concern is a CONCRETE case that a SYNTHETIC fixture encodes. Add a NEGATIVE fixture = a READABLE 14px-heavy content page (dashboard/cards/tables, comfortable, generous spacing) + keep dense 11-13px POSITIVES. PRINCIPLE: "strains readability" means readable-by-definition pages are ABSENT; 14px is a common readable body size (GitHub etc.), so a readable-14px page must NOT fire. Set SMALL_PX/PROPORTION so the readable-14px negative is ABSENT while dense positives stay PRESENT - that almost certainly means SMALL_PX=13 (exclude readable 14px). Threshold justified by the readability STANDARD + the fixture, not by milestone feedback. Accept the recall hit (condition 3: precision co-equal; a readable page firing is worse than missing a borderline-14px positive).

THEN: freeze the operating point, wire into eval, milestone-measure ONCE as the honest final test.

**Alternatives considered:**
- A (ship loose, let the milestone reveal precision, tighten if bad): REJECTED - that's tuning to the held-out.
- B (tighten by gut to 13/0.20 now): partially right direction but unprincipled as a blind pick - the synthetic fixture is what justifies the threshold, not a number I choose.

**Why:** precision must be resolved by principle + synthetic evidence BEFORE the one-shot milestone, identical to the objective axis (standard-justified, agreement-as-consequence). The held-out is measured, never tuned against.

**Revisit when:** the readable-14px fixture forces a threshold that tanks dev recall below ~half - then reconsider whether px+proportion is enough signal or whether density needs a leading/contrast co-signal.
