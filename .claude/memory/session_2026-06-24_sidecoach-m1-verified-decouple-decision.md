---
name: sidecoach-m1-verified-decouple-decision
description: M1 restore VERIFIED (0.894 + undercount confirmed by me); ruling = DECOUPLE objective from subjective-ReDoS, NOT the Stage-2 deletion (stays Jonah-checkpointed)
type: decision
relates_to: [session_2026-06-24_sidecoach-batch2-regression-ruling.md, session_2026-06-24_sidecoach-decoupling-gate.md]
---

Collaborator: Jonah Cohen.

## M1 restore VERIFIED by me
Committed: 44fe4177 (reverts), dd5f5ae0 (corpus freeze, 22 dev HTML now tracked - my ruling applied), 82c2a81a (recall restored), cbcaf215 (timeout root-cause beat). Committed scorecard: sidecoach objective {tp:84, present:94, recall:0.894, precision:0.894} - restored from the 0.787/0.552 regression. (NOTE: scorecard.json's oracle=0.064 is STATIC mode; the real comparison is oracle-BROWSER 0.831. Architect's apples-to-apples = 0.948 vs 0.831 n=77.)

## The UNDERCOUNT - independently CONFIRMED
Architect claimed 0.894 undercounts because 2 GT-defect pages time out in the collect (120s) - the subjective ReDoS scanner (scanIdenticalCardGrids) starves the objective scan in the shared subprocess - so 5 GT class-instances score as FN purely from the harness. I ran the objective scanner (analyzeHtmlOnBrowser) STANDALONE on both:
- db_worldbank_data: 865ms, detected low-contrast + skipped-heading = 2/2 GT.
- mk_kubernetes_live: 354ms, detected low-contrast + skipped-heading (contrast-family bucket covers GT gray-on-color) = GT defects covered.
CONFIRMED: both detect their GT defects in <1s standalone. The collect-time misses are a PURE harness contention artifact, not detector gaps. True objective recall is NEAR-CEILING (~0.947); the "30/32 heading, 38/40 contrast" gaps are these 2 ReDoS pages timing out.

## Item rulings
- #3 filter neutrality (my condition 2): SATISFIED - neutral on every real finding; the only page it moves (mk_eleventy) is an sr-only FP, not a real detection. Filter revert STANDS.
- sr-only FP (pre-existing in batch-1): the scanner flags 1px-clip sr-only text as low-contrast (visuallyVisible size check `width<1||height<1` misses 1px; clip regex misses the rect(1px,1px,1px,1px) collapse). axe EXCLUDES sr-only from contrast -> these are FPs (mk_eleventy/mk_godaddy). APPROVE the `<1`->`<=1` + clip-variant fix as STANDARD-correctness, GATED on: verify no GT-positive page loses its SOLE real lc detection + a calibration fixture (sr-only 1px-clip NOT flagged).

## DECISION: DECOUPLE, do NOT delete (the Stage-2 checkpoint stays intact)
The architect offered (a) decouple objective from subjective-ReDoS in the collect, OR do the scanIdenticalCardGrids ReDoS DELETION now (the Stage-2 target). RULING: do the DECOUPLE only.

**Alternatives considered:**
- Delete scanIdenticalCardGrids now to fix the contention: rejected. (1) It's the Stage-2 FIRST DESTRUCTIVE DELETION, which is HARD-CHECKPOINTED to Jonah (standing constraint) - fixing a measurement artifact must NOT be the vehicle to smuggle that past its checkpoint. (2) It also removes the OLD icon-tile-stack subjective detection (identical-card-grids->icon-tile-stack), which must be replaced by the NEW ST1 icon-tile-stack detector FIRST or we open a coverage gap.
- Leave it (live with the undercount): rejected. The number is contention-dependent + irreproducible across machines; a clean measurement needs isolation.

**Why decouple:** isolating the objective scan's subprocess/timeout from the subjective ReDoS is a HARNESS change that deletes nothing, is eval-safe (not detector logic), recovers the 2 timeout pages, and yields a clean ~0.947. The scanIdenticalCardGrids deletion remains a deliberate Stage-2 decision (after ST1 builds the icon-tile-stack replacement) that goes to Jonah.

**Revisit when:** ST1 has shipped+validated the icon-tile-stack detector -> then the scanIdenticalCardGrids deletion (Stage-2) goes to Jonah as the net-simpler half of the committed Stage-1+2 pair.

## CHECKPOINT CLEARED - Jonah authorized the Stage-2 deletion (2026-06-24)
Jonah gave explicit blessing for the Stage-2 first destructive deletion (scanIdenticalCardGrids ReDoS + the 2 noise rules). The HARD CHECKPOINT (his personal sign-off) is now SATISFIED - I no longer need to bring the deletion back to him. BUT the ENGINEERING sequencing constraint still holds (it was my reason (b), independent of his sign-off): delete scanIdenticalCardGrids only AFTER the ST1 icon-tile-stack detector is built + validated, so no subjective-coverage gap opens. There is no urgency to delete NOW because the decouple already protects the objective measurement from the ReDoS; the deletion's value is now purely simplification (the net-simpler half) + removing the pathology. Execute it as the Stage-2 simplification immediately after ST1 ships icon-tile-stack, bundled with the 2 noise-rule deletions. Re-measure after to prove no regression.

## Sequencing (the architect's gut-check)
(1) DECOUPLE harness fix + fixture. (2) sr-only `<=1`+clip fix + fixture + the sole-detection guard. Each gets a synthetic fixture (per-fix proof), then ONE re-measure -> expect near-ceiling. Hold "parity / capability-gain, S5b-gated, NOT beat" even at ~0.947 vs 0.831 (S5b undone; the gap is partly oracle's render-state divergence).

## Decouple IMPLEMENTED (architect, pending my re-verify on commit)
sidecoach-scan.mjs gained objective|subjective|both modes; collect runs them as SEPARATE subprocesses. KEY integrity property the architect got right: the subjective scan KEEPS its 120s symmetric timeout, so a ReDoS timeout STILL shows as a subjective deficit - the pathology is NOT swept under the rug; only the OBJECTIVE scan is isolated (own backstop, immune to the ReDoS). That's the correct decouple: stop the ReDoS corrupting the objective measurement WITHOUT hiding that the ReDoS exists. Cache v3 + sidecoachObjectiveAvailable gate. decouple-isolation.test.ts GREEN; 4 ex-timeout pages scan <1.6s; 2 defect pages recover. sr-only fix: <1->-<=1 + zero-area clip parse, calibration 34/34, SOLE-DETECTION GUARD PASSES (0 GT-lc pages lose detection), FP removal confirmed (mk_eleventy/godaddy clean).

OPEN ITEM (not blocking, not a regression): 6 GT-gray-on-color instances are missed by BOTH old and new builds = a PRE-EXISTING gray-on-color detector gap (the sr-only fix did not cause them). To characterize later: genuine detector gap to fix as general spec-correctness, or referee-label issue? Relates to the contrast-fam 38/40 / the gray-on-color weakness. Revisit after the v3 re-measure + on the taste frontier pass.

## v3 re-measure RESULT (on disk, pre-commit) - coherent
Post-decouple+sr-only scorecard: objective {tp:88, present:94, detected:96, recall:0.936, precision:0.917} (was 84/94=0.894/0.894). COHERENT with the whole diagnosis: decouple recovered the 2 timeout pages' contrast+heading (+4 tp); sr-only removed FPs; net detected +2; the residual 6 misses = the pre-existing gray-on-color gap (kubernetes gray-on-color is one of them, so it didn't recover - consistent). Near-ceiling 0.936, NOT the +5->0.947 because the 5th instance is a gray-gap, not a timeout. Pending: architect to COMMIT (a)+(b)+fixtures+scorecard + surface; then my formal independent re-run (which should now be REPRODUCIBLE since the decouple makes the objective scan contention-immune - reproducibility itself validates the decouple). Also pending: explain the uncommitted `D dev-labels.json` deletion.

## Codex review: 2h hang -> bounded-exec fix -> caught a real HIGH integrity bug
The architect's first `codex exec` review WEDGED for 2h (PID 45640: 1h55m elapsed, 0.03s CPU, sleeping). I caught it via elapsed-vs-CPU. LESSON (reusable): a review/collect subprocess alive for hours with ~0 CPU is hung by definition; check elapsed-vs-CPU, don't wait indefinitely. FIX the architect found (correct): the problem was an UNBOUNDED exec, so BOUND it - relaunch `codex exec` foreground with a hard 240s timeout. Returned clean in <4min; the hang was one wedged backend session, not an infra outage. (Note: codex:codex-rescue is NOT available to the architect - teammates can't spawn nested agents; my suggestion to use it was off. The timeout-bound on raw exec is the right tool for it.)

The review CAUGHT A REAL HIGH FAIL-CLOSED BUG - validating the cross-model gate: sidecoach-scan objective mode previously returned silent [] + exit 0 on an UNAVAILABLE render = a false "clean" (an unavailable page would score as scanned-found-nothing, corrupting the measurement). Fixed to exit nonzero -> fail-closed (unavailable -> excluded-with-flag, never read as clean). PURE HARDENING on the current corpus (all v3 pages had objAvail=true so the unavailable path never triggers -> 0.936 unchanged); it matters for edge/future pages. Plus MEDIUM (A2/A4/volume use produced()=available||objectiveAvailable so a subjective-timeout page's objective findings aren't dropped from secondary metrics) + 3 LOW. Re-verified build clean, calibration 34/34, decouple-isolation GREEN. Architect running a FAITHFUL re-collect (folds touched scanner) so the committed scorecard matches shipped code - harness-tracked (notifies, not a silent hang); expect 0.936 to hold. My independent re-run pending its commit.

Files verified: committed scorecard.json, git log; standalone objective scan of db_worldbank_data + mk_kubernetes_live (temp script, removed); v3 scorecard.json on disk (0.936, pre-commit).
