---
name: A5a CERTIFIED - ground truth hardened, ZERO label flips, ship call re-issued
description: All 6 review findings fixed plus a worse one found (codex --sandbox read-only blocks WRITES only, so the labeler could read the fixtures AND the labels sink - the answer key). Three containment layers added. Re-label produced ZERO label flips 23/23, so the numbers held: OURS R=1.000 P=1.000 FP=0/18 vs oracle generous P=0.063 with 83.3% FP. Lead ship call RE-ISSUED with limits.
type: decision
supersedes: session_2026-07-24_a5a-SHIP-CALL-WITHDRAWN-filename-leak.md
relates_to: [session_2026-07-24_a5a-FINAL-clean-sweep.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - npm test 75 suites green, corpus verify-candidates OK, 65/65 extractor assertions, Codex adversarial review (4 Critical + 6 High folded), detector untouched (mtime-verified), A5a re-run with hardened containment
confidence: high
---

Collaborator: Jonah. 2026-07-24. The withdrawn ship call is RE-ISSUED. The ground truth is now defensibly independent, and - the decisive fact - hardening it changed NOTHING.

## A WORSE leak than the filename (found by auditing the whole channel)
The teammate probed the labeler's actual environment and proved `codex exec --sandbox read-only` in codex-cli 0.142.5 restricts **writes only**. The labeler could READ:
- the fixtures directory, and
- `eval/corpus/typeface-a5a-labels.json` - **the answer key itself**.
Live probe before: "Can you read .../typeface-a5a-labels.json? YES." After a seatbelt profile denying file-read on the repo subtree: "NO ... sandbox_apply: Operation not permitted", and nested `sandbox_apply` fails so the labeler has no shell at all. This was far more serious than the filename I withdrew over, and it was only found because the withdrawal forced a full-channel audit instead of a filename patch.

**Three containment layers now**: opaque `shot-<sha256(id)[0:12]>.png` attachments (+ `assertNoLeak`/`assertPromptClean` fail-loud guards), seatbelt deny-read on the repo, and `auditTranscript()` which fails a page whose transcript reaches for the corpus.

## THE DECISIVE RESULT: zero label flips
**23 of 23 labels held**, against BOTH the leaked-filename basis and the intermediate CSSOM-v1 basis. Same 5 positive / 18 negative split. Labels were regenerated from a FRESH sink so a failed page could not leave a stale leaked label behind. Every label `labeledBy: codex` with `containment: isolated-cwd+seatbelt-deny-repo-read+transcript-audit`.
So: **the withdrawal was correct on process, and the ground truth it was withdrawn over turned out to be sound.** Both halves of that sentence matter. Withdrawing was still right - independence you cannot demonstrate is not independence - but the measurement itself was never actually contaminated.

## FINAL NUMBERS (unchanged across the hardening)
```
OURS (shipping)      R=1.000 (5/5)  P=1.000  FP=0/18 (0.0%)    [TP5 FP0 FN0 TN18]
ORACLE generous-map  R=0.200 (1/5)  P=0.063  FP=15/18 (83.3%)  [TP1 FP15 FN4 TN3]
ORACLE strict-map    R=0.000 (0/5)  P=n/a    FP=0/18 (0.0%)    [TP0 FP0 FN5 TN18]
```
Oracle generous fires `overused-font` on 11 of 12 REAL pages. Five label bases preserved for audit: screenshot-basis, flat-declarations, leaked-filename-basis, cssom-v1-basis, current.

## Other fixes folded
Regex extraction replaced by a **CSSOM walk** in the live Playwright page: nested `@media`/`@supports` now keep their real inner selector (`body` was being dropped), rules that match NO element are reported as "DECLARED BUT NOT APPLIED ... puts this font on NOTHING" instead of being asserted as applied, author-chosen names (`.brand-copy-never-used`, `[data-expected=present]`) are sanitized while `body`/`h1`/`code`/`[role="navigation"]`/`:nth-child(2n+1)` survive, inline styles handle single quotes, provenance strings derived not hardcoded. 65/65 assertions pass. Codex adversarial review: 4 Critical + 6 High folded (removed an unsandboxed escape hatch entirely, added `validateVerdict`, exit 5 on any unlabeled page, `@import` walked, fail-closed unknown pseudo-args).

**One Codex finding correctly REJECTED**: bucketing font-family values into `chosen-family`/`system-family`. That is the DETECTOR's own classification; adopting it would make the ground truth a copy of the rule it grades. Families stay verbatim. This is the right instinct and worth preserving as precedent.

## LEAD SHIP CALL (re-issued): default-typeface CLEARS A5a as a DETERMINISTIC DIFFERENTIATOR
Under the README's two-path bar: a crisp pass/fail detector test on a class the comparator has zero real coverage of. Oracle strict detects NOTHING; oracle generous only reaches R=0.200 by false-firing on 15 of 18 negatives.

## LIMITS RIDING WITH THE CLAIM (unchanged, stated not buried)
1. Recall proven on **CONSTRUCTED positives only (n=5)**; heldout-recall STRUCTURALLY UNGRADEABLE (real designs choose fonts).
2. Small N - the claim rests on the pass/fail path; **no statistical-significance claim is made**.
3. Precision is the strong half and it is on REAL data: 0 FP across 12 real shipped pages + 6 adversarial branded fixtures the oracle fails 15/18.
4. `Inter`/`Poppins` monoculture still NOT detected - the class's own honest exclusion, unchanged.
5. Containment is **darwin-only** (`sandbox-exec`); running this labeler on Linux requires porting the deny-read layer first. The runner hard-refuses rather than silently degrading.
6. Residual accepted: family names reach the labeler verbatim by design; a fixture could encode intent in a family NAME. `assertNoFamilyLeak()` catches obvious phrasings (0 hits across 23 pages) but is not a general defense - the real fix is naming fixture families neutrally.

## Teammate report correction
The teammate reported two of my beat files "do not exist". FALSE - all four `session_2026-07-24_a5a-*.md` beats are on disk at the repo-root `.claude/memory/`; it looked in the wrong directory. Verified by direct `ls`. Recorded because taking a teammate's negative finding at face value would have had me rewrite beats that already existed.

## Gates
`npm test` 75 suites green; `corpus-tool verify-candidates` OK; detector untouched (mtime-verified: subjective-rendered-scanner.ts and product-rule-registry.ts both predate this session's first write; the only in-window `src/` mtime is build-emitted `validators.generated.ts`, byte-identical across a rebuild). Nothing committed.
