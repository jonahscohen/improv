---
name: A5a ground-truth integrity fixes (labeler answer-leak + extractor correctness)
description: Closed six Codex-review findings in the A5a default-typeface LABELER (eval/ only, detector untouched), hardened the labeler's whole channel, re-labeled all 23 pages and re-ran the head-to-head
type: project
relates_to: [session_2026-07-24_a5a-default-typeface.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + live codex probes + full re-label
confidence: high
---

# A5a ground-truth integrity fixes

Surface was `eval/` ONLY. `src/validators/subjective-rendered-scanner.ts` and `src/product-rule-registry.ts`
were NOT touched (verified by mtime: both last modified 2026-07-23 23:20/23:41, this session began 04:47).
Bending the detector to the ground truth would invert the point of the gate.

## The six findings and what was done

1. **P0 answer-in-the-filename.** `dev-${id}.png` put the polarity prefix and a plain-English scenario into
   `codex exec -i`. Now `shot-<sha256(id)[0:12]>.png`, with `assertNoLeak()` refusing any attachment name that
   carries the id, an id token, or a `p0../n0..` prefix, plus `assertPromptClean()` on the prompt body.
   Why the whole channel mattered: a LIVE probe (ask Codex to report its own environment) showed
   `--sandbox read-only` in codex-cli 0.142.5 restricts WRITES only - from an isolated cwd it still ran
   `ls <repo>/eval/fixtures/default-typeface/` and read `typeface-a5a-labels.json`, i.e. the answer key.
   Fixed by wrapping the invocation in a seatbelt profile denying file-read on the repo subtree; re-probed
   LIST_DENIED / READ_DENIED (nested `sandbox_apply` fails, so the labeler has no shell at all). Third layer:
   `auditTranscript()` fails a page if the labeler's own transcript reaches for the corpus.
2. **P1 selectors leaked author intent.** Node-side `sanitizeSelector()` redacts classes/ids/data-attrs/custom
   elements/custom-property names to `.cls / #id / [attr] / elem / --custom-N`, preserving element tags,
   ARIA/role, spec-enumerated attributes, combinators and structural pseudos.
3. **P1 nested at-rules mis-parsed.** The regex brace-matcher turned `@media (...) { body { ... } }` into
   `@media (...) { font-family }` and LOST `body`. Replaced with a real CSSOM walk in the already-running
   Playwright page: nested conditions and the true inner selector both survive, arbitrarily deep.
4. **P1 "APPLIED" was unverified.** Every rule is now match-tested against the live DOM and bucketed:
   APPLIED (reaches visible text) / DECLARED BUT NOT APPLIED (0 elements) / MATCHED BUT TEXTLESS /
   TEXT HIDDEN / MATCH UNVERIFIED. An unused `.brand-copy { font-family: Custom }` no longer reads as a
   typeface choice.
5. **P2 inline-style regex.** Deleted, not patched: inline styles now come from `el.style.fontFamily`, so the
   browser handles single quotes and strips comments.
6. **P2 stale provenance.** `method` is `screenshot-vision+text+motion+typeface-cssom`; the banner counts are
   DERIVED from the signal sets (`18 screenshot / 2 text / 2 motion / 1 typeface`), not hardcoded.

## Codex adversarial review of the diff - all findings folded
Critical: removed the `SIDECOACH_LABEL_UNSANDBOXED` escape entirely (an env var that permits contaminated GT
is a supported path to a bad ship call); added `validateVerdict()` so a verdict missing/inventing classes or
returning a non-boolean `present` is refused; both runners now `exit 5` on any unlabeled page so a partial
label set can never read as success; `recordLabels` records containment.
High: aria/structural attribute VALUES redacted except spec-enumerated ones (`aria-label="expected present"`
was a live hole); unknown functional pseudo args fail closed (`::part(brand-slot)`); CSS-nesting parent
declarations no longer dropped when a rule has both declarations and child rules; `@import` walked;
selector-list splitting is now top-level-comma-aware; APPLIED wording no longer implies a cascade win and
inactive `@media` is marked NOT active.
Rejected with reasoning: Codex asked for font-family VALUES to be bucketed into `chosen-family` /
`system-family`. That would copy the detector's own classification into the ground truth and is exactly the
banned move. Families stay verbatim; `assertNoFamilyLeak()` instead refuses a family string that STATES the
verdict, with a deliberately narrow word list (verified zero hits across all 23 pages).

## Real defect the new guard caught
`martinfowler` has three blocked `@import url(fonts.googleapis.com/...)`. Rather than refuse the page (over-
conservative: those sheets carry `@font-face` only) or footnote it (dishonest), unreadable sheets are surfaced
as a first-class prompt section WITH their source URL. Refusal is reserved for an unreadable sheet with no
identifiable source, or an unreadable sheet on a page with no readable font-family rule at all - the only case
where the labeler would be shown a misleadingly empty picture.

## The key result: the leak did not move a single label
Re-labeled all 23 pages from a FRESH sink (so a failed page can never leave a stale leaked label behind).
default-typeface flips vs the leaked-filename basis: **0 / 23**. Same 5 positive / 18 negative split.
The withdrawn ship call was correct on process and the ground truth was, in fact, sound.

A5a head-to-head (unchanged numbers, now on contained labels):
OURS R=1.000 (5/5), P=1.000, FP=0/18. ORACLE generous-map R=0.200, 15 FP (83.3%). ORACLE strict-map R=0.000.

Gates: `npm test` 75/75 suites, `corpus-tool verify-candidates` OK, `typeface-a5a.mjs` exit 0.

## Beat-file discrepancy found at startup
The task named `session_2026-07-24_a5a-SHIP-CALL-WITHDRAWN-filename-leak.md` and
`session_2026-07-24_a5a-declared-stack-result-and-extractor-fixes.md`. NEITHER EXISTS. Only
`session_2026-07-24_a5a-default-typeface.md` is on disk for A5a. The label bases on disk
(`.screenshot-basis`, `.flat-declarations`) confirm that work happened; its beats were never written.

## Self-analysis
I initially accepted "isolated cwd" as sufficient containment because the flag is literally named
`--sandbox read-only`. I only found the hole because I ran a live probe asking the labeler what it could see
instead of reasoning about what the flag ought to mean. The failure mode: trusting a tool's naming over its
observed behavior on the exact axis that mattered. I also wobbled on whether to keep an unsandboxed escape
hatch; Codex was right that for ground truth there is no such thing as a supported contaminated path.

## Files touched
- eval/subjective-label-harness.mjs
- eval/dev-subjective-label.mjs
- eval/corpus/typeface-a5a-labels.json (re-labeled, 23 pages)
- eval/corpus/typeface-a5a-labels.leaked-filename-basis.json (new backup of the pre-fix basis)
- eval/corpus/typeface-a5a-labels.cssom-v1-basis.json (new backup of the pre-Codex-review basis)
