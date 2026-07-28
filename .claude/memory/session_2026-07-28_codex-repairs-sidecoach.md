---
name: Codex-driven repair of the sidecoach flow-fix unit
description: Repaired 7 defects Codex confirmed against the previous flow-fix unit, whose headline safety claim was FALSE as shipped - the PANEL still printed "verdict clean - grade A" for an audit that rendered nothing, and only 1 of 20 verbs had actually been fixed. Codex designed every fix and re-reviewed the final diff; the measures discriminator is now safe in one direction and the acceptance suite can no longer report a browserless run as green.
type: project
relates_to: [session_2026-07-28_sidecoach-flow-fix.md, session_2026-07-28_sidecoach-live-efficacy.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: npm test 170 suites exit 0 (baseline preserved); flow-target-render 132 -> 320 assertions, browser layer 34/34; 17 mutation controls all caught under an isolated HOME with anchors verified and compile-failures rejected; three Codex reviews via the deterministic wrapper (all exit 0), 10 findings across rounds 2 and 3 all folded, final verdict "the diff is clean"; item 1 and the document/teach/shtml holes reproduced live before and after
confidence: high
---

Collaborator: Jonah. Executed against the Codex vet of
`session_2026-07-28_sidecoach-flow-fix.md`. Jonah's directive: Codex drives, because he does
not trust the Claude side's self-assessment on this unit. Every fix below was DESIGNED by
Codex through the deterministic wrapper (`~/.claude/hooks/codex-review.py`, prompt positional,
diff on stdin) and the final diff re-reviewed the same way. `codex exec` and the codex-rescue
agent were not used - the first wedges, the second silently downgrades to a same-model review.

## Verification baseline (Team Rule 9, probed BEFORE any edit)

- `npx tsc --noEmit` in `sidecoach/`: exit 0.
- `npm test`: exit 0, **170 suites passed**.
- `flow-target-render` standalone: 132/132.

## The headline claim was false, and I reproduced it first

The previous unit's stated property was "a confident grade for an unscanned target is the
defect this whole unit exists to remove." Running `/sidecoach audit .` before touching
anything:

    audit.rendered      = false
    buildReport present = false
    panel:
      gates   ✓ taste   ✓ claudemd   ✓ polish
      ◆ verdict  clean · grade A · 0 findings

`buildReport` was correctly suppressed. The UNSUPPRESSED `chainBuildReport` was still handed
to `assemblePanelModel`, which copies `report.verdict` and `report.overallGrade`, and
`panel-renderer` printed them. The markdown surface said "inconclusive" while the panel said
grade A with three green gates.

The previous suite passed because layer 3c asserted `!res.buildReport` and **never once
inspected `res.panel`**. That is the whole lesson of this repair: suppressing a value at one
consumer is not suppressing the value.

## What was fixed

**1. CRITICAL - the panel leaked a grade for an unrendered audit.**
`sidecoach-orchestrator.ts` chain return now passes
`report: unrenderedAuditTarget ? undefined : chainBuildReport` into `assemblePanelModel`.
Why that over omitting the panel: with no report, `assemblePanelModel` already sets
`partial=true`, drops verdict/grade/findings, and renders gates as PENDING - an honest reading
of a run that measured nothing - while the route and chain context a reader needs survive.
After: the verdict line is gone and gates render as `· taste · claudemd · polish`.

**2. CRITICAL - only the `audit` verb rendered; the other 19 returned a confident constant.**
Chose **Codex option C of three**: rendering stays owned by `audit`, and the unscanned-target
suppression is GENERALIZED to all 20 verbs. Rejected option A (route critique/polish/harden/
optimize into the rendered path) because that path is an early return that bypasses the verb's
flow chain - `/sidecoach polish page.html` would stop emitting tactical-polish guidance
entirely and return raw a11y findings, trading a safety defect for a capability regression, and
repeating the exact over-capture mistake a previous Codex review already caught on this unit.
Rejected option B (render-and-chain, attaching rendered evidence alongside the verb's guidance)
as the right eventual shape but a larger result-model change than a repair carries.
New `isPageShapedTarget` is the safety/regression boundary: true for a renderable page/URL/
directory-with-index, a real file that is not a renderable document, a real directory with no
entry document, and a path naming a missing `.html`/`.htm`/`.xhtml`; false for anything that
does not exist and does not name a document, which is what keeps `/sidecoach craft a login
page` untouched. Fails closed with a next step, not an error wall - the notice names
`/sidecoach audit <target>` as the command that does scan.

**3. HIGH - `rendered:false` was not persisted, so a no-page audit satisfied later prerequisites.**
Added `rendered?: boolean` to `FlowHistoryEntry`, threaded through `recordFlowWithMemory`, and
taught `FlowPrerequisiteValidator.canExecute` to exclude an entry that records it. Three-state
on purpose: only an explicit `false` disqualifies, `undefined` keeps its existing meaning, so
no legacy on-disk history and no non-audit flow changes behaviour. Scoped by `PAGE_SCANNING_FLOWS`
to `flowK_multi_lens_audit` alone - marking the whole chain would have invalidated prerequisites
that never claimed to render anything. The refusal now says the prerequisite "ran but RENDERED
NOTHING" instead of the misleading "has not been executed".

**4. HIGH - the self-check leak was still open on both human surfaces.**
`bin/sidecoach-present.js` pushed every `validationResult` into its gates row unfiltered;
`bin/sidecoach-monitor.js --json` spread the raw result including
`failedRules: ['has_optimization_guidance']`. Added a shared `measuresArtifact` predicate plus
an exported `stripFlowOutputSelfChecks` sanitizer, applied to the gates row and to `--json`.

**5. MEDIUM - the acceptance test passed vacuously without Chromium.**
The old summary printed `${passed}/${passed} passed`, a ratio that is 100% BY CONSTRUCTION and
cannot express a shortfall. Browser-dependent assertions now run through `bcheck`, the total is
DECLARED (`BROWSER_ASSERTION_COUNT = 34`), each skipped group is named, and `run()` reconciles
ran + skipped against the declared total and fails loudly on drift. A browserless run now
prints `0/34 ran, 34 SKIPPED` and a DEGRADED banner stating it is NOT proof the render path
works. `SIDECOACH_REQUIRE_BROWSER=1` makes a skip fatal (verified: exit 1).
Also found while fixing this: `brokenImageShapes` had NO browser guard at all and would have
hard-failed on a browserless machine; it now stands down with the rest.

**6. MEDIUM - the non-vacuity guard checked PRESENCE, not SUCCESS.**
Tightened to `flowI?.status === 'success'`, which immediately proved the point: under an
isolated HOME - exactly what `npm test` uses - flowI is recorded as
`error: prerequisites not met (flowG_component_implementation)`, so the whole
constant-absence layer had been passing for the wrong reason on CI and for the right reason
only on a developer machine with warm history. Detecting the vacuity was not enough, so the
layer now SEEDS flowG into history and flowI genuinely executes in every environment.

**7. The `measures` discriminator was unsafe in BOTH directions.**
`createDomainValidator` defaulted `measures` to `'flow-output'` (so a factory-built validator
that forgot the flag was silently suppressed - a false negative) while hand-built
ValidationResults left it undefined and the aggregator suppressed only on an explicit
`'flow-output'` (so those reported). What a validator "that sets nothing" got depended entirely
on how it was constructed. Made safe in ONE direction per Codex: **unspecified means
flow-output**, and the aggregator is now an ALLOWLIST on an explicit `'artifact'`. To keep the
narrow path open, the five validators that really do scan the user's work now declare
`measures: 'artifact'` at their source: claudemd-mandate, polish-standard, taste, anti-patterns
(absolute-ban), copy (linguistic-ban). `userFacingValidationFailures` follows the same
allowlist. One pre-existing assertion was DELIBERATELY INVERTED and the reversal documented in
place, because it encoded the old unsafe behaviour.

## Codex re-reviewed the diff and found five MORE defects. All folded.

The adversarial pass on the finished diff (wrapper exit 0, 251.5s) did not rubber-stamp it:

- **HIGH, and the same defect class one surface further out.** `bin/sidecoach-present.js` did
  `report.verdict || 'clean'` and its no-findings branch printed "Checks passed. 0 findings."
  So EVERY path that deliberately withholds a BuildReport still reached the human as a pass -
  including `/sidecoach document index.html`, which is handled BEFORE the target guard and so
  was never covered by items 1 or 2 at all. Verified live: it now prints INCONCLUSIVE. I had
  fixed the panel and the report and left the executive report saying the opposite.
- **HIGH: query strings.** The extension test ran against the raw target, so
  `/sidecoach critique index.html?v=2` resolved as a missing bare path and fell through to a
  confident chain grade. Now stripped of `?query` and `#fragment` before the test.
- **MEDIUM: over-capture.** My first predicate captured every existing non-document file and
  every entry-less directory, which turned `/sidecoach extract Button.tsx` into "NO PAGE WAS
  RENDERED, run audit instead" - nonsense for a verb whose real subject IS a filename, and the
  same over-capture mistake this unit was repairing. Narrowed to: renderable, or names an
  html/htm/xhtml document.
- **MEDIUM: my flowN assertion was VACUOUS** - `a === false || b === true` where `b` is always
  true. It also revealed the brief was wrong: flowN is not gated on flowK at all, because it
  declares optional prerequisites with no `minSuccessfulPrerequisites` and canExecute only
  evaluates optional ones when a minimum exists. Replaced with the fact, asserted both ways
  plus a guard that fires if flowN ever gains a gate. **flowL is gated; flowN never was.**
- **MEDIUM: claudemd-mandate labelled 'artifact' while reading flow output.** Kept, with the
  reasoning written at the source: the distinction is what a rule ASKS, not which field it
  reads. `has_optimization_guidance` asks "does my own guidance mention the word optimize" - a
  tautology. The mandates ask "does the deliverable contain a self-credit line or a fabricated
  icon" - real, varying, actionable content defects. Suppressing those would be far worse than
  the defect being fixed.
- Plus: stale comments in `flow-composition.ts` that documented the exact opposite of the new
  rule, a panel that omitted the verdict but still rendered every phase `[done]` so a clean read
  stayed INFERABLE (now prints the notice outright), and two test-honesty defects - a skip that
  reported ALL groups whenever any group skipped, and a contrast-case skip that blamed "Chromium
  could not launch" for any failure whatsoever.

## Codex reviewed AGAIN and found four more. Also folded.

The second adversarial pass (wrapper exit 0, 248.4s) confirmed the five folds and agreed with
keeping claudemd-mandate as `artifact`. It then found four more, two of which I reproduced live
before fixing:

- **MEDIUM `.shtml`.** I had reused the RENDERER's extension list for the page-shaped predicate,
  assuming they were the same list. They are not: the predicate answers "is the user talking
  about a page?", which is a wider question than "can we render it?". Verified live before the
  fix - `/sidecoach critique page.shtml` returned `buildReport=true` and the executive report
  said "Checks passed". Now a separate, deliberately wider `PAGE_SHAPED_EXT_RE`.
- **MEDIUM the panel notice is chain-path-only.** True. It is safe only because the other
  unmeasured paths emit NO PANEL AT ALL, and "safe by accident of which path happens to build a
  panel" is precisely the reasoning that let the original defect ship. Replaced the accident with
  a stated invariant over seven unmeasured shapes: either there is no panel, or the panel says
  nothing was rendered - never a panel that quietly omits the verdict.
- **LOW my INCONCLUSIVE branch was too broad.** Keying on a missing buildReport alone also swept
  up `/sidecoach list` and `/sidecoach help`, which execute no flows and claim nothing about a
  page; verified live that both had started rendering as "INCONCLUSIVE - no page was rendered".
  Safer than "clean", still the wrong sentence. Now scoped to runs that actually executed a flow.
- **LOW the chain layer was still HALF vacuous.** Seeding flowG let flowI run, but the
  `/sidecoach audit` chain is flowK then flowI, and flowK requires flowJ - so flowK never
  succeeded and the live-chain assertions about the `has_optimization_guidance` leak proved
  nothing about the flow the validator actually attaches to. Now seeds flowJ as well and asserts
  flowK succeeded.

## Codex round 3: one more, and it made me delete my own fix

The third pass confirmed the answer to the question that matters - **"I found no remaining path
where a verdict, letter grade, finding count, or `Checks passed` reaches a human for a page that
was not rendered."** It found one Medium: `executedFlows > 0 && !result.buildReport` now
mislabelled `/sidecoach document` and `/sidecoach teach`, which run a handler and legitimately
produce no report, as "INCONCLUSIVE".

That was the THIRD version of the same condition, and the third instance of one mistake:
**inferring "did we measure a page?" from the ABSENCE of something.** `!buildReport` swept up
list/help; adding `executedFlows > 0` swept up document/teach. Each fix moved the boundary
instead of removing the guess.

So I deleted the branch entirely and moved the fact upstream. Every path handed a page-shaped
target now attaches an `audit` block with `rendered: false` - including the two setup commands
that return before the target guard, which is what actually closed the original
`/sidecoach document index.html` hole. `renderExecutiveReport` already routes anything carrying
`result.audit` to `auditExecutive`, which has always reported inconclusive correctly. The
heuristic in `buildExecutive` became dead code and is gone; a comment records why no test
belongs there. Verified live: `document index.html`, `teach index.html` and `critique page.shtml`
all print "Audit: inconclusive. The page could not be certified", while `list`, `help` and a bare
`document` are untouched.

**The lesson, stated plainly: absence is not a signal.** Three consecutive fixes tried to read
meaning out of a missing field and each one over-captured. The correct move was to make the
producer state the fact explicitly and let the consumer read it.

## Mutation controls: 17 mutations, 17 caught, and two harness lies found

`sidecoach/mutation-check.sh` (exit 3 anchor missing / 4 not caught / 5 revert failed). Every
mutation verifies its ANCHOR EXISTS before applying, and reverts byte-identically after.

The harness lied to me twice before it told the truth, and both lies are worth recording because
they are the two ways a mutation proof can be worthless:

1. **A FAKE CATCH.** The "non-audit verbs are captured" mutation wrapped the condition in
   `false &&`, which destroyed TypeScript's narrowing of `commandMatch.command` and killed the
   suite with a TS2345 COMPILE error. Reported as caught while **no assertion had run at all**.
   Rewritten to compile, and the harness now fails any mutation whose log contains a TS error.
2. **A FALSE "NOT CAUGHT".** Removing the flowJ seed changed nothing, because the harness
   inherited my warm `~/.claude/sidecoach-flow-history.json` where flowK's prerequisite was
   already satisfied from earlier runs. The assertion was real; the ENVIRONMENT was richer than
   CI's. Confirmed by hand: with the seed removed under a cold HOME the assertion fails
   (`status=error`), with it present it passes. The harness now runs every mutation under an
   isolated HOME with the real Playwright cache pinned, exactly as `scripts/run-tests.ts` does.

A mutation harness that runs in a richer environment than CI produces false negatives, which is
the same class of lie as a vacuous assertion - and it is the third time in this one unit that
warm local history hid a defect that CI would have caught.

A third NOT CAUGHT was also real and worth keeping: removing the empty-target guard in
`unscannedTargetForEarlyCommand` changed nothing, because with no target the resolver falls back
to the PROJECT ROOT, and this repo's root has no index.html - so the narrowed predicate returned
false anyway. In a project whose root DOES have one, a bare `/sidecoach document` would have been
captured as "you named a page and we did not scan it". The guard was load-bearing; the fixture
was not. Now asserted against `fixtures/flow-target-render/site-with-index` as the project root,
which is the layout that actually exercises it.

## A defect in my own test that no assertion could have caught

After the last Codex pass I ran `git status` and found two untracked `DESIGN.md` files - one in
`sidecoach/`, one inside a committed fixture directory. My new coverage drove `/sidecoach
document` and `/sidecoach teach` against `REPO` and against the fixture root, and those are real
AUTHORING commands: they WRITE DESIGN.md into whatever project root they are given. The suite was
mutating the repository it was testing, and it would have done so on every future run.

No assertion would ever have caught this, because the test was green the whole time. It surfaced
only from looking at the working tree afterwards. Both files are deleted and every authoring
invocation now runs against `fs.mkdtempSync` scratch roots that are removed in a `finally`.
Verified by diffing `git status` before and after a full run: no files created.

Worth keeping as a rule: **a green suite is not evidence that a suite is side-effect free.**
Check `git status` after running tests that drive real commands.

## Final numbers

- `npm test`: **170 suites, exit 0** (baseline preserved exactly).
- `flow-target-render`: **320 assertions**, up from 132. Browser layer 34/34.
- **17 mutation controls, 17 caught** by the specific assertion guarding each fix, run under an
  isolated HOME, each with anchor-existence verified first and compile failures rejected.
- Three Codex reviews (wrapper exit 0 at 53.8s, 22.3s, 251.5s, 248.4s, 108.6s), **10 findings
  across rounds 2 and 3, all folded.**

## The BuildReport golden was re-captured, deliberately

`eval/migration-harness/buildreport-snapshot.mjs verify` was the one red suite. Item 7 is a
real behavioural change and the golden's hand-authored fixtures predate the `measures` field, so
they were all undeclared and had been reporting. I labelled the fixture to mirror the REAL
validators (taste -> artifact, accessibility/performance -> flow-output) rather than just
re-capturing, because an unlabelled re-capture would have reduced the golden to "everything is
suppressed" and stopped it exercising the validationResults path at all. The change: the two
self-check domains drop their grades and 2 blocking findings; verdict stays `blocked`, grade
stays `F`, and the artifact/metric paths still carry it.

## Correction to the record (the lead flagged this, and it is right)

The previous beat's claim 3 said grades derive from findings. They do not.
`build-report-aggregator.ts:312-313` computes `domainGrades` from `flowResults` and the overall
grade from those; the findings array feeds severity counts and the verdict. Recorded here so
the wrong mechanism is not repeated.

## Not fixed, deliberately

Directory resolution picks `index.html`/`index.htm` only. Codex called this NOT a blocker: it
is fail-CLOSED, so it is a usability mismatch with `sidecoach-detect`, not a safety hole.
Documented rather than changed.

## Self-analysis (why the previous unit shipped a false headline)

The failure mode was **asserting the fix at the site of the fix**. The previous unit suppressed
`buildReport`, then wrote an assertion about `buildReport`. It never asked the different
question - "what does a human actually SEE?" - so the panel, which is the surface a human reads
first, went uninspected. The same shape produced items 4 and 5: suppression was applied to one
consumer and declared complete, and the acceptance ratio was computed in a form that could only
ever be 100%. The generalizable rule: an assertion written against the thing you just changed
tests your intent, not your effect. Assert against the OUTPUT SURFACE, and make every ratio
capable of reporting a shortfall.

## Files touched

- `sidecoach/src/sidecoach-orchestrator.ts` - panel suppression, all-verb unscanned-target
  capture, `isPageShapedTarget` + `unscannedPageTarget` + `UnscannedTarget`, `PAGE_SCANNING_FLOWS`,
  `recordFlowWithMemory(result, rendered)`, `userFacingValidationFailures` allowlist
- `sidecoach/src/flow-history.ts` - `rendered?: boolean` on `FlowHistoryEntry`
- `sidecoach/src/flow-prerequisites.ts` - `canExecute` excludes explicit `rendered:false`
- `sidecoach/src/build-report-aggregator.ts` - allowlist on `measures === 'artifact'` (both sites)
- `sidecoach/src/flow-composition.ts` - factory default reconciled with the consumer
- `sidecoach/src/clausemd-mandate-validator.ts`, `polish-standard-validator.ts`,
  `taste-validator.ts`, `absolute-ban-detector.ts`, `linguistic-ban-validator.ts` - declare
  `measures: 'artifact'`
- `sidecoach/bin/sidecoach-present.js` - `measuresArtifact`, `stripFlowOutputSelfChecks`, gates filter
- `sidecoach/bin/sidecoach-monitor.js` - `--json` sanitized
- `sidecoach/src/panel-model.ts`, `panel-renderer.ts` - optional `notice`, printed above the card
- `sidecoach/eval/migration-harness/buildreport-snapshot.mjs` + `golden/buildreport/report.json` -
  fixture labelled with explicit `measures`, golden re-captured
- `sidecoach/src/__tests__/flow-target-render.test.ts` - 7 new layers, browser accounting,
  seeded non-vacuity guard, temp-root isolation, one deliberately inverted assertion
- `sidecoach/mutation-check.sh` (NEW) - the 17 mutation controls, exit 3 anchor missing /
  4 not caught / 5 revert failed

## Open items for whoever picks this up

- **flowN is ungated.** It declares flowK/flowL as optional prerequisites with no
  `minSuccessfulPrerequisites`, so it runs regardless. That is now asserted as fact with a guard
  that fires if it ever changes, but if flowN is SUPPOSED to require one of them, that is a
  separate fix in the dependency map.
- **`sprint7-buildreport-includes-unstructured.test.ts` is order-dependent** through the shared
  HOME-scoped flow-history file. It passes in a full run because earlier suites warm the history,
  and fails standalone under a fresh HOME - both before and after this unit, so it is
  pre-existing, not a regression. It deserves the same seeding treatment applied here.
- **Directory resolution still picks `index.html`/`index.htm` only.** Codex confirmed this is
  fail-CLOSED, so it is a usability mismatch with `sidecoach-detect`, not a safety hole. Left as
  documented behaviour per the brief.
