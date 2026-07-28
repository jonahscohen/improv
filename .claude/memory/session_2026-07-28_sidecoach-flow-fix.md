---
name: Made the sidecoach flow surface actually look at its target
description: Fixed the measured defect where all 20 verbs returned byte-identical canned output for file/path/directory targets. File and directory targets now render through the same engine sidecoach-detect uses, unrenderable targets fail loudly instead of returning a confident grade, and three constant findings (two named, one found while fixing them) are gone. Two maximally different targets went from 20 differing lines (all timestamps) to 229 lines of substance.
type: project
relates_to: [session_2026-07-28_sidecoach-live-efficacy.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: npm test 169 -> 170 suites green, 132 new assertions, 18 mutations each caught, Codex review (codex-cli 0.142.5, 5 findings folded), held-out corpus measurement (108 fires over 6 pages) rejecting a naive broken-image fix, 3-of-38 partial cross-check
confidence: high
---

Collaborator: Jonah. Executed against the measurement in
`session_2026-07-28_sidecoach-live-efficacy.md`, which found the detection engine real and the
flow surface canned. This unit fixed the flow surface.

## Verification baseline (Team Rule 9, probed BEFORE anything changed)

- `npx tsc --noEmit` in `sidecoach/` exits 0.
- `npm test` exits 0: **169 suites passed** (168 pre-dated yesterday's empty-render guard).

Final: `npm test` exits 0, **170 suites passed** (169 + the new suite). One intermediate run
failed exactly one suite - my own, caught by my own non-vacuity guard under the suite's isolated
HOME (see below) - and NO pre-existing suite regressed at any point.

## The defect, reproduced first

Reproduced the lead's measurement independently before touching code. Two targets - a 0-byte
file and a page carrying a skipped heading (h1 -> h4), 6px justified text, near-white text on
white, an `<img>` with an empty src, and 160 buzzwords:

    /sidecoach audit /tmp/scflow/empty.html    -> 32098 bytes
    /sidecoach audit /tmp/scflow/broken.html   -> 32098 bytes

Diff of the sorted JSON: **20 differing lines, every one of them a timestamp** (`generatedAt`,
`reportId`, `startTime`, `endTime`, `executionDuration`). Both returned grade **B**, verdict
`blocked`, and the same two findings:

    performance:has_optimization_guidance | Domain validation: 1/2 rules passed
    domains-needs-testing                 | domains-needs-testing = 7 (target 7)

## Three causes, not one

**1. Only a URL rendered.** The audit read path was gated on `looksLikeUrl(commandMatch.target)`
(orchestrator ~line 885). A file, path or directory target skipped the render entirely and fell
through to the guidance chain, which graded a page it had never opened.

**2. A flow grading its own guidance text.** Verified against the source before deleting:
`createPerformanceValidator`'s `has_optimization_guidance` asks whether `result.guidance`
contains "optimize"/"smooth"/"reduced-motion". Checked the whole of `flow-domain-validators.ts` -
**every rule in all five validators** reads `result.guidance`, `result.checklist` or
`result.artifacts`. Not one reads the user's target. This family is a handler self-consistency
check, which is a legitimate internal invariant and is not a finding about the user's page. The
shipped report said "resolve the performance:has optimization guidance issue on the affected
element" when there was no affected element.

**3. A metric that fires when it reaches its target.** All 7 domains in
`flow-handler-accessibility.ts` are constructed with a hard-coded
`complianceStatus: 'needs_testing'`, so `needsTestingCount` is the constant 7 on every run for
every target, and `addMetric(..., 'warning', ...)` hard-codes the status independently of the
value. `statusToSeverity` maps 'warning' to a finding, so it fired forever.

**Neither constant had any test coverage** - grepped both names across `src`, `bin` and
`scripts`; zero hits outside their definitions.

## A third constant, found while fixing the second

Grepping every `addMetric` call site for a hard-coded status turned up `violation-count`
declared `'warning'` unconditionally in `flow-handler-tactical-polish.ts`. Its four sibling
metrics in the same builder chain already derived status from the value. So a polish run with
**zero** violations still emitted "violation-count = 0" as a warning: a defect report that
fires precisely when nothing is wrong. Same defect class, fixed with the same rule.

## What changed

**Why:** the engine already renders local files correctly - `sidecoach-detect <file.html>`
drives `runRenderedAudit` over a `file://` URL, and `file:` is already in the render URL
allowlist. The flow layer simply was not using it. So the fix is target RESOLUTION, not a
second renderer.

**How:**

- `resolveAuditTarget()` in `audit-rendered.ts` maps a target to the URL to render: a URL keeps
  its behaviour, an `.html`/`.htm`/`.xhtml` file resolves to its `file://` URL, a directory
  resolves to its entry document (`index.html`, `index.htm`). Anything else resolves to
  `renderable: false` with a distinct kind (`missing`, `unsupported-file`, `no-entry-document`),
  a reason, and a remedy.
- The orchestrator gate changed from "the target is a URL" to "a target was given". A target-less
  `/sidecoach audit` deliberately keeps its flow-chain behaviour: with no target there is no page
  to render and nothing is being claimed about one. (This also preserves
  `sprint10-context-propagation.test.ts`, which uses that shape to spy on flowI.)
- An unrenderable target returns `success: false`, **no BuildReport**, and a message containing
  "NOTHING WAS SCANNED", matching the existing fail-closed discipline. Exit 1 at the CLI.
- `DomainMeasures` (`'artifact' | 'flow-output'`) added to `DomainValidator`/`ValidationResult`.
  The build-report aggregator skips `flow-output` domains for **both** findings and domain grades.
  The suppression triggers only on an explicit `'flow-output'`; unset keeps prior behaviour,
  because claudemd-mandate, polish-standard, linguistic-ban, absolute-ban and taste build their
  ValidationResult directly and never set the field - dropping those would trade a false positive
  for a false negative. The safety instead lives in the `createDomainValidator` factory, which
  defaults to `'flow-output'` and in production is used only by the introspective family.
- `countMetricStatus(count, severity)` in `flow-memory-schema.ts` names the rule the correct
  metrics already used, and `violation-count` now uses it.
- `domains-needs-testing` no longer claims a warning it never measured.

## The acceptance bar

Same two-target diff, after:

| target | verdict | grade | findings | exit |
|---|---|---|---|---|
| clean.html (well-formed) | clean | **A** | 0 | 0 |
| empty.html (0 bytes) | inconclusive | none | 0 | 1 |
| catastrophic.html | blocked | **F** | 10 | 0 |

Differing lines between the two maximally different targets: **20 (all timestamps) -> 229**.
The catastrophic page grades F against the clean page's A. A 0-byte file is INCONCLUSIVE, not
clean and not graded - yesterday's empty-render guard, which this render path now actually
reaches for a local file.

Directory targets render their entry document and report which one
(`renderedDocument: .../site-with-index/index.html`). Every unrenderable class exits 1 with its
own reason and no build report.

## Ground truth, not just difference

Differing output is necessary and not sufficient, so the catastrophic assertions are pinned to
the two objective detectors the prior measurement scored at **P 1.000 / R 1.000 on 89 held-out
real pages**. The flow reports `skipped-heading`, `broken-image` and `low-contrast` on the
catastrophic page and none of them on the clean one.

## broken-image: a real recall gap that is NOT safely fixable (measured, not argued)

The lead built a held-out fixture this unit had never seen and found that `broken-image` fires
for an EMPTY `src` but not for a src naming a FILE THAT DOES NOT EXIST. Reproduced immediately:

    /sidecoach audit .../empty-src.html     -> blocked, rules [broken-image, default-typeface]
    /sidecoach audit .../missing-file.html  -> warnings-only, rules [default-typeface]

The lead is right that the case is REAL and newly relevant: the detector is deliberately
STRUCTURAL (src attribute absent/empty) because "under a deterministic hermetic render external
loads are blocked, so naturalWidth/load-failure is meaningless (it would flag every external
img)". That rationale does not obviously cover a `file://` document, whose SAME-PROTOCOL
subresources `isSubresourceAllowed` explicitly permits - and local file targets only started
reaching the render path because of this unit's change.

So it was MEASURED rather than argued, by running exactly the load-state check that would ship,
over the real held-out corpus:

| | current detector | naive load-state check |
|---|---|---|
| fires over 6 corpus pages | **0** | **108** |
| relative `<img>` refs resolving to a missing file, all 38 pages | - | **972** |
| relative images that load SUCCESSFULLY on those pages | - | **0** |
| pages affected | - | **25 of 38** |

Every one of those is a CAPTURE ARTIFACT: the corpus pages were saved without their asset trees,
so every relative image reference is dangling. Adopting load state would trade broken-image's
measured P 1.000 for a detector that fires wrongly on 25 of 38 real pages. A second, independent
reason to reject it: 114 images on one page were still `pending` (load not settled) at snapshot
time, so the signal is not even deterministic when we read it.

**Verdict: the lead's fixture is a TRUE POSITIVE, not a bad fixture.** The detector's silence is
a deliberate precision-first design, and the gap is not safely closable by load state under the
current hermetic render policy. Nothing was changed in the detector. RULING (lead, 2026-07-28):
keep the detector exactly as it is; do not adopt load state, globally or scoped, in this unit.
The `pending` observation closes it independently of the corpus argument - a signal that has not
settled when you read it is not a signal.

### The residual, stated the way it must not be misread

**The detector is CORRECT for the eval corpus and WRONG for the real use case.** A capture saved
without its asset tree has dangling references BY CONSTRUCTION; a user auditing their own built
page has a GENUINE DEFECT when a relative image is missing. Those two populations disagree. The
corpus is what we measure against; the user is who we serve.

**That tension IS the finding. Do not resolve it by tuning a threshold.** Any future attempt to
close this gap has to reckon with both populations, not pick the one that makes a number move.

**This is NOT the `h5`-before-`h1` case, and conflating them will cost precision.** That fixture
was WRONG - an `h5` before an `h1` is a heading ASCENT, not a skip, so `skipped-heading` was
correctly silent and the fixture briefly looked like a failed fix when nothing was broken. THIS
fixture found something TRUE that we are choosing not to detect. A reader who treats the two as
the same story will "fix" this one and take `broken-image`'s P 1.000 with it.

### Method note (why this cost what it cost)

The fix was IMPLEMENTED in order to be disproved, not argued about. There was a real defect, a
plausible mechanism, and a lead instruction pointing at it - three reasons to ship - and the only
thing that stopped it was building the change and running it against data that had a vote. The
generalizable rule: a sanctioned fix for a confirmed defect still has to be measured against the
population it will run on, because "the defect is real" and "this fix is safe" are independent
claims.

What DID change: the fixture pair now carries BOTH shapes, and the boundary is asserted rather
than silent - empty-src MUST fire, missing-file MUST NOT - with the measurement in the test
header so any future attempt to "fix" it has to confront the 972-reference corpus cost first.
Both assertions are mutation-controlled (B1 disable the structural check; B2 add the naive
load-state check, which correctly flips the boundary assertion and proves it is not vacuous).

## Held out, not tuned

The fixtures are the acceptance bar, NOT evidence that detection generalizes - the prior unit
found `marketing-buzzword` precision collapsing 0.839 -> 0.304 off its tuning set, so fixture
agreement is deliberately not claimed as generalization.

Separately cross-checked the flow against the known-good `detect` path over the real captured
pages in `eval/corpus/buzzword-heldout`, which this unit did not develop against and which are
not fixtures, comparing per-rule objective finding counts page by page.

**PARTIAL: 3 of 38 pages. Stopped on the lead's ruling, not completed.** At roughly 4 minutes
per page (two full browser renders each) the full sweep was a 2.5-hour tail that nothing
depended on, so it was killed deliberately. Recorded honestly as directional, NOT as a completed
sweep:

    arbitrum.html   SKIPPED - detect exceeded the 120s per-page timeout; the FLOW side succeeded
    atlassian.html  agree
    bun-docs.html   agree

Two agreements out of two comparable pages. The one skip is on the DETECT side (it additionally
runs static lenses over these 1MB+ captured files), not on the path this unit changed. This is a
weak sample and is not offered as evidence that detection generalizes; the ground-truth
requirement is carried by the suite assertions pinned to the named detectors, not by this.

## Mutation control

Every new assertion is mutation-controlled. **18 mutations, 0 uncaught.**

| mutation | caught by |
|---|---|
| M1 audit gate reverted to `looksLikeUrl` | acceptance: clean file target RENDERED |
| M2 flow-output finding suppression deleted | self-check: emits NO finding |
| M3 flow-output domain-grade suppression deleted | self-check: contributes NO domain grade |
| M4' domains-needs-testing restored as a constant warning | chain: NO domains-needs-testing finding |
| M5 countMetricStatus always reports the severity | count-metric: zero problems -> pass |
| M6' unsupported-file + non-regular-file guard disabled | resolve: a source file is UNRENDERABLE |
| M7 directory entry-document probe emptied | resolve: directory with index.html is renderable |
| M8 unrenderable target reported success=true | fail-loud: success=false |
| M9 unrenderable target emits a build report | fail-loud: NO build report |
| C1 `file://` returned verbatim again | file-url: resolves to the real path |
| C2 non-page targets hard-error again | does not compile (see below) |
| C3 NO PAGE WAS RENDERED notice removed | non-page: says NO PAGE WAS RENDERED |
| C4 unrendered target still gets clean + grade A | non-page: NO build report |
| C5 self-check leaks into the warnings message | chain: no self-check in flowResults[].message |
| C6 domains-needs-testing re-added as a metric | chain: NO domains-needs-testing finding |

C2 is caught by the TYPE CHECKER rather than an assertion: returning early instead of assigning
`unrenderedAuditTarget` lets control-flow analysis prove the variable is always null, so every
downstream use narrows to `never` and the build fails. The mutation cannot ship. The same
property is covered behaviourally by C3 and C4, which do compile and are caught by assertions.

| C7 createDomainValidator defaults to 'artifact' | chain: NO has_optimization_guidance finding |
| B1 empty-src structural check disabled | ground truth: broken-image (empty src) is reported |
| B2 naive load-state check added | broken-image: a MISSING FILE does not fire |

B2 is the important one of the pair: it proves the missing-file BOUNDARY assertion is live
rather than trivially true. An assertion that something does NOT happen is worthless unless a
plausible change makes it happen, and B2 is exactly that change.

**A third catch, this one from the full suite rather than a mutation.** My own non-vacuity guard
("the guidance-introspection validators still RUN") FAILED inside `npm test` while passing
standalone. Cause: run-tests.ts isolates HOME, so flowI never reaches `status: 'success'`, no
domain validators attach, and there was nothing for the labelling assertion to inspect. The
guard did exactly its job - it refused to let the assertion below it pass vacuously in the one
environment that gates the repo. Fixed by asserting the labelling AT ITS SOURCE (all five
production factories return `measures: 'flow-output'`), which is deterministic and
environment-independent, and keeping the live-propagation check as an environment-tolerant
addendum that prints a NOTE when it cannot be exercised. Lesson: a guard that fires in CI and
not locally is the guard earning its keep, not noise to route around.

**Why the suite reports 132 standalone and 131 inside `npm test`** (worth one line so a future
reader does not chase it): the single-assertion delta IS that live-propagation addendum
declaring itself not-exercised under the isolated HOME, and it PRINTS a NOTE line when it does
so. A skip that announces itself is not a silent skip. The invariant it covers is still asserted
in that run, at the source, deterministically.

**A harness weakness this exposed.** Re-running the original nine after folding the Codex
findings, M4 and M6 reported "NOT CAUGHT" - but both were STALE ANCHORS: I had removed the
`domains-needs-testing` line entirely (F5) and rewritten the extension guard (F2), so both
`str.replace` calls were silent no-ops mutating nothing. A no-op mutation is indistinguishable
from an uncaught one in a naive harness, and it fails in the DANGEROUS direction: it looks like
a hole in the tests, and had it gone the other way (a no-op that "passes") it would have looked
like proof. Every mutation now asserts its anchor exists before editing, and both were re-run
correctly as M4'/M6' and caught.

## Self-analysis - my first mutation run caught me writing a vacuous assertion

**M4 initially passed under mutation.** My "the constants are gone" assertion inspected the
rendered-audit payload of the two fixture targets. But the rendered audit **bypasses the flow
chain**, so `flowI_accessibility` - the only emitter of `domains-needs-testing` - never ran
there. The string was absent for a reason that had nothing to do with my fix, and reverting the
metric to a permanent warning still passed.

Why it happened: I verified the fix on the live output of the path I had just changed, then
wrote the assertion against that same path without asking which code actually produces the
symbol I was asserting about. The absence was real; my explanation for it was wrong.

The fix: a separate layer that drives `/sidecoach audit` with NO target (the shape that DOES
route through the chain), with an explicit **non-vacuity guard** asserting
`flowI_accessibility` actually ran - so if that flow ever stops running there, the layer fails
loudly instead of passing for the wrong reason.

This is the same failure the prior session hit (Codex F14: a guard test that injected the result
it asserted). Its stated lesson was "a mutation proof is only as good as the region it mutates."
I hit the adjacent version: **an absence assertion is only as good as your reason for believing
the thing could have been present.** Testing that a string is missing proves nothing unless the
code that emits it ran. That is why the non-vacuity guard is in the suite and not just in my
head - and it is the reason to run mutations before reporting, not after.

**Second failure, and it is the more important one: I over-applied the mandate.** The
instruction was that an unrenderable target "must SAY SO and fail loudly", and I turned that
into "every non-renderable audit target is an error" - which broke three documented invocation
shapes, including `/sidecoach audit <project>`, the one SKILL.md wires to the drift lens.

Why it happened: I took a rule stated about the DEFECT CASE (a page target silently not
scanned) and applied it to the whole input space without checking what else lived there. I read
SKILL.md line 177 for the audit's rendering contract and stopped; line 171, six lines earlier,
documents the project-target shape. I had the file open and did not read around the line I
wanted.

The deeper error is that I optimised for the letter of the instruction over the property it
protects. The property is "never present an unscanned target as a scanned one." Erroring
satisfies it, but so does running the documented flow and saying plainly that no page was
rendered - and only the second one keeps the feature. When a mandate and a documented behaviour
collide, the resolution is usually a third option that serves the mandate's PURPOSE, not a
coin-flip between the two. Codex found this because it drove the real shapes instead of
re-reading the diff; that is the check my own verification was missing, since every target I
tested was one my own change was designed around.

## Codex review - 5 findings, all folded

Probed `command -v codex` first: present, codex-cli 0.142.5. It did NOT hang this time (the
prior unit saw ~15 and ~9 minute hangs); it ran ~25 minutes, actively driving my own code paths
to reproduce each claim, and exited 0. No fallback reviewer was needed.

**F1 (High) - THE LEAD'S INSTRUCTION WAS OVER-BROAD, corrected on evidence.** Recorded this way
at the lead's own direction, and it is the accurate attribution. The dispatch said an
unrenderable target "must SAY SO and fail loudly". Implemented literally, that breaks
`/sidecoach audit .`, `/sidecoach audit PRODUCT.md` and `/sidecoach audit SomeComponentName`,
all documented shapes. The correct property is narrower than the instruction: **a result that
scanned no page must never be READ as one.** Failing loudly is one way to satisfy that and it is
not the only one, and it is the one that destroys a documented feature. The record should show a
lead instruction corrected by evidence, not an executor misreading it - though the executor
still owns having applied a rule stated about the defect case to the entire input space without
checking what else lived there (see Self-analysis).

**F1 as Codex reported it - documented non-page audits regressed to errors.** Codex reproduced
`/sidecoach audit .`, `/sidecoach audit PRODUCT.md` and `/sidecoach audit SomeComponentName`
now returning `success:false` with no BuildReport, against SKILL.md line 171 (`/sidecoach audit
<project>` reaches flowK's drift lens) and line 177 ("page or component"). **This was a real
over-application of the fail-loud rule and the most valuable finding in the review.**

The correction, and the sharper statement of what the mandate actually protects: the property
that matters is NOT "error on a non-page" - it is that **a result which scanned no page can
never be read as one**. So:
- a renderable target renders (unchanged),
- a non-page target keeps its documented chain, and the result now opens with
  `NO PAGE WAS RENDERED. <reason> ... nothing below is a measurement of a page. <remedy>`,
  carries `audit.rendered: false`, and **emits no BuildReport at all**,
- one carve-out still errors: a target that NAMES an `.html`/`.htm` document which does not
  exist. That is a broken path, and answering a typo with generic project guidance hides it.

Dropping the BuildReport for that case was a second-order catch of my own while verifying the
fix: with the chain restored, `/sidecoach audit .` reported `verdict: clean, overallGrade: A`
about a page nothing had opened. A loud notice next to a grade of A does not cancel the grade,
and that grade is the exact defect this unit exists to remove.

**F2 (High) - `file://` targets bypassed every check.** I returned an explicit `file://` target
verbatim, so `file:///tmp/Button.tsx`, `file:///tmp/not-html.txt`, raw-space URLs and encoded
traversal-like URLs all resolved renderable. The fail-loud guarantee held for path syntax and
not for URL syntax - the same shape of hole as the original defect, in my own fix. Now parsed
with `new URL` + `fileURLToPath`, run through the identical `stat` + `isFile()` + extension
gate, and re-emitted canonically via `pathToFileURL`.

**F3 (Medium) - the self-check still leaked into machine JSON.** Suppressed in findings and
grades, it survived in `flowResults[].message` as
`Validation warnings: [performance] has_optimization_guidance` on every run for every target.
Fixed at all three append sites via a named `userFacingValidationFailures` helper.

Scope stated honestly: the raw `result.validationResults` array still RECORDS the self-check,
because `domain-validation-coverage.test.ts` asserts those entries reach both the result and
the persisted memory entry (an ordering invariant). Dropping them would trade this fix for that
regression. The record is labelled `measures: 'flow-output'`, and the suite asserts both that
the validators still run and that every one is labelled - so no consumer has to guess.

**F4 (Medium) - the required suite was not browser-tolerant, and directory render was untested
end to end.** The suite hard-failed where Chromium could not launch, contradicting run-tests.ts'
stated convention that a real-browser suite SKIPs gracefully. Now it probes for a LAUNCH failure
specifically and skips only the render-dependent layer, printing exactly which assertions did
not run and which still did; a page that renders and finds nothing is still a failure, never a
skip. Added the missing end-to-end directory assertions (renders, names its entry document,
grades F).

**F5 (Low) - `domains-needs-testing` as `pass` was still a lie.** Correct: restating "7 domains
still need testing" as a pass only moved the falsehood. The metric is **removed**. It was never
a measurement - it is a plan, and the plan still lives in the checklist, the guidance and
`customData['domains-needing-testing']`.

## A latent second leak path, found in self-review

While waiting on the review gate I re-read my own diff against the questions I had handed
Codex, and found that `convergence-loop.ts`'s `extractFindingsFromFlowResult` is a SECOND
converter from `validationResults` to findings, and it had no self-check filter. A
`flow-output` validator reaching it would become a convergence finding that no edit to the
user's page can ever satisfy - a loop with an unreachable exit condition.

It has **zero callers** today (verified by searching the whole repo excluding node_modules and
dist), so this was latent rather than live. Guarded anyway with the same rule and a comment
saying why: an inconsistent second converter is exactly how a fixed defect comes back.

## Reported, not fixed (as instructed)

The empty-render guard still does not wait for an SPA to mount, and a shell that paints
"Loading..." still clears it. My render work did **not** make this trivially fixable: the guard
probes after `domcontentloaded`, and waiting for mount needs a settle policy (a threshold plus a
scan-time cost) or true mount detection. That is a design call, not a mechanical follow-on, so it
is untouched. Note it now affects more targets than before, because local files reach the guard
at all for the first time - a 0-byte file correctly returns inconclusive rather than a false B.

## Scope note

Fixes 2 and 3 are global: they live in the aggregator, the memory schema and the handlers, so
every verb's findings and grades benefit. Fix 1 is scoped to `audit`, the verb documented as
"renders the page and runs the detection engine"; the other verbs are build-pipeline flows that
legitimately produce guidance rather than scans.

## Registration needs (owned by other teammates, not edited here)

None. The new suite is registered in `sidecoach/scripts/run-tests.ts`, which is inside
`sidecoach/`. No `install.sh` or `claude/hooks/` change is required.

## Acceptance (lead, 2026-07-28)

Unit ACCEPTED. The lead independently reproduced the two-target result and graded a held-out
fixture they built themselves, and ran `npm test` from their own session: 170 suites green at
exit 0 with the broken-image layer included.

Two things the lead singled out as the durable parts of this unit, recorded so a future reader
takes the method rather than only the outcome:

1. **Implementing a sanctioned fix in order to disprove it.** There was a confirmed defect, a
   plausible mechanism, and a lead instruction pointing at the fix. It was still built and
   measured before shipping, and the measurement (972 dangling references across 25 of 38 pages)
   killed it. "The defect is real" and "this fix is safe" are independent claims.
2. **A guard that failed in CI while passing locally.** The non-vacuity guard stopped a hollow
   assertion from shipping green. A guard that only fires in the gating environment is the guard
   earning its keep.

Also noted at acceptance: treating a blocked state as work is a real pattern, and it happened
twice in this unit - waiting on a cross-check that gated nothing, then polling a completed test
log after it had already returned its answer. Named here because the correction is worth more
than the outcome it did not change.

## Files touched

- `sidecoach/src/audit-rendered.ts` - `resolveAuditTarget`, `DIRECTORY_ENTRY_DOCUMENTS`, target
  resolution types, `file://` parsed through the same stat + isFile + extension gate
- `sidecoach/src/sidecoach-orchestrator.ts` - audit gate resolves any given target; renderable
  renders, a missing named document errors, everything else keeps its documented chain with a
  `NO PAGE WAS RENDERED` notice and no BuildReport; `toUnrenderableAuditResult`;
  `userFacingValidationFailures`; rendered result carries `targetKind` / `renderedDocument`
- `sidecoach/src/convergence-loop.ts` - self-check findings cannot enter a convergence loop
- `sidecoach/src/flow-composition.ts` - `DomainMeasures`, propagated through `validateResult`,
  `createDomainValidator` defaults to `flow-output`
- `sidecoach/src/build-report-aggregator.ts` - skip `flow-output` domains for findings and grades
- `sidecoach/src/flow-memory-schema.ts` - `countMetricStatus`, `addMetric` caveat comment
- `sidecoach/src/flow-handler-accessibility.ts` - `domains-needs-testing` no longer a constant warning
- `sidecoach/src/flow-handler-tactical-polish.ts` - count metrics derive status via `countMetricStatus`
- `sidecoach/src/__tests__/flow-target-render.test.ts` - new, 124 assertions across 8 layers
  (resolution, file:// gate, self-check suppression, count metrics, the render acceptance bar,
  the constants-gone-from-chain layer, non-page chain preservation, fail-loud)
- `sidecoach/fixtures/flow-target-render/` - clean / catastrophic / empty / dir-with-index /
  dir-without-index / broken-image-empty-src / broken-image-missing-file
- `sidecoach/scripts/run-tests.ts` - registered the new suite
- this beat + MEMORY.md index. No commit made.
