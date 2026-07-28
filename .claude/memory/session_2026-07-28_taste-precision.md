---
name: Taste detectors tightened to precision, and the one retune the held-out threw out
description: marketing-buzzword retuned by its QUALIFY GATE (>=2 distinct PEAK terms), lifting held-out precision 0.783 -> 1.000 with recall 0.947 -> 0.421. nested-cards retune REJECTED - it gained on the tuning set and lost on the untouched held-out. numbered-section-markers REMOVED (best reachable precision 0.500). default-typeface ground A GATED (real-page precision is undefined, not low). Page-level findings deduped.
type: project
relates_to: [session_2026-07-28_sidecoach-live-efficacy.md, session_2026-06-25_buzzword-v3-precision-plan.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: 176-page render pass through the shipping scorers, held-out scored once at a fixed point, 7 mutations caught, npm test 170 -> 171 suites, Codex review
confidence: high
---

Collaborator: Jonah. His ruling set the trade: tighten to precision and accept lower recall,
because a detector people stop trusting is worse than one that fires less often.

## Verification baseline (Team Rule 9, probed BEFORE anything changed)

`npm test` in `sidecoach/`: **170 suites passed, exit 0**.

A first baseline run reported "15 suite(s) failed" and was WRONG - I had started it in the
background and then edited `src/` while it was still executing, so suites compiled against a
half-applied tree. Re-run against a stashed-clean tree it was green. The lesson is narrow and
worth keeping: a background test run pins the tree for its whole duration, and any edit during
it invalidates the result rather than merely delaying it.

## The populations, because every number below depends on which one it is over

| population | pages | what it is |
|---|---|---|
| TUNE | 138 | dev (48) + candidates (90). Both already spent - dev is what the old thresholds were frozen on, candidates is what the 2026-07-28 evaluation published. |
| HELD-OUT | 37 | `buzzword-heldout`, fully labeled for all 22 taste classes. NOT consulted while choosing any operating point. |

Every sweep ran on TUNE only. HELD-OUT was scored once, after the point was fixed, by importing
the constants from the shipping module so the harness cannot report a point that is not the one
that ships. Honest caveat: this corpus was measured once before, for the v3 buzzword head-to-head,
so it is untouched-by-this-unit rather than pristine. The labels are independent model screenshot
labels - a PROXY for taste. Read every number as "agreement with the labeler".

The old numbers reproduce against the published ones: dev buzzword P 0.839 / R 0.839 exact, dev
nested-cards P 0.900 (9/10) exact, candidates nested-cards P 0.400 (2/5) exact. Candidates
buzzword came out P 0.292 (7/24) against the published 0.304 (7/23) - one extra fire, because
that evaluation scored 89 pages and this one scores all 90.

## 1. marketing-buzzword - retuned, and it generalized

The defect was named precisely in the source: the threshold was frozen on dev and never checked
against held-out. But the fix is not the threshold. Sweeping the qualify gate against the density
threshold showed the GATE carrying the entire gain and the threshold carrying almost none - at
gate 2, thresholds 0.50 / 0.75 / 1.00 score P 0.750 / 0.800 / 0.800 with recall flat. So
`BUZZ_DENSITY_THRESHOLD` was left at 0.75 and only the gate moved.

**Why:** v3 qualified a page on >= 1 STRONG-or-PEAK term. Any page describing real engineering
clears that - "powerful", "transform", "accelerate", "end-to-end" are ordinary technical
vocabulary. The measured false positives (MDN, Rust, Django, Kubernetes, Vercel docs) each had
0 or 1 distinct PEAK term. PEAK terms are the ones that CANNOT be used concretely (seamless,
revolutionary, world-class, supercharge, game-changing). Requiring TWO distinct PEAK terms asks
whether hype is the page's REGISTER rather than one stray word in a sentence about latency.

**How:** `BUZZ_MIN_DISTINCT_PEAK = 2`, applied in `inPageBuzzword`'s qualify guard. The in-page
scorer carries an inline duplicate (it is serialized by `page.evaluate` and cannot import); a test
compares the two against the scanner's own source text, the same drift guard `typeface-vocabulary`
uses. `BuzzwordScore` also now carries per-tier occurrence counts and per-term counts, so the gate
can be swept offline from one render.

| population | before | after |
|---|---|---|
| TUNE (138, 39 pos) | P 0.600 (33/55), R 0.846 | **P 0.800 (12/15)**, R 0.308 |
| HELD-OUT (37, 19 pos) | P 0.783 (18/23), R 0.947 | **P 1.000 (8/8)**, R 0.421 |
| dev (48, 31 pos) | P 0.839 (26/31), R 0.839 | P 1.000 (9/9), R 0.290 |
| candidates (90, 8 pos) | P 0.292 (7/24), R 0.875 | P 0.500 (3/6), R 0.375 |

Zero false positives on the held-out. Recall roughly halves everywhere - 11 held-out positives
missed (cloudflare, cohere, coinbase, fastly, gitlab, grafana, hashicorp, miro, mongodb, redhat,
wix). That is the accepted trade, stated as the real number rather than a flattering one.

One anti-overfit choice worth recording: gate 2 at threshold 2.00 scores P 0.909 on TUNE, better
than 0.800. It rests on a single false positive out of eleven fires - a knife edge one page wide,
which is exactly the shape that produced the collapse this unit exists to fix. The shipped point
sits mid-plateau instead.

## 2. nested-cards - the retune was REJECTED by its own held-out

This is the finding I did not expect and the one that mattered most.

A guard was swept and looked good: an outer box spanning most of the viewport width reads as a
SECTION, not a card, so its nested children are ordinary layout. On the tuning population it
lifted P 0.733 (11/15) -> 0.800 (8/10).

Then the held-out was scored:

| population | fires | shipped P | rejected-retune P |
|---|---|---|---|
| dev (48, 27 pos) | 10 -> 8 | 0.900 (9/10) | 0.875 (7/8) |
| candidates (90, 7 pos) | 5 -> 2 | 0.400 (2/5) | 0.500 (1/2) |
| TUNE (138, 34 pos) | 15 -> 10 | 0.733 (11/15) | 0.800 (8/10) |
| **HELD-OUT (37, 9 pos)** | 4 -> 2 | **0.750 (3/4)** | **0.500 (1/2)** |

On the held-out the guard removed TWO true positives and ZERO false positives - the opposite of
what it was for. Direction is inconsistent across all three corpora (dev down, candidates up,
held-out down), which is what noise looks like.

**Decision: reverted.** The operating point ships unchanged, and that is a result rather than an
omission. The deeper reason is a corpus limit, not a sweep limit: the class fires FOUR times on
the entire held-out, where one page moves precision by 0.25. No operating point can be validated
out of sample at that denominator - including the one that ships. Making this class tunable needs
materially more labeled positives, not a better sweep.

Two other guards were swept and are recorded as tested-and-worthless so nobody retries them: a
tighter inner-area fraction (0.85 and 0.60 score IDENTICALLY on all 138 pages - shipping 0.60
would have been an inert knob that looks like tuning) and requiring border rather than shadow on
both boxes (lower precision at every point).

What DID change for nested-cards: it moved into the same score/threshold split the buzzword and
typeface classes use, so it is sweepable without a reimplementation, and it emits one finding per
page. `eval/nested-cards-equivalence.mjs` runs the PRE-CHANGE predicate and the shipping one side
by side on all 176 corpus pages and reports any disagreement - **identical on every page**. The
claim is proven rather than asserted.

## 3. numbered-section-markers - REMOVED

Inert: 0 fires against 6 labeled positives. A full sweep of its three parameters over the 138
tuning pages found no point worth shipping. Every point that kept the prominence guard stayed at
zero fires; the best non-inert point (drop the prominence floor, keep zero-padding, run of 3)
reached **precision 0.500 (2 of 4 fires)** at recall 0.333. The held-out has ZERO positives for
the class, so no point could have been validated out of sample either.

**Why it cannot be fixed, not merely why it did not fire:** the reachable signal correlates with
the WRONG pages. The labeled positive (airtable) renders its 01-04 markers as CSS pseudo-element
COUNTERS, and `content:counter(x)` does not serialize to a readable string, so the positives are
structurally invisible to any DOM walk. Meanwhile the readable numerals belong to negatives -
polygon's small incidental "01".."06", raycast's rendered keyboard at display scale.

A coin-flip detector is worse than none under a precision-first ruling, and an inert one in a
registry is a claim nobody can cash. Removed from the scanner, the rule union, and the rendered
registry manifest. The class stays in the eval taxonomy and its corpus labels are untouched.
`eval/numbered-markers-removal-evidence.mjs` preserves the deleted scorer so the removal stays
re-runnable.

## 4. default-typeface - precision is UNDEFINED, not low, so ground A is GATED

The lead asked for a number before any decision. The number does not exist, and finding that out
was the deliverable.

- The ONLY default-typeface labels anywhere are a 23-page set: 11 synthetic fixtures + 12 real pages.
- All 5 labeled POSITIVES are synthetic fixtures authored alongside the detector.
- All 12 labeled REAL pages are NEGATIVES, and it is correctly silent on every one (0 fires / 48 dev).
- It fires on **31 of 90** candidate pages and **9 of 37** held-out pages. **None of those 40 carries
  a label for this class.**

It scores P 1.000 / R 1.000 on the labeled set, and that number is worthless: it measures that the
detector satisfies its own specification. Precision on real pages is 0 true positives over 0
labeled fires.

**Gated,** per the ruling that an unmeasured rule should not ship. Ground A now requires
`enableDefaultStackGround: true`; ground B (brand mismatch) is untouched because it needs a
caller-supplied committed family and has its own discriminating sweep. The un-gate condition is
written into the source: label the class on real pages that FIRE - the 40 above are the sampling
frame - and measure precision on a held-out slice. Another synthetic fixture cannot un-gate it,
because synthetic positives are what produced the unfalsifiable 1.000.

This matters beyond one class: the population it fires on (Wikipedia, Hacker News, Bootstrap
examples, archived pages, internal docs) is full of pages where the system stack is a deliberate
typographic decision.

## 5. Page-level noise deduped

`tiny-text` and `nested-cards` are PAGE-LEVEL judgments - their thresholds are page-wide
proportions - so emitting one finding per offending element restated a single verdict up to 20
times. Both now emit ONE finding carrying the offender count and a representative element. Fixed
in the scanner, because the old emission was wrong at the source.

`low-contrast` / `gray-on-color` are different and were deliberately NOT changed in the scanner: a
low-contrast element is a genuinely distinct defect with its own measured ratio, and the
per-element findings are what the a11y check mapping and `evidenceLocations` consume. They are
collapsed in the detect CLI's human-readable summary only (count + distinct-measurement count +
a representative), so the evidence survives in the scan and the JSON.

## tiny-text - unchanged, and the one number that moved is a known render race

tiny-text was not retuned (P 1.000 on all three corpora, the design holds off its tuning set). Only
its emission changed. But its dev fire count moved 11 -> 12 between two cache runs of the SAME
build, and chasing that mattered more than the number: the extra page is `dub`, which measures
**16% of content text at or below 13px against a 15% floor**. Twelve fresh renders put it below;
the cached render put it above.

This is the page `session_2026-07-28_sidecoach-live-efficacy.md` flagged as the single instability
in 138 pages, independently rediscovered. The cause is the documented one: the hermetic render
uses `waitUntil: 'domcontentloaded'`, which does not wait for webfonts, so font metrics - and
therefore the char-weighted proportion - can differ between runs on a page sitting on its
threshold. It is NOT caused by this unit; the equivalence harness compares before and after
WITHIN a single render, so it is immune to the race and reported identical.

Honest statement of the number: **tiny-text dev R is 0.234 (11/47) or 0.255 (12/47) depending on
that one page. Precision is 1.000 either way, on all three corpora.**

The dedupe is visible in the same record: cached `dub` carries ONE tiny-text finding reading
"16% of content text <=13px across 87 element(s)". The old emission would have printed 20 lines.

## Test work

New suite `taste-precision-gates.test.ts` (24 assertions), registered in `run-tests.ts`. Seven
mutations, each caught by the assertion that claims to cover it:

| mutation | caught by |
|---|---|
| exported `BUZZ_MIN_DISTINCT_PEAK` 2 -> 3/4 | drift check + frozen-value check |
| inline gate 2 -> 3 (the drift direction that matters) | drift check |
| `DEFAULT_STACK_GROUND_GATED` true -> false | gate check |
| ground-A opt-in logic deleted | "must be SILENT with no opt-in" |
| nested-cards pair filter deleted | (guard rejected; assertion re-aimed at the rejection) |
| `numbered-section-markers` restored to the rule union + list | removal check |
| `collapseForDisplay` returns its input | collapse count + representative checks |
| inline gate DELETED while the scorer still works | scoped drift check (the unscoped one passed here) |
| analyzer pushes one nested-cards finding per pair | production one-per-page browser check |

**A vacuous-assertion trap caught mid-flight, worth recording as the process finding.** Five in
total - three I caught, two Codex caught after I believed the suite was sound. Three of
those mutations initially died at TYPECHECK rather than at my assertions. TypeScript narrows an
exported `const` to its literal type, so `BUZZ_MIN_DISTINCT_PEAK === 2` and
`DEFAULT_STACK_GROUND_GATED === true` were COMPILE-time tautologies that could never fail at
runtime - the exact shape this repo has been repairing in other suites. An explicit `: number` /
`: boolean` annotation does NOT fix it, because narrowing still flows through the initializer. Two
one-line helpers whose declared RETURN type is unnarrowed do. The generalisable rule: a mutation
that dies at compile time has not proven your assertion runs - only that the mutation was
type-invalid. Re-do it in a type-valid form before believing the proof.

Calibration suite grew 42 -> 47 assertions: the false-positive mode is now a pinned negative
(dense technical vocabulary above the density threshold with ONE peak term must be clean), its
mirror is a pinned positive (same register, two peak terms, fires), the rejected nested-cards
guard is pinned as a POSITIVE so a future re-tune that silences it must bring a fresh held-out,
and two fixtures assert the default-typeface gate stays silent by default.

## Codex review (2 passes, both exit 0)

Wrapper: `git diff | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo> -t 600`. Never `codex exec`,
never the rescue agent.

**Pass A - the detector diff. Exit 0, 163.4s.** Codex was asked directly whether the retuning is
defensible or overfit again. Verdict: the buzzword gate is a principled mechanism rather than a
fitted number, no code branches on held-out data, rejecting the nested-cards retune is
"disciplined, not overreaction", and gating default-typeface is the right response. It added a
warning I am recording as an operating constraint: **the held-out is now spent for this decision -
do not iterate against it again.** Four findings, all folded:
- HIGH: `typeface-calibrate.mjs` / `typeface-a5a.mjs` still passed `{}`, so the new gate would have
  made them report every ground-A positive as silent - a real detector regression signal that was
  actually a product gate. Both now opt in explicitly.
- MED: stale harnesses still treating the removed rule as measurable, plus my own sweep reading
  fields that no longer exist. Corrected, and the sweep now reports UNAVAILABLE rather than a zero
  nobody could distinguish from the real pre-removal zero.
- LOW x2: the equivalence claim was over-broad (it proves the FIRE DECISION; the representative
  pair changed from first to smallest, so selector/detail evidence can differ) and two stale
  finding-count comments.

**Pass B - the tests and eval harnesses. Exit 0, 191.4s.** Seven findings against my own
measurement code, all folded:
- P1: held-out isolation was documented, not enforced - the sweep loaded the held-out cache
  unconditionally and printed one held-out line outside the `--heldout` phase. It is now not
  LOADED at all without the flag, so no sweep can read it by mistake.
- P1: the cache had no build stamp, so scores from one build could be scored against constants
  from another and produce numbers that look entirely normal. Both harnesses now hash the scanner
  source plus dist; the sweep exits 6 on any mismatch. Verified live - it caught the pre-stamp
  cache on the first run after the change.
- P1: denominators failed open on missing labels. Unlabeled pages are now a hard failure (exit 5)
  except for one declared expected gap (`heldout/zendesk`, 38 files vs 37 labeled ids).
- P2: the sweep still hand-coded the SHIPPED predicates. The "what ships" rows now call the
  exported `buzzwordFindingFromScore` / `nestedCardsFindingFromScore` / `typefaceFindingFromScore`
  on the cached scores; only the candidate sweep rows keep parameterised logic. Re-run after the
  change: every number identical, which is the check that the refactor was faithful.
- P2: TWO MORE VACUOUS ASSERTIONS in my own new suite, past the three I had already fixed. The
  drift regex was not scoped to `inPageBuzzword`, so deleting the inline copy entirely - which
  breaks the serialized scorer - would still have matched the `export const` line. And
  `Array.isArray([f]) && [f].length === 1` is true for any non-null value. Both replaced; the
  one-finding-per-page claim is now proven through the production analyzer in a browser.
- P2: F1 printed `n/a` for a real zero because `prec && rec` treats 0 as absent - precisely on the
  low-recall and inert-detector rows where a 0.000 is the finding.
- P3: two evidence scripts exited 0 on partial work. Both now fail closed and assert their
  expected population.

**A note on wrapper exit codes.** An earlier pass B run returned exit 0 with EMPTY output. Cause
was mine, not the wrapper's: my prompt contained backticked code spans inside a double-quoted
shell string, so zsh ran them as command substitutions, corrupted the prompt, and emitted
`(eval):1: == not found`. Re-run with the prompt in a heredoc file it worked. Worth remembering -
a zero-byte verdict from a zero exit code is a quoting bug, not a Codex failure.

## Final verification

- `npm test`: **171 suite(s) passed, exit 0** (baseline 170 + the new suite). The two `Status: FAILED`
  strings in the log are a test's own expected output and appear identically in the clean baseline.
- `npx tsc --noEmit`: clean.
- Removing numbered-section-markers orphaned 5 on-disk fixtures whose names no longer matched any
  class; the structural-motion suite caught it (`fixture ... names no known class`) rather than
  ignoring them. Deleted.
- A second mid-run edit invalidated one full-suite run (I touched `empty-render-guard.test.ts` to
  drop a stale stub field while the suite was executing). Killed it and re-ran clean rather than
  quoting a result from a tree that changed under it - the same rule the baseline taught.

Wrapper exit codes, every invocation:

| run | exit | note |
|---|---|---|
| Codex pass A (detector diff) | 0 | verdict in 163.4s |
| Codex pass B, 1st attempt | 0 | EMPTY output - my shell quoting, not the wrapper |
| Codex pass B, re-run | 0 | verdict in 191.4s |
| `taste-precision-features.mjs` | 0 | 175 pages, 0 render failures |
| `taste-precision-sweep.mjs` | 6 then 0 | 6 fired live on the stale pre-stamp cache, exactly as designed |
| `nested-cards-equivalence.mjs` | 0 | 176 pages identical |
| `numbered-markers-removal-evidence.mjs` | 0 | 138 pages, 6 positives |
| `default-typeface-precision-measure.mjs` | 0 | 23 labeled pages |

## Files touched

- `src/validators/subjective-rendered-scanner.ts` - buzzword v4 gate + score fields; nested-cards
  extracted to `inPageNestedCards`/`nestedCardsFindingFromScore` with one-finding emission;
  tiny-text one-finding emission; `numbered-section-markers` removed; default-typeface ground A gated
- `src/validators/rendered-live-scan.ts` - wire the nested-cards scorer
- `src/product-rule-registry.ts` - drop the numbered-section-markers registry claim
- `bin/sidecoach-detect.js` - `collapseForDisplay` for the per-element objective rules
- `src/__tests__/taste-precision-gates.test.ts` (new), `subjective-rendered-calibration.test.ts`,
  `structural-motion.test.ts`, `product-rule-registry.test.ts`, `scripts/run-tests.ts`
- `eval/taste-precision-features.mjs`, `eval/taste-precision-sweep.mjs`,
  `eval/nested-cards-equivalence.mjs`, `eval/numbered-markers-removal-evidence.mjs`,
  `eval/default-typeface-precision-measure.mjs` (all new)
- `eval/typeface-calibrate.mjs`, `eval/typeface-a5a.mjs` - opt in to ground A now that it is gated
- `eval/structural-motion-calibrate.mjs`, `eval/stage4bcd-a5a.mjs` - stop claiming the removed rule
- `eval/.gitignore` - the feature cache follows the existing derived-cache precedent
- 5 orphaned `eval/fixtures/structural-motion/*numbered-section-markers*.html` deleted
- this beat + MEMORY.md index. No commit made.
