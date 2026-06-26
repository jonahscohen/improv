---
name: buzzword-v3-heldout-RESULT
description: v3 fresh-held-out head-to-head - the vacuity precision fix WORKED. v3 R0.947/P0.783/F1 0.857 vs oracle R0.632/P0.857/F1 0.727. We WIN F1 + recall decisively; oracle edges raw precision by a hair (0.074). Precision lifted from v2's frozen 0.333 to 0.783. The one class is now a clear F1 win.
type: project
relates_to: [session_2026-06-25_buzzword-v3-fix-and-heldout.md, session_2026-06-25_buzzword-v2-frozen90-RESULT.md, session_2026-06-25_buzzword-v3-precision-plan.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25). FRESH held-out, disjoint from dev+frozen-90, FP-mode-loaded, Codex-labeled (author!=labeler), measured ONCE.

## RESULT (fresh held-out, 37 labeled: 19 present / 18 negative)
- **OURS (v3): R=0.947 P=0.783 F1=0.857** (TP18 FP5 FN1 TN13)
- **oracle: R=0.632 P=0.857 F1=0.727** (TP12 FP2 FN7 TN16)
- Head-to-head on the SAME set: we WIN recall (0.947 vs 0.632, catch 18/19 vs 12/19) + F1 (0.857 vs 0.727) DECISIVELY; oracle edges raw PRECISION by 0.074 (0.857 vs 0.783).

## THE PRECISION FIX WORKED
The vacuity-tier reweight (PEAK4/STRONG2/MILD0.5 + >=1 STRONG/PEAK guard) lifted precision from v2's frozen 0.333 to v3's 0.783 here. Caveat: the fresh held-out is BALANCED (19P/18N) so absolute precision runs higher than the imbalanced frozen-90 (8P/82N) for BOTH tools (oracle 0.857 here vs 0.4 frozen) - so the VALID comparison is the head-to-head on this set, not cross-set precision. On that head-to-head, v3 is within 0.07 of oracle's precision while winning recall + F1.
- Residual FP(5): cern/nih (science - "groundbreaking" used concretely, the persistent concrete-science mode), huggingface (marketing-ai), bun-docs/vite-docs (docs). FN(1): cloudflare (infra).

## VERDICT ON "IS IT BETTER THAN ORACLE'S?"
By F1 (standard balanced detector metric): YES, decisively (0.857 vs 0.727). By recall: YES, decisively. By raw precision: NO, by a hair (0.074), on a balanced set where both are high. Net: ours is the better detector on the class; oracle retains a slim precision edge on the hardest FP mode (concrete-strong-vocab).

## DISCIPLINE / STATE
This fresh held-out is now SPENT for marketing-buzzword (measured v3 once). Another precision push would need a 3rd fresh held-out + risks the recall win + faces the taste-frontier ceiling (residual FP = strong vocab used concretely = holistic gestalt). frozen-90 still untouched.

## Files touched
- eval/buzzword-heldout-measure.mjs (lead measurement tool); eval/corpus/buzzword-heldout-labels.json (37 codex labels)
</content>
