---
name: Vacuous-assertion sweep across the three counted suites
description: Codex counted 59 vacuous rows across three suites; mutation measurement found 8, plus a real dead-hook defect the vacuous rows were hiding
type: project
relates_to: [session_2026-07-28_codex-vet-hooks-wave.md, session_2026-07-27_route-intent-live-efficacy.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: mutation-testing
confidence: high
---

Finished the sweep that was COUNTED by a Codex pass but only partly repaired. The
counts were the deliverable's first question, and they did not hold up.

## Counts: claimed vs measured

| Suite | Codex claimed | Measured vacuous | Method |
|---|---|---|---|
| test-route-intent.sh | 22 of 42 | **2 of 61** negative rows | per-mechanism mutation, 21 mutants |
| test-hook-data-parity.sh | 11 of 35 | **6 of 35** | deleted the real deploy code, row stayed green |
| test-settings-wire-parity.sh | 26 of 40 | see below | comment-satisfied allowlist greps |

Codex's route-intent number was high by an order of magnitude. Its denominator (42)
does not match any real row count in the file (61 negative rows, 121 rows total). Its
hook-data-parity number was in the right neighbourhood and pointed at the right
class. The lesson: a COUNTED population is a hypothesis, and the mutation is the
measurement. Reporting the count as fact would have been the same error the suites
themselves were committing.

## Why the route-intent number was so wrong

Codex's stated rule was "negative assertions written against matchers the OLD lexicon
never had - revert the change and they stay green." That describes a real class, but
reverting the lexicon is only ONE of the mutations a negative row can be measured
against. 50 of the 61 negative rows go red under a single-mechanism mutation of a
mechanism that currently ships (deliberation markers, nominal-subject guard, envelope
anchor, exempt list, the four scrubs, the deictic guard, the bounded identifier slot,
the imperative prefix, min-chars, the length bail). Only 2 could not be made to fail
by ANY mutation in a 21-mutant set.

## The method, and the two traps it had to survive

Both traps had already burned other agents today, so they were designed against
up front.

**Trap 1 - the mutant that resolves paths from its own location.** route-intent.sh
resolves its lexicon as `$(dirname $0)/route-intent.json`, and the suite resolves the
hook, the agent roster and install.sh the same way. A mutant dropped in a bare temp
dir finds no lexicon, exits 0 silently, and every negative row "passes" against a
subject that never ran. Mutants therefore live inside a COMPLETE repo copy
(`tar` of the working tree), and the run is refused unless the unmutated baseline
first reports 121/121 in that same copy.

**Trap 2 - the mutation that kills the subject.** The first sledgehammer DELETED the
four scrub lines. The first of them is the assignment `scrubbed = re.sub(..., prompt)`,
so deleting it left the next line referencing an undefined name; the hook's outer
`except` swallowed the NameError and exited 0. Every negative row went green and the
run read as "57 vacuous rows found". It was a corpse. Fixed two ways: the scrub
mutations now NEUTRALIZE the regex (`r"(?!x)x"`) instead of deleting the line, and
every mutant must pass a LIVENESS gate - a canonical prompt no mutation touches must
still route - before any result from it is believed. Every mutation also asserts its
own anchor exists and exits 9 if it changed nothing.

Cooldown was disabled (`ROUTE_INTENT_COOLDOWN=0`) with a UNIQUE cooldown file per
probe, so no probe could be silenced by state another probe wrote.

## test-route-intent.sh - 2 vacuous, both repaired

Both asserted silence that NOTHING produced: the prompts could not match their
matcher in any lexicon state, guards on or off.

- `deliberating about a breakdown does not route` - prompt said "do we need a
  breakdown of", but the matcher requires `give me|i need|i want|i'd like`. "we need"
  is in none of them. Rebuilt from the matcher's own tokens behind a deliberation.
- `a trailing deliberation clause does not route` - the scan matcher needs
  `for|folders|dirs|directories` after its object and the prompt supplied none;
  the breakdown matcher needs "i need", not a bare "need". Rebuilt on the scan
  matcher's conjunction branch.

Both now go RED when `suppress.deliberation_markers` is emptied.

**A second, larger finding: 11 rows carried FALSE mechanism labels.** The comment
above three of them claimed "silence here can only come from the pattern shape
itself". Measured: reverting refactor/redesign to the bare `\brefactor\b` form turns
only ONE of the three red. The other two carry a deliberation marker and are held by
the marker guard, not the shape. These rows can fail, so they are not vacuous, but a
reader would have taken them as evidence about the imperative shape and been wrong.
Every such row is now labelled with the mutation that actually turns it red
(BOUNDARY / WIDENING / DOUBLE), and one row was rewritten to isolate the mechanism it
names rather than be double-covered.

That audit also exposed a COVERAGE GAP: no row isolated the `refactor` imperative
shape at all (only `redesign` had one). Added
`shape: a bare refactor mention with no determiner does not route`.

Final state: 61 negative rows, 0 vacuous, 50 isolated by a single shipped mechanism,
10 double-covered and labelled as such, 1 labelled as a future-widening guard. All 26
positive rows die when every tier pattern is removed.

## test-hook-data-parity.sh - 6 vacuous, all repaired

The class the brief named: `grep -q "$name" install.sh` asks only whether a STRING
occurs anywhere in a 7000-line file. Every one of these six names also appears in a
DESCS UI paragraph and in prose comments.

Proof, not inference: deleting `route-intent.sh) echo "route-intent.json" ;;` from
`hook_data_files()` - the ONLY executable reference to route-intent.json in
install.sh - left `install.sh deploys route-intent.json` PASSing while the table row
two sections up correctly went red. Deleting route-intent.sh from the real
`cluster_hooks agent-routing` arm left 6 mentions behind, enough to keep the old grep
green.

Both halves now run executable code: companions execute the real `install_hook_data()`
into a sandbox and require the file to LAND; hooks are checked against the set the
installer actually deploys, built by EXECUTING `cluster_hooks()` over every arm and
scraping `install_app_hooks` lists from COMMENT-STRIPPED source. Both repairs
mutation-proved to go red under the exact deletions that previously left them green.

## test-settings-wire-parity.sh - 4 comment-satisfied rows, and a REAL DEAD HOOK

Section 2 validates the UNWIRED_BY_DESIGN allowlist, whose whole job is to stop a dead
hook hiding behind an exemption. Its header says plainly that "documentation describes
intent, it does not run anything" and that doc mentions must not count. The code did
not implement that rule: it was `grep -rl -- "$h"`, which matches comments.

Two of the four entries were justified by NOTHING BUT PROSE:
- `multiple-choice-enforce.sh` claimed to be "invoked by multiple-choice-detect-stop.sh".
  It is not. detect-stop carries a byte-identical INLINE copy of the detection block
  (its own comment: "keep the two copies byte-identical") and execs nothing. All three
  matches repo-wide are comments.
- `codex-review.py` is a CLI invoked by a human or an agent; the two hooks named as its
  reachers only mention it in a comment and in a guidance string.

Repaired with a declared reacher KIND per entry - `exec` (must appear in non-comment
executable source), `launchd` (named in a plist element, not an XML comment), `cli`
(not grep-provable by construction, accepted on its declaration and printed as the
weaker claim it is). Mutation-proved: turning the two real exec lines for
detect-session-model.sh into comments, leaving the name present, turns the row RED
where the old grep stayed green.

**REAL DEFECT, REPORTED NOT FIXED.** `multiple-choice-enforce.sh` is deployed by
install.sh (question-discipline cluster, line 1558), wired to nothing in
cluster-wirings.json, and exec'd by nothing. It is the exact deployed-and-inert shape
as question-enforcement.sh, which sat dead for two months behind this same kind of
unvalidated exemption. The suite now exits 1 and names it. Fixing it means editing
install.sh, which this unit does not own, and the brief forbids changing product
behaviour to make a test pass. Also added the inspected-hook count to each
per-selection line - the row-10 comment had promised that counting for a while and
nothing emitted it - and corrected a stale "all nine selections" note to the measured
21 selections deploying 1 to 9 hooks each.

## sprint7-buildreport order dependence - root-caused, not guessed

Reproduced first: standalone under a fresh HOME, T2's two real assertions failed.
Root cause measured rather than assumed - composite_qa_workflow is
flowK -> flowL -> flowM -> flowV, and step 1 flowK REQUIRES flowJ_tactical_polish. On
cold history the engine records flowK as `error - prerequisites not met` and never
calls its handler, which is precisely the handler T2 monkey-patches to inject the
violation. So findings came back empty and the grade stayed A.

Seeded flowJ and flowG the way flow-target-render.test.ts does, and added the
non-vacuity guard that suite uses: assert the patched step reached `success`, because
presence in flowResults is not execution. That guard immediately exposed a SECOND
vacuous row - T1's "grade is A (clean run)" passes even when the chain never runs.

Codex then found two real defects in my own repair, both folded: the `kind=exec` scan
was searching claude/agents, where markdown prose has no comment marker and would have
reopened the very hole it closes; and seeding once before T1 left T2 fed by T1's side
effects. T2 now gets its own HOME-scoped store via `resetFlowHistorySingleton()`,
which is safe because HISTORY_FILE is a lazy getter over $HOME and run-tests.ts spawns
each suite with execFileSync. Verified: running standalone under the REAL home leaves
~/.claude/sidecoach-flow-history.json byte-identical.

## Codex found four real defects in MY repair, across four passes

Worth recording because the produce-and-verify gate earned its keep here - every one
of these was in code written to eliminate exactly this class, and I did not see any of
them:

1. The `kind=exec` scan searched `claude/agents`. Those are markdown: `#` opens a
   HEADING, and ordinary prose has no comment marker at all, so a sentence ABOUT a
   hook would have satisfied an exec claim - reopening the prose-proves-reachability
   hole the loop exists to close.
2. Seeding once before T1 left T2's prerequisites fed by T1's side effects.
3. `for f in $(grep -rl ...)` word-splits, so a checkout path containing a space would
   have made the exec scan stat nonexistent fragments and report "no reacher" for a
   hook that has one. Verified fixed by running the suite from a directory whose path
   contains a space.
4. The sharpest one: `kind=exec` proved SOME file under claude/hooks execs the helper,
   not that the DECLARED reacher does - a different claim from the one the map makes,
   and the map's paths are what drive per-selection suppression. A stale path could
   keep suppressing an orphan while an unrelated hook supplied the global hit. Now
   each declared reacher is checked on its own comment-stripped contents.
   Mutation-proved: repointing detect-session-model.sh's reachers at a real executable
   hook that does not exec it turns the row RED, while the true callers still exec it
   elsewhere (so the old global scan would have stayed green).

## A THIRD dead gate, found incidentally: npm test is green while two suites fail

`phase-h-block7-flow-validator-integration` (16/20) and
`phase-i-block3-context-tracking-e2e` both print `Status: FAILED` and then
**exit 0**. `scripts/run-tests.ts` counts a suite as failed only when the child
process exits non-zero (`try { runOnce(); } catch { failed++ }`), so `npm test`
returns 0 with two suites failing. That is the same family as everything else in this
unit - a gate that cannot report the failure it just printed - and it means the
sidecoach test gate currently cannot block on those two suites. Not repaired here:
outside this unit's four files, and another session has sidecoach source in flight.

## Two pre-existing failures observed, NOT caused here

`phase-h-block7-flow-validator-integration` (16/20) and
`phase-i-block3-context-tracking-e2e` fail in `npm test`. They are not mine: both run
BEFORE this suite in the run order (lines 1265 and 1295 against 1408), so the seeding
cannot reach them, and both fail standalone in a fresh HOME. Flagging for whoever owns
the in-flight sidecoach validator work.

## hook-registry-guard: a GUARD that could not SEE (added by the lead mid-unit)

Same class as the suites, one layer up: an instrument reporting confidently while
structurally unable to see what it claimed to check.

**Defect 1 - the guard rotted through a rename.** `--audit-skills` matched
`copy_bundled_skill <name>`. That function has ZERO occurrences in install.sh; it was
renamed to `install_bundled_skill` (26 occurrences) and nothing went red, because no
test tied the guard's regex to the installer's actual API. The damage was not a dead
branch but CONFIDENT FALSE FINDINGS: the modern bundle path is
`for _skill in ...; do install_bundled_skill "$_skill"; done`, missed on both counts
(wrong name, variable argument), so any skill deployed only through that loop was
reported as shipping nowhere. It said exactly that about `sidecoach` and
`voice-output`, and an agent nearly added a redundant deploy line to satisfy a blind
check.

Rewritten to resolve the shapes it CAN prove - literal argument, a `for VAR in
<literals>` loop the call is genuinely inside, and the `claude/skills/<name>` path -
and to report CANNOT TELL (exit 3) when an argument is not statically resolvable,
rather than manufacturing a finding. Same distinction `--audit` already drew with its
exit 3, now applied to skills.

**Defect 2 - the disk sweep races with concurrent test runs, and is only PARTLY
fixed.** The gate blocked on `zz-registry-fixture`, a file that did not exist: it is
test-hook-registry.sh's own fixture, caught in flight by a sweep running in another
process. Added a re-stat before reporting, which closes the observed case (a path that
has already vanished cannot be an unpackaged hook).

It does NOT close the general case, and the numbers say so: measured with a
reproducible churn probe, 12 of 23 concurrent sweeps named the transient at HEAD and
10 of 22 with the re-stat. Marginal, not a fix. The obvious fix - exempting the `zz-*`
prefix - was tried and REVERTED: test-hook-registry.sh writes those exact fixtures
into the live claude/hooks/ and asserts the guard FLAGS them, so exempting the prefix
turned 9 of its rows red (67/9). The prefix that identifies a transient is the prefix
that identifies the detection fixture; no name rule can separate them because they are
the same files. **The durable fix belongs in the SUITE - it should build fixtures in a
sandbox repo copy instead of mutating the live tree.** Not taken on here: it is a
refactor of a 76-row suite while several agents are active in the tree.

**The 75/1 reading was an artifact, as suspected.** On a quiescent tree the suite is
76/0, three consecutive runs, and 86/0 after the new rows. Root cause of the flap: the
suite's flag files (`$HOME/.claude/.unmanaged-hook`) live in the REAL home, so
concurrent runs collide on shared global state. Third race in the same file.

**Codex found six defects in this repair across three passes**, every one of them in
code written to stop exactly this class:
- the argument capture stopped at `}`, so `"${_skill}-extra"` truncated to `"${_skill`
  and resolved as the bare variable - fabricating a deploy set from an argument that
  names none of it;
- the loop lookup was global, so a reused loop variable resolved a call against the
  wrong word list;
- nearest-preceding-header did not prove CONTAINMENT, so a call after `done` still
  inherited the loop's words (now balanced with do/done counting);
- `strip('"\'')` erased shell quote semantics, so `'$_skill'` - a literal, which
  deploys nothing - was treated as the variable and marked the whole word list
  deployed;
- `^\$\{?NAME\}?$` accepted unbalanced `$name}` and `${name`;
- the path fallback still matches installer UI strings. That last one is KEPT and
  documented rather than fixed, because `lotus` genuinely deploys through the path
  form and tightening it would report a live skill as unpackaged. The severity is
  asymmetric: this direction can only MISS a finding, whereas the drift it replaced
  MANUFACTURED findings against skills that ship fine.

All six folded; every repair has a mutation-proved regression row (7 new rows, suite
86/0). The coupling row is the one that matters most: it goes red if either the guard
or install.sh renames the deploy function again, which is the watch that did not exist.

**The lead fixed the product defect I reported earlier in the unit while this ran.**
install.sh no longer deploys `multiple-choice-enforce.sh`, the allowlist entry is gone,
and test-settings-wire-parity.sh went from exit 1 to exit 0 (19/0) as a consequence.
The report-do-not-patch call was the right one: the fix landed at the source rather
than as an exemption in the test.

## The pattern, stated once

Four instruments today reported confidently while structurally unable to see what they
claimed to check: two fail-open hooks, three suites full of rows that cannot fail, and
a guard matching a function name that no longer exists. The shared shape is not
carelessness - each was written carefully - it is that NOBODY EVER WATCHED THE
INSTRUMENT FAIL. A check is only evidence if someone has seen it go red for the reason
it names. That is the whole content of this unit.

## Self-analysis

Three of my own probes were broken before they were believed, and each was caught only
because a control existed. The first sledgehammer deleted a line that other lines
depended on and produced a dead hook, which read as "57 vacuous rows found". A later
probe ran two suites from the repo root instead of sidecoach/, so `git stash`-based
before/after comparison silently compared nothing to nothing and I nearly recorded
"pre-existing" on the strength of an empty result. The failure mode is the same one
this whole unit is about: an absent result is not a negative result. What fixed it was
never trusting a NOT-CAUGHT reading without an anchor assertion and a liveness control
on the same run.

## Files touched

- claude/hooks/test-route-intent.sh
- claude/hooks/test-hook-data-parity.sh
- claude/hooks/test-settings-wire-parity.sh
- claude/hooks/hook-registry-guard.sh
- claude/hooks/test-hook-registry.sh
- sidecoach/src/__tests__/sprint7-buildreport-includes-unstructured.test.ts
