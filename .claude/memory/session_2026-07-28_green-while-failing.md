---
name: The test runner that reported green while suites printed their own failures
description: sidecoach/scripts/run-tests.ts counted a suite as passed whenever the child exited 0, so four suites that tally a failure, print it, and exit 0 were counted green for as long as they have existed; runner fixed with a default-deny self-reported-verdict scan, and the four suites root-caused (none is the predicted cold-flow-history cause)
type: project
relates_to: [session_2026-07-28_vacuous-assertion-sweep.md, session_2026-07-28_codex-repairs-tests.md]
author_human: Jonah
author_model: claude-opus-5
machine: Jonahs-MacBook-Pro
source: session
verified: tests / codex-review
confidence: high
---

The gate that could not report the failure it had just printed.

## What was wrong

`sidecoach/scripts/run-tests.ts` counted a suite as FAILED only when its child process
exited non-zero. Many suites in this repo are plain scripts: they tally their own results,
print `Status: FAILED`, and then fall off the end of the file, which exits 0. The runner
counted every one of those as a pass.

Measured on the unmodified runner at HEAD 363458ea, one full `npm test`:

- runner verdict: `run-tests: 171 suite(s) passed`, exit 0
- inside that same transcript: `Total: 16/20 tests passing`, `Status: FAILED`,
  `Results: 8/9 tests passing`, `Status: FAILED`, and seven `Result: FAIL` lines

Why this mattered more than the suites it hid: every sidecoach verification today,
across several agents, was reported as "npm test, 171 suites passed, exit 0". For these
four suites that number was hollow, and had been since they were written. The 2026-07-26
orphan-test triage that gated 52 suites recorded that it "ran green twice"; that green
came through this defect, which is why two suites that have never once passed were
admitted to the gate as healthy.

## The mechanism chosen, and why not the obvious ones

Exit code alone is insufficient. A raw `grep -i fail` over child output is worse - it
manufactures reds, and a gate that cries wolf gets ignored, which lands you back at a
false green by a longer road. The runner now captures each child's combined output and
scans it for SELF-REPORTED VERDICT lines, default-deny, with a per-suite exact-line
allowlist for suites that legitimately print a failure-shaped line while passing.

Three constraints keep the vocabulary honest:

- **Anchored.** A marker must open the line. A failure word inside prose, a filename, or
  an assertion label is not a verdict.
- **Uppercase FAIL token, with an explicit terminator lookahead** rather than `\b`. `\b`
  matches between `L` and `-`, so `FAIL\b` fires on FAIL-CLOSED, a phrase this repo's
  PASSING suites use constantly.
- **Tally lines must be self-describing and labelled.** `Total: 16/20 tests passing`
  counts. A bare `1 passed, 2 failed` does not, because that is what phase-h-block4 prints
  as the explanatory detail of a GREEN assertion about partial-status aggregation.

Why: the whole risk of this change was replacing a false green with a false red. The
vocabulary was therefore derived from a full 171-suite transcript rather than invented -
across that entire baseline it flags exactly the genuine failures and nothing else.

How: `spawnSync` with a file-backed fd for stdout and stderr (not a pipe - `maxBuffer`
would silently truncate a chatty suite, and a truncated transcript is exactly how a
verdict line goes missing), then the captured text is echoed and scanned. Allowlist
reconciliation is an exact-text multiset in both directions: an undeclared hit fails the
suite, and a declared line that never appeared also fails it, so an allowance cannot rot
into a permanently open hole. New exit code 3 for runner-internal spawn failure, so it
cannot read as a test verdict.

## Verification

Before/after, on the verbatim HEAD runner (generated from `git show`, only the SUITES
literal replaced, single diff hunk) versus the fixed one:

16 probe suites, every one of which exits 0 unless stated. Anchors were confirmed first by
running each fixture standalone and reading the bytes it actually emits, so a control could
not report a result for the wrong reason.

MUST GO RED (9):

| case | HEAD runner | fixed runner |
|---|---|---|
| prints `Status: FAILED` | `2 suite(s) passed`, exit 0 | RED, exit 1, offending lines named |
| the same suite with its allowlist removed | passed | RED (the allowance is load-bearing) |
| allowlist entry that never appears | passed | RED (stale allowance) |
| `Results: 9 passed, 1 failed out of 10 tests` | passed | RED |
| `TEST RESULTS 9 passed, 1 failed` (no colon) | passed | RED |
| `[FAIL] critical invariant was broken` | passed | RED |
| `checkout-flow: FAIL!` | passed | RED |
| `my-suite-name FAIL` | passed | RED |
| colour-wrapped `Status: FAILED` (plain + colon SGR) | passed | RED |
| fails only its FIRST run per fresh state | passed | RED (verdicts are never retried) |

MUST STAY GREEN (7) - the false-red side, which is the half that decides whether anyone
keeps trusting the gate:

| case | fixed runner |
|---|---|
| passes, output demos a negative case, allowlisted | GREEN |
| prints `FAIL-CLOSED: inconclusive render refused as clean` | GREEN |
| prints bare `  1 passed, 2 failed` as a green assertion's detail | GREEN |
| prints `Expected: 1 passed, 2 failed` | GREEN |
| prose ending "...did not FAIL." | GREEN |
| prose ending "should FAIL!" / "intentionally FAIL?" | GREEN |
| non-zero exit, NO verdict, passes on retry | GREEN (the flake retry still works) |

Across the whole matrix the only retry that ever fired was the genuine silent-flake case.
The ANSI strip was additionally mutation-controlled: removing it (anchor asserted present
first) drops the colour-wrapped probe from RED to GREEN, so the strip is load-bearing
rather than incidentally redundant.

Every probe's anchor was confirmed first by running the fixture standalone and reading
what it actually emits, so a control could not report a result for the wrong reason. The
only retry that fired across the whole matrix was the genuine silent-flake case.

**Accepted residuals, named rather than papered over.** A suite that fails and prints
nothing recognisable is still invisible - bounded by the fact that such a suite also proves
nothing to a human reading the log. And a HEALTHY suite whose fixture output happens to be
a real verdict line (`Summary: 1 passed, 2 failed` as sample data) will be flagged until it
declares that line in `allowFailureLines`. That is the escape hatch working as designed, not
a defect: nothing can separate a verdict from an identical-looking fixture line without a
per-suite declaration, and removing the pattern to avoid it would reopen the false green.

## Sweep

`run-tests.ts --audit` was added and run over the full suite list. Four suites print a
failure verdict and exit 0. Two were known; two were not:

- `phase-h-block7-flow-validator-integration.test.ts` (16/20)
- `phase-i-block3-context-tracking-e2e.test.ts` (8/9)
- `slash-command.test.ts` (6 of its tests print `Result: FAIL`) - NEW
- `task8-list-command-taxonomy.test.ts` (1 test, all sub-checks NO) - NEW

## Root causes - NOT the predicted one

The dispatch expected cold flow-history (a prerequisite recorded as
`error - prerequisites not met` so a monkey-patched handler never runs). That is not the
cause of any of the four, and it was ruled out by MEASUREMENT rather than by argument: with
a HOME seeded with successful flowJ / flowG / flowF / flowI / flowK / flowA / flowE records,
both named suites fail identically to a cold fresh HOME - block7 at 16/20, block3 at 8/9. A
separate probe confirms `engine.process('unknown flow xyz')` returns `flowResults: []` under
warm history exactly as it does under cold, which is the specific thing block3's failing
assertion depends on.

**phase-h-block7** imports only `flow-domain-validators` and `flow-composition`; it never
touches flow history, an orchestrator, or a HOME-scoped store. It and the product it tests
landed in the SAME commit (a2a1ca82) and neither file has been touched since, so the
current content is the birth content: this suite has never passed. Its four failures:

1. asserts `complete_qa_workflow.domains.length === 4`; the product ships 5. The suite's
   own later test asserts `>= 4` and passes with 5.
2. expects the accessibility validator to return `pass` from a fixture with `checklist: []`,
   but one of that validator's three rules requires checklist items, so 1-of-3 failing is
   `partial` by design.
3. same shape for design_system: the fixture supplies neither rationale wording nor
   artifacts, so 2 of 3 rules fail and the result is `partial`.
4. expects `fail` from the content-quality validator on AI-slop input. The slop rule DID
   fire; `fail` requires ALL rules to fail, and `has_meaningful_content` passed, so the
   result is `partial`.

The `pass / partial / fail` aggregation those four disagree with is pinned by three
separate GREEN gated suites (phase-h-block4, block5, block6). The product side is
corroborated; block7 is the only file that dissents.

**phase-i-block3** test 4 calls `engine.process('unknown flow xyz')` and then asserts
`flowResults.some(r => r.status === 'error' && r.executionMetadata)`. Measured directly:
that call returns `flowResults: []`. An unrecognized utterance never resolves to a flow, so
there is no flow result of any status to carry metadata, and `.some()` on an empty array is
false unconditionally. The product does attach `executionMetadata` on the error path where a
DETECTED flow throws (sidecoach-orchestrator.ts:548); this test's input cannot reach it.

**slash-command** pins flowIds counts (implement 7, review 10, clone 2, migrate 2,
refactor 2) against a registry the routing consolidation reshaped (implement 4, review 5,
clone 1, migrate 1, refactor 1). **task8** pins the legacy phase-grouped `/sidecoach list`
output; the current gated contract (`sprint8-list-and-help.test.ts`, green) asserts a
looser heading plus verb commands. Both sit in the 21 routing tests the 2026-07-26 triage
recorded as "reconciled against the landed refactor" - they were not reconciled, and the
triage's green came through this runner defect.

## The repairs, after the rule was sharpened

The escalation below was answered: "do not change a suite's assertions to make it pass" means
do not WEAKEN a check to get green. Correcting a test that pins a contract the product never
had is repair. All four suites were then fixed under that rule, in three classes.

**Class 1, stale expectations corrected (9).** Each cites, at the assertion, the source
definition and the green gated suite that pins the true contract, so a future reader can see
why a number changed without re-deriving this investigation. block7's complete-QA domain count
4 -> 5; block7's content-quality `fail` -> `partial` PLUS a new assertion that
`avoids_generic_content` is in `failedRules`, which is a stronger check than the original
because it survives a relabelling of the aggregate; six slash-command flow counts against
`PHASE_ALIASES`; task8's retarget.

**Class 2, fixtures completed rather than assertions weakened (2).** block7's accessibility and
design-system cases both demanded `pass` from inputs that could only ever produce `partial` -
an accessibility fixture with `checklist: []` is not testing accessibility validation, it is
testing what happens when you supply nothing. The assertions are UNCHANGED; the inputs now
satisfy the rules the validators actually have.

**Class 3, an input replaced because the assertion was unreachable (1).** block3's error-path
test fed `unknown flow xyz`, which returns `flowResults: []`, so the assertion could not pass
OR fail - vacuous coverage by a different route. It now injects a throwing handler into a flow
that genuinely resolves, exercising the real `executionMetadata` attachment at
sidecoach-orchestrator.ts:1774, with two non-vacuity guards: fail if the handler is not there
to patch, and require the error result to carry the injected marker so an unrelated failure
cannot satisfy it.

**Four further defects found while inside these files, all the same class.**

1. `slash-command`'s summary array held the parsed RESULT OBJECTS, which are always truthy. It
   printed `Results: 15 passed, 0 failed out of 15 tests` and `Success rate: 100.0%` in the very
   run where six of its cases printed `Result: FAIL`. It could not compute its own failure, let
   alone report it. Now collects real per-case booleans.
2. block7's block-print ranges were off by one from index 7, so result 19 was NEVER PRINTED -
   the suite displayed 19 of its 20 results while its total line correctly said /20.
3. block3's duration check read `executionMetadata?.executionDuration !== null`. Optional
   chaining yields `undefined` when metadata is absent, and `undefined !== null` is TRUE, so it
   passed for every result with NO metadata at all - the exact opposite of its claim.
4. block3's metadata-structure block pushed NOTHING when `flowResults` was empty, silently
   shrinking its own denominator: two assertions quietly stopped existing rather than failing.

Two suites (block7, slash-command) still exited 0 regardless of verdict; all four now set their
exit code from their own tally, so they are honest standalone rather than depending on the
runner's transcript scan.

## The honest number

`npm test` now reports `run-tests: 171 suite(s) passed`, exit 0.

That is the same count the LYING gate printed, and the coincidence is worth stating plainly
rather than glossing: the old runner said 171-passed because it could not see four failures,
and the new runner says 171-passed because there are none. What separates the two claims is
that the same runner, on the same code, reported `4 suite(s) failed` with each offending line
named BEFORE these repairs and reports green after them. A gate that produced red, then green
once the red was fixed, has demonstrated it discriminates. The earlier number never did.

Nothing new surfaced once the four stopped masking - no suite that had been hiding behind them
came into view.

## Verification of the repairs

12 mutations, each with its anchor asserted present before the result was believed. 11 CAUGHT.

The one NOT CAUGHT is the useful entry. M10 stripped `executionMetadata` from the
natural-language success path to test block3's duration assertion, and the suite stayed green -
because `.some()` scans ALL flowResults and other code paths still attach metadata, so the
mutation never removed the subject. Re-aimed as M10b at `getExecutionDuration` returning
`undefined`, it was CAUGHT. That is also the precise case the OLD `!== null` form would have
passed, which is what proves the fix discriminates rather than merely coexisting with a green
run. A mutation that misses its subject reports a false CAUGHT; this one reported a false NOT
CAUGHT, and treating it as a signal rather than noise is what located the real control.

## Escalated, not improvised

The dispatch said "do NOT change a suite's assertions to make it pass; if a suite fails
because the product is wrong, report that instead". In all four suites the product is not
wrong - the expectations are - so every available fix required editing expectations, which
the instruction appeared to forbid, and the fix that was envisioned (seed prerequisites, touch
no assertions) applied to none of them. Rather than edit around the rule, the work stopped and
handed back the per-assertion evidence.

Worth keeping as a pattern: the escalation was the productive move, not a delay. The ruling
that came back sharpened the rule itself ("weakening a check is laundering; correcting a test
that pins a contract the product never had is repair") and that distinction is what made all
twelve fixes safe to make. Improvising past the rule would have produced the same diffs with
none of the justification, and the two Class-2 cases would very likely have been "fixed" by
asserting `partial` - the laundering option - because it is the smaller edit.

## Self-analysis

Two process failures worth recording, both the same failure mode.

A `cd` to the repo root inside a compound command silently changed the working directory
for every later command, and a typecheck then ran from the wrong place and resolved a decoy
`tsc` through npx instead of the project's. It happened TWICE - the second time after a
`git diff | codex-review` call that also had to run from the repo root. Both were caught
because the wrong-directory command errored loudly, but the same slip with a slightly
different command would have produced a confident "TSC OK" that proved nothing. That is
exactly the trap the dispatch named: an absent result is not a negative result. Why it
happened: the shell's working directory persists across calls, and a `cd` written for one
command's convenience silently re-homes all the ones after it. Fix applied: verification
commands now carry their own explicit `cd` and print `pwd`, and binaries are invoked from
the project's `node_modules/.bin` rather than through npx name resolution, which is what
made a wrong-directory typecheck able to look like a passing one.

A third, more serious one, caught only by reading raw bytes. A scripted edit meant to
replace a literal ESC byte in the ANSI-strip regex with an explicit `\x1b` escape
over-escaped it into `/\\x1b\\[.../`, which matches a literal backslash rather than an
escape character - silently turning the ANSI strip AND the `\r` strip into no-ops. It
typechecked cleanly and would have passed any test that did not specifically emit colour.
It was found by dumping the line with `od -c` rather than trusting the editor's rendering,
which is also how the ESC byte's presence was confirmed in the first place. The lesson is
narrow and reusable: for any code whose correctness depends on specific bytes (escapes,
control characters, whitespace), verify with a byte dump, and mutation-control the line so
its absence is observable.

## Codex review

Six wrapper passes total, ALL exit 0 (no 3/4/5, no splitting needed): four on the runner diff
and two on the suite-repair diff. Seventeen findings, all folded.

The two suite-repair passes caught, among other things, that task8's non-vacuity guard was too
weak (a list rendering ONE described verb would still have passed, so it now compares the
rendered set against `getVerbList()` and names any missing verb); that two suites still exited
0 regardless of verdict; that a comment cited a table name (`COMMAND_REGISTRY`) that does not
exist - the table is `PHASE_ALIASES`, and a wrong citation is worse than none when the whole
point of the requirement is that a reader can verify without re-deriving; and the three
"passes for the wrong reason" defects listed above in items 3 and 4 plus two weak `>= N` domain
checks that could pass while a domain went missing.

Four wrapper passes on the runner diff, eleven findings. Each fold has a dedicated probe in the
control matrix above.

Pass 1 (five): the `N passed, M failed` summary shape was invisible to the vocabulary
(would still have read green); `FAIL\b` manufactured a red on FAIL-CLOSED prose; the
retry-once path would launder a first-run-only failure into a green; the allowlist comment
overclaimed a guarantee exact-text reconciliation does not provide; `--audit` could itself
exit 0 over a hard-failing child.

Pass 2 (three): the retry gate was keyed on reconciled problems rather than raw hits, which
`--audit` empties - so the audit path would have retried a self-reported failure and
recorded only the clean second attempt; the pass/fail tally's "any word plus a colon" label
rule both false-redded `Expected: 1 passed, 2 failed` and missed the unpunctuated
`TEST RESULTS 9 passed, 1 failed`; and the `[FAIL] <case>` bracketed shape was uncovered
even though `[PASS]` appears 17 times in a baseline transcript.

Pass 3 (one): `trailing-fail` had not been given the shared FAIL terminator, so
`checkout-flow: FAIL!` was still a false green.

Pass 4 (two): the pass-3 fix for that had over-corrected into a NEW false red - allowing
`!`/`?` after any whitespace separator also matches the English sentences
`negative case should FAIL!` and `does this intentionally FAIL?`. Split into two branches so
punctuation is accepted only after a colon, because a colon is a label and a label is what
separates a verdict from a sentence. Also colon-parameter SGR (`\x1b[38:2::255:0:0m`) was
not stripped and would have left residue in front of the anchor.

Worth recording: every one of the eleven was a hole in the SAME change that exists to close
holes, and pass 4's first finding was a hole created by pass 3's fix. A verdict scanner is a
piece of judgement about what counts as evidence, and that judgement was wrong eleven times
in ways that each individually would have restored a false green or manufactured a false red.
That is the argument for the review gate existing at all, and for the false-red half of the
control matrix being as large as the false-green half.

## Files touched

- `sidecoach/scripts/run-tests.ts` - verdict scan, file-backed capture, allowlist
  reconciliation, `--audit` and `--only` modes, exit code 3 for runner-internal failure
