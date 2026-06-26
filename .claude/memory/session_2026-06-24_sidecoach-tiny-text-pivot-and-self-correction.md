---
name: sidecoach-tiny-text-pivot-and-self-correction
description: tiny-text labels don't track font-size (verified) - lead self-correction (over-applied objective-axis frame to a taste class); PIVOT to layout-transition, defer tiny-text
type: decision
relates_to: [session_2026-06-24_sidecoach-tiny-text-operating-point.md, session_2026-06-24_sidecoach-tiny-text-labeler-adjudication.md]
supersedes: session_2026-06-24_sidecoach-tiny-text-operating-point.md
---

Collaborator: Jonah Cohen.

The architect executed my SMALL_PX=13 directive exactly -> dev recall COLLAPSED 17/21 -> 3/21, and surfaced it (reporting not iterating). I VERIFIED the linchpin data myself (char-weighted font distribution, my own measurement) before ruling:
- resend (labeled tiny-text PRESENT): 74% at 14px, only 11% <=13px, comfortable line-height. Fires only if 14px counts.
- clerk (PRESENT): 86% <=13px. Genuinely tiny.
- trigger (PRESENT): 18px-DOMINANT, only 24% <=14px. Labeled present but NOT small-text-heavy.

## Finding: tiny-text labels do NOT track font-size
The labeler marked tiny-text present across 13px-dense (clerk) -> 14px-comfortable (resend) -> 18px-dominant (trigger). No font-size proportion threshold separates these from the absent set. The labels are a HOLISTIC screenshot judgment ("feels like it has small text") only loosely correlated with measured font size. So a lightweight font-size detector has a LOW CEILING against these labels - precision-safe gives ~3/21 (clerk-like only), label-matching is impossible by size alone.

## SELF-CORRECTION (mine) - per the failure protocol
I ruled on tiny-text TWICE from principle without grounding in feature-vs-label data:
1. Labeler-adjudication: refuted "liberal labeler" from the NOTES (correct that it discriminates, but I over-concluded its threshold tracks "strains readability" - it doesn't track font size at all).
2. Operating-point: imposed a READABILITY STANDARD (readable-14px=absent -> SMALL_PX=13) by importing the OBJECTIVE-axis "external spec, agreement-as-consequence" frame.
WHY IT WENT WRONG: I pattern-matched to the objective-axis success (WCAG external anchor) and applied it to a TASTE class that has NO external spec and noisy perceptual labels. I was confident in the principle and didn't demand the data first.
FIX/LESSON: TASTE classes have no external spec - the labeler's frozen perception is the only GT, and it may NOT reduce to a clean mechanical feature. Before ruling a taste class's definition/operating-point, pull the FEATURE-vs-LABEL data and confirm the proposed feature actually tracks the labels. Do not import the objective-axis external-standard frame to taste without that check. (Healthy: the architect following my directive exactly surfaced the LEAD's error - produce-and-verify caught me.)

## Decision: PIVOT to layout-transition; DEFER tiny-text
- PIVOT to layout-transition now (architect's option iii). 20% weight AND high-separability: animation/transition CSS declarations are a clean, reliable signal (the motion new-signal already scoped). Get a real win, validate the pipeline end-to-end.
- DEFER tiny-text. It's a low-separability / holistic-label class; more font-size cycles won't raise the ceiling. When we return, two options: (a) RE-LABEL tiny-text with a tightened, operationalized rubric so the GT is consistent + font-size-trackable [touches the frozen GT -> loop Jonah], or (b) ship a precision-safe low-recall detector (genuinely-tiny pages only, clerk-like) and accept tiny-text contributes little to the score. Decide later, after the clean classes.
- Do NOT freeze/milestone tiny-text now. Shelve the SMALL_PX=13 change.

**Alternatives considered:** force a definition now (labeler-match needs 14px but trigger@18px breaks even that; readability-strict gives 3/21) - REJECTED, neither matches the labels and we'd burn cycles on an unreachable ceiling.

**Revisit when:** the clean classes (layout-transition, marketing-buzzword, nested-cards, etc.) are done and we can see oracle's PER-CLASS subjective numbers - that tells us how much of tiny-text's 35% oracle itself reaches (if oracle also can't match the noisy tiny-text labels, the real competition is elsewhere and tiny-text's nominal 35% is partly unreachable for both).

## Strategic flag (for the next Jonah status)
The biggest taste class (tiny-text, 35%) is partly UNREACHABLE by lightweight detection because its labels are holistic/noisy. The realistic "beat oracle" ceiling needs recalibration once we see oracle's per-class subjective performance. Possible frozen-GT re-label decision coming -> Jonah.

Verified via: my own char-weighted font-distribution measurement on resend/clerk/trigger (dev pages).
