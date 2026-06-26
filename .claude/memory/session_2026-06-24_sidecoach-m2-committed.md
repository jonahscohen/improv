---
name: sidecoach-m2-committed
description: M2 objective milestone COMMITTED (recall 0.894->0.936, P->0.917); lead independent re-score launched
type: project
relates_to: [session_2026-06-24_sidecoach-m1-verified-decouple-decision.md, session_2026-06-24_sidecoach-batch2-regression-ruling.md]
---

Collaborator: Jonah Cohen.

Architect committed the objective M2 milestone (3 reviewable units, no attribution):
- 1ae7730d (a) decouple + Codex folds
- 78fac887 (b) sr-only fix + folds
- d7b975fd M2 v3 scorecard + beat (HEAD)

PER-CLASS objective (89 pages, faithful re-collect against shipped code):
- broken-image    5/5   R=1.000 P=1.000
- skipped-heading 32/32 R=1.000 P=1.000
- low-contrast    40/40 R=1.000 P=0.889 (5 FP)
- gray-on-color   11/17 R=0.647 P=0.786 (6 FN = the ONLY recall miss = the pre-existing gray gap)
- OVERALL R=0.936 (88/94) P=0.917 (was 0.894/0.894). Apples-to-apples vs oracle-BROWSER (n=77): 1.000 vs 0.831.

DECOUPLE confirmed in the v3 cache: db_worldbank_data + mk_kubernetes_live both objAvail=true (objMs ~1.5s, recovered) while overallAvail=false (subjMs 120s = the subjective ReDoS deficit STILL shows). Designed behavior.

dev-labels.json RESOLVED: it's the dev-corpus OBJECTIVE referee GT (chromium, disjoint-from-90, 20 records, committed in 1249a021). The working-tree deletion was a STRAY pre-existing artifact, NOT the architect's - restored via git checkout, tree clean. Subjective dev labels will write to a SEPARATE file (dev-subjective-labels.json) to avoid clobbering it.

## Lead independent re-score - DONE, EXACT MATCH (verified)
My OWN scoring code + my own analyzeHtmlOnBrowser scan over the 89 un-peeked pages reproduced the architect EXACTLY:
- broken-image 5/5 R=1.000 P=1.000 (det 5)
- skipped-heading 32/32 R=1.000 P=1.000 (det 32)
- low-contrast 40/40 R=1.000 P=0.889 (det 45 = 5 FP)
- gray-on-color 11/17 R=0.647 P=0.786 (det 14)
- OVERALL 88/94 R=0.936 P=0.917 -> MATCH=YES, and errs=0 (all 89 scanned, no timeouts).
THREE things this proves: (1) the number is real, not a scorer artifact (my scorer != the architect's scorecard-score.mjs, identical result); (2) the objective scan is CONTENTION-IMMUNE post-decouple (errs=0 on my machine, no timeout misses); (3) the per-class shape holds, the sole recall gap is gray-on-color (pre-existing). OBJECTIVE AXIS INDEPENDENTLY VERIFIED at near-ceiling 0.936.

OPEN: the 6 gray-on-color misses (pre-existing gap) flagged for the taste-frontier pass. Framing held: parity/capability-gain, NOT beat (S5b deferred). Next: ST0 Codex-label the 22 + coverage map; ST1 held for my map review.
