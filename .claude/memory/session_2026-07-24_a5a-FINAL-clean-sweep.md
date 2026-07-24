---
name: A5a FINAL - default-typeface clean sweep (R=1.000 P=1.000, 0 FP) vs oracle 83.3% FP
description: Final A5a head-to-head on the corrected applied-vs-defined ground truth. OURS TP5 FP0 FN0 TN18 - zero disagreements with independent Codex labels across all 23 pages. ORACLE generous R=0.200 P=0.063 with 15/18 false fires; strict R=0.000. Pre-registered prediction (p04 flips, gate clears) held. Lead ship call recorded with explicit limits.
type: decision
relates_to: [session_2026-07-24_a5a-declared-stack-result-and-extractor-fixes.md, session_2026-07-24_stage4a-a5a-RESULT-construct-mismatch.md]
author_human: Jonah
author_model: claude-opus-4.8
superseded_by: session_2026-07-24_a5a-SHIP-CALL-WITHDRAWN-filename-leak.md
source: session
verified: tests - real A5a run, 23/23 Codex-labeled pages, oracle pinned. npm test + corpus verify + independent Codex review of the ground-truth diff LAUNCHED, results pending at write time.
confidence: high
---

Collaborator: Jonah. 2026-07-24. Final A5a numbers for `default-typeface` on the corrected ground truth.

## FINAL NUMBERS (graded vs the SAME independent Codex labels, 23 pages)
```
OURS (shipping)      R=1.000 (5/5)  P=1.000  FP=0/18 (0.0%)    [TP5 FP0 FN0 TN18]
ORACLE generous-map  R=0.200 (1/5)  P=0.063  FP=15/18 (83.3%)  [TP1 FP15 FN4 TN3]
ORACLE strict-map    R=0.000 (0/5)  P=n/a    FP=0/18 (0.0%)    [TP0 FP0 FN5 TN18]
```
ZERO disagreements with independent ground truth across all 23 pages - not one `*` in the per-page table. The grader reports "MEASURED (not a pass/fail verdict - the lead makes the ship call)", correctly deferring.

## The pre-registered prediction held (this is the anti-tuning evidence)
Before this run I stated on the record: "p04 should flip to present and the gate should clear - and if it doesn't, that's a real detector FP and I'll say so." p04 flipped to codex=P and the gate cleared. A falsifiable prediction made BEFORE the run, that could have failed and would have been reported as a detector defect, is the defense against tuning-to-green. Additionally: **the DETECTOR was never touched across the entire A5a effort.** All three changes corrected demonstrable defects in the ground-truth SIGNAL (screenshot->declared basis; @font-face definition vs application; leaked author-intent comment). Three label bases are preserved side by side (`.screenshot-basis.json`, `.flat-declarations.json`, current) so the progression is auditable by anyone.

## LEAD SHIP CALL: default-typeface CLEARS A5a as a DETERMINISTIC DIFFERENTIATOR
Justified under the README's own two-path bar: a class with a crisp pass/fail detector test that the comparator has zero real coverage of clears by demonstrable PASS/FAIL, not by bootstrap significance. The oracle's strict map detects NOTHING (R=0.000, it ships no such rule); its generous map only reaches R=0.200 by false-firing on 15 of 18 negatives (P=0.063). The gap is not close and does not depend on a threshold choice.

## LIMITS THAT RIDE WITH THE CLAIM (stated, not buried)
1. **Recall is proven on CONSTRUCTED positives only (n=5).** Heldout-recall remains STRUCTURALLY UNGRADEABLE: real shipped designs choose typefaces, so the real corpus contains ~zero positives. "R=1.000" means "catches every constructed positive", NOT "proven real-world recall".
2. **Small N** (5 positives / 18 negatives). The claim rests on the deterministic-differentiator PASS/FAIL path; a paired-bootstrap significance claim is NOT supported at this N and is not being made.
3. **Precision IS strong on real data**: 0 FP across 12 REAL shipped pages, plus 6 adversarial branded fixtures (system caption amid a chosen serif, system code/table blocks at 12.3% share, system chrome with branded content) all correctly cleared. The negatives are genuine traps, and the oracle fails them 15/18 - so the sweep is not an artifact of an easy test.
4. **The class's own honest exclusion still stands**: Inter/Poppins monoculture is NOT detected (they are recommended faces; 13/48 dev pages lead Inter legitimately). Unchanged by this gate.

## STILL OWED before 4a is fully shipped (updated as they land)
- ~~`npm test` full gate~~ **DONE - GREEN: `run-tests: 75 suite(s) passed`** (up from the 73 baseline; the spawned verify-candidates task added 2 suites). `VERIFY-CANDIDATES OK` both inside the suite and standalone: "provenance complete, subjective author!=labeler (codex), bijection + canonical-record freeze intact". NOTE for future readers: the suite output contains a `VERIFY-CANDIDATES FAIL: kg1: LOCKED RECORD TAMPERED` line - that is a deliberate NEGATIVE CONTROL fixture inside corpus-tool.test proving the gate catches tampering, immediately followed by `corpus-tool.test: ALL PASS`. It is not a real failure. (A first attempt at this gate FAILED on a cwd error - it ran from the repo root with no package.json - and was NOT counted as a pass.)
- Independent Codex review of the GROUND-TRUTH diff (subjective-label-harness.mjs, dev-subjective-label.mjs, subjective-rubric.md). This machinery is integrity-critical - a defect there silently corrupts the gate - so it is being reviewed specifically for: leaked author-intent signals, any encoded DETECTOR logic that would make ground truth a copy of what it grades, and whether the brace-matching mis-parses nested at-rules (@media/@supports).
- Nothing committed.

## Files touched
- this beat + MEMORY.md index. No code changed by this run.
