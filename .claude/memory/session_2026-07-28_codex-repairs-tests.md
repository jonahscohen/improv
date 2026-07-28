---
name: Repairing the test rows that could not fail
description: Seven vacuous or misanchored rows across four suites, each repaired and then proven live by mutation; plus two extraction gaps and one product-contract conflict found on the way
type: project
relates_to: [session_2026-07-28_installer-integrity-closeout.md, session_2026-07-28_installer-integrity-lead-verified.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: every repaired row mutation-controlled (old form green, new form red, on the same mutated installer); 4 suites and both acceptance gates re-run at exit 0 except one escalated conflict
confidence: high
---

# The rows that could not fail (2026-07-28)

A previous unit in this session built suites to prove a set of installer fixes were safe and
reported them green. Independent review showed several of those rows CANNOT FAIL, or pass for
reasons unrelated to the property they name. The evidence the session rested on was partly
hollow. This is the repair.

**The method, applied to every row touched:** mutate the code the row exists to catch, watch it
go RED, restore, watch it go GREEN. Where a row was being repaired rather than added, run the
SAME mutated installer against the OLD form of the row and show it stays GREEN. A repair with no
differential is an assertion about an assertion.

**Mutations were applied to a byte-identical COPY of install.sh, never the working file** - a
sibling agent owned install.sh for the duration. Every mutation asserts its ANCHOR EXISTS before
applying, and the driver exits 8 if it does not. That guard fired twice on my own bad escaping,
which is exactly the failure this session had already produced once in the confident direction:
a mutation reported "not caught" when it had silently mutated nothing.

## The seven rows

| # | Row | Was | Now | Proven by |
|---|---|---|---|---|
| 1 | `test-userfile-safe-edit.sh` cycle row | `shasum \| awk` inline; on a box without shasum both sides were EMPTY and compared equal | `hash_file` helper; no hashing tool is a HARNESS abort, exit 2, zero rows run | `IMPROV_TEST_HASH_TOOLS=definitely_not_a_tool` -> exit 2 |
| 2 | brain: repo link "removed, not followed" | `[ -e ]` alone, which is FALSE for a DANGLING link, so deleting the target and leaving the link scored a PASS | `! -e && ! -L` | installer mutated to leave a dangling link: new row RED (64/1), old row GREEN (65/0) |
| 3 | structural `sed -i` rows, both suites | `sed[[:space:]]+-i` requires `-i` to be the FIRST token, so `sed -E -i.bak`, `sed -n -i.bak` and `sed --in-place` all scored zero | option-run matcher, `--in-place` included | `sed -E -i.bak ... "$ZSHRC"` injected: new RED, old GREEN, both suites |
| 4 | memory malformed + LEGACY malformed | `\|\| true` then a byte-count compare, which passes when the installer dies before ever reaching the branch | four output anchors: section entered, refusal warning printed, success line ABSENT, end-of-run summary reached | installer mutated to `exit 0` before the memory section: both new rows RED while the byte-count rows they guard stayed GREEN |
| 5 | the e2e rows | ran the real installer from the WORKING CHECKOUT, and install.sh chmods scripts under its own `$REPO_DIR` | one staged copy under `$TMPROOT`, plus a containment row and a positive control | positive control (staged probe stripped of +x must come back +x) goes RED under the early-exit mutation, so the guard is watching a live write path |
| 6 | prune "real skills dir unchanged" | `ls -1a` on top-level NAMES | `snapshot_dir`: existence, per-entry type, and symlink TARGET | deterministic wrapper-driven mutation between snapshot and check: swapped targets old GREEN/new RED, link->file old GREEN/new RED, control green both |
| 7 | ampersand rc capture + forwarding | `run_ampersand` spliced `$*` UNQUOTED into a `zsh -c` string, so the "forwarded verbatim" property was untestable | args passed as zsh positional parameters; 8 new `assert_forwards` rows | old `$*` form: exactly the 8 new rows RED (128/8); fixed form 136/0. Shim mutated to `return 0` on not-found: rc row RED |

## Two things found on the way that were not on the list

**The extraction lists were incomplete, and that is a silent failure by construction.** Both
safe-edit suites rebuild install.sh functions by awk-extracting them. install.sh grew calls to
the file-scope helpers `repo_symlink_points_into_repo` and `record_component_failure`; neither
list was updated. The degradation is not an error - in an `if` condition a command-not-found is
simply FALSE, indistinguishable from an honest "no", so `deactivate_brain` quietly stopped
removing repo symlinks and rows about that behaviour reported on a branch that never ran. In
BARE COMMAND POSITION under `set -euo pipefail` it is worse: a 127 abort before the function's
own `return`, which makes a row about a return value report on the harness instead.

**Why:** the named `declare -f` loop only catches dependencies somebody already thought of.
**How fixed:** both helpers added, plus a general row in each suite - any top-level function
install.sh defines, called from executable code inside the extract but not defined there, is a
harness gap. Comments are stripped first, because these primitives NAME other functions in their
write-ups and a mention is not a call. Proven by removing the extraction line and watching the
guard name the exact helper.

**A product contract was deliberately reversed underneath a test row.** `deactivate_discord` now
`return 1`s on a failed edit and calls `record_component_failure`, with a write-up explaining
that returning 0 made "I changed nothing" indistinguishable from "I removed the component". The
zshrc row asserts the OLD contract. Left RED and escalated rather than rewritten: choosing
between a test and a deliberate product change is the orchestrator's call, not the executor's.

## The escalation, and the ruling: a row that asserted a MECHANISM, not a property

`test-zshrc-safe-edit.sh` had a row reading "discord: failed edit still returns 0 (a case arm
under set -e must not abort)". It went red because install.sh replaced the `return 0` design with
a LEDGER, deliberately. Escalated rather than rewritten, because choosing between a test and a
considered product change is the orchestrator's call. Ruling: the product is right, the row is
stale, rewrite it.

**Why `return 0` was wrong even though its reasoning was sound.** The property it protected -
a component's undo must not abort the installer under `set -e` - is real. But rc=0 made
"I changed nothing" indistinguishable from "I removed the component", so a user was told discord
came out while its launcher still sourced in every new shell. The ledger keeps the property by a
different route: the site records and the function returns non-zero, `apply_pending` calls it as
`if deactivate_component ...; then`, and bash disables errexit for the whole body of a function
whose status is being tested. Nothing aborts, and the component is not marked inactive.

**Rewritten as FOUR rows, one per link**, because a single row on the return value would go green
again the day the ledger stopped recording. Driver runs in `apply_pending`'s real shape; testing
the function bare would put errexit in a state production never sees. Two independent consumers
are covered: `apply_pending` sees only the return value, and a plain `--only <x> --yes` never
reaches it and has only the end-of-run ledger check.

One mutation per link, and the separation is the evidence:

| mutation | returns non-zero | caller continued | recorded in ledger | failed not inactive |
|---|---|---|---|---|
| site returns 0 again | **RED** | green | green | **RED** |
| ledger stops recording | green | green | **RED** | green |
| site exits instead of returning | RED | **RED** | RED | RED |
| control | green | green | green | green |

The second row is the one that matters: with the ledger silenced, the return-value row is STILL
GREEN and only the ledger row fails. That is precisely the hollowness the four-way split exists
to prevent. The abort mutation is not isolated and cannot be - an `exit` takes the driver's whole
stdout with it - so it takes all four red; it is there to prove the caller-continued row can fail
at all, which nothing else does.

`PARTIAL_FAILURES` is grepped verbatim out of install.sh rather than declared in the harness, and
its absence is a HARNESS abort (exit 2) rather than an unbound-variable death that would read as
an installer defect.

**Cross-model review of the rewrite found four more, all folded.** The ledger check was a loose
grep for `discord` on a `LEDGER=%s` key/value line - wrong twice over, because the failure
message itself contains "discord-chat-launcher" so it could pass without the record existing, and
because `PARTIAL_FAILURES` is newline-JOINED so only the FIRST entry ever carried the tag. The
question is now answered inside the driver against the anchored record shape `^  - discord: `.
A `|| true` on the driver could mask a crash after the assertions had printed. And the comment
claimed to mirror apply_pending's call shape when it mirrors its ERREXIT CONTEXT - production
dispatches through `deactivate_component`, which the test deliberately skips because that wrapper
also runs `migrate_legacy_markers`, an unrelated subject.

**The fix for the `|| true` then broke the mutation matrix, which is how it got caught.** A guard
that treated any non-zero driver as a harness abort meant the abort mutation exited 2 before any
row printed, so "does not abort the caller" became a row that could not fail - the exact defect
class this unit exists to remove, reintroduced by a fix for a different one. The driver now
prints a `DRIVER_STARTED` sentinel and the status is classified three ways: never started is a
harness abort, started-then-died is the product defect and surfaces as that row going RED, and
finished-but-non-zero is a harness abort. Re-proven: the abort mutation takes the row red.

## Corrections to the brief, recorded because being wrong quietly is the thing this unit exists to stop

- The `local rc=$?` finding was **wrong on mechanism**. `$?` is expanded before `local` runs, so
  the row captured the launcher's status correctly (measured: shape A gives 7, `local rc; rc=$?`
  gives 0). The row was already live - confirmed by mutating the shim to `return 0`. It was
  restructured anyway so a status assertion does not turn on that ordering, but it was not broken.
- The prune "absent-to-empty" finding was **half wrong**. `ls -1a` emits `.` and `..` for an empty
  directory, so absent ("") never compared equal to created. The TARGET-SWAP half was correct and
  was a real vacuity; a link-to-regular-file retype was a second one, found while proving it.

## What cross-model review then found in the repair itself

Codex reviewed the diff (exit 0, 285s) and named seven defects. All were verified before being
folded, and two were worse than reported:

1. **The repaired sed matcher still missed three spellings** - `sed -Ei.bak` (combined short
   cluster), `sed -ni.bak`, and `sed -e SCRIPT -i FILE` (GNU accepts options after the script).
   A regex kept losing this race, so the matcher is now a TOKEN SCAN: split the logical line on
   pipeline/list separators, keep segments whose command really is sed / gsed / a path ending in
   `/sed`, and test each argument token for an in-place option. All four mutations now go red;
   16 decoys stay green, including the `parsed -i` false positive the regex form had.
2. **The dependency guard missed the ordinary shapes shell is written in** - `{ fn; }`,
   `pat) fn ;;`, `while fn; do`, and even `if fn; then`. The trailing boundary required
   whitespace-or-EOL, so any call ending in `;` evaded it. It had worked earlier only because the
   one real call happened to have a space after the name. Both boundaries widened.
3. `IMPROV_TEST_REAL_SKILLS` **could take the user's real skills tree out of scope entirely** -
   a seam added to make the row provable had handed anyone with that variable set a silently
   unguarded `~/.claude/skills`. The real path is no longer overridable; the override now adds a
   SECOND watch instead of replacing the first.
4. `snapshot_dir` was direct-children-only, so a prune that rewrote `skills/foo/SKILL.md` passed.
   Now recursive with size and mtime - the tree is under a hundred entries.
5. **"migrated to a real file" checked only `! -L`**, which a path that was DELETED also
   satisfies. Same vacuity class as the row this unit was sent to fix, one row below it.
6. The two suppression-branch hints always blamed an early exit, which is actively wrong in the
   case that matters: an installer that reached the branch and appended anyway. `why_not()` now
   names the anchor that actually failed.
7. **The containment row cannot fail today and Codex was right about why** - every file the
   installer chmods in the checkout is already executable, so a mistaken real-checkout run is a
   no-op. Rather than dress that up, it is kept as a pin and joined by a row that asserts the
   property directly: no executable line in the file may hand `$INSTALLER` to a `--only` run.

## Second review pass, on the repair of the repair

Codex reviewed again (exit 0, 235s). It confirmed the env-var masking fix, the extract-if-present
loop and the strengthened migration row, and found four more:

- **The token scanner split inside quoted strings**, so `sed -e 's/a;b/c/' -i file` - the very
  GNU shape the first fix was for - was cut mid-script and the `-i` landed in a segment whose
  command was no longer sed. It also only required a `sed` WORD in the segment, so `echo sed -i`
  was a false positive. Now: quoted spans are masked before splitting, and sed must be the
  segment's COMMAND token with `VAR=val` prefixes skipped, so `LC_ALL=C sed -i.bak` still counts.
  21 spellings and decoys verified.
- **The dependency guard still missed `VAR=1 fn`, `time fn`, `coproc fn`**, and produces false
  positives on function names quoted inside strings. The comment no longer claims more than the
  row delivers.
- **The containment structural row matched one literal spelling.** `bash "${INSTALLER}"`,
  `bash -- "$INSTALLER"`, `"$BASH" "$INSTALLER"` and `"$REPO_DIR_REAL/install.sh"` all walked
  past. It now tests the OPERANDS - the installer named together with `--only` - with
  continuations joined.
- **`why_not()`'s legacy branch checked one of the two anchors the assertion requires**, so a run
  failing on the other produced a hint naming no cause.

**And the fix broke the row, loudly, which is the point.** `mask_quotes` walks a line character
by character, and install.sh contains a multibyte bullet around line 3055: in a UTF-8 locale awk
aborted with `towc: multibyte conversion failure`, `n_sedi` came back EMPTY, and the row failed
for a reason unrelated to sed. Fixed with `LC_ALL=C` plus a guard that exits 2 when the scan
returns anything that is not a number. That same guard then caught a second self-inflicted bug
immediately - an apostrophe inside an awk comment closed the surrounding bash quote. A row that
compares against an empty string is the exact defect this whole unit is about, and it very nearly
reappeared in the repair.

## Third pass, and what was deliberately NOT chased

Codex ran a third time (exit 0, 221s) and confirmed every fix from passes one and two. Four more
were folded because they were cheap and real: shell wrappers (`command`/`env`/`time`/`sudo`) in
front of sed, `--` ending the option list so a literal `-i` after it is a FILENAME, a trailing
`# ... sed -i ...` comment being counted as code, and the awk's EXIT STATUS being checked
alongside its output (a non-numeric result catches an abort mid-stream, but an awk that fails
after printing digits would have walked through). The containment scan was widened to catch
`${INSTALLER}`, `bash --`, `"$BASH"`, and all three `REPO_DIR_REAL/install.sh` spellings -
verified against seven evasions, while correctly ignoring the staged-copy invocations.

Three findings were accepted rather than chased, and the reasoning is recorded so nobody
re-opens them blind:

- **Static scans cannot follow variable indirection.** `real="$INSTALLER"; bash "$real" --only`
  evades the containment row. Closing that needs shell parsing, and the row is a backstop for an
  accidental regression, not an adversary.
- **`INSTALL_SH` / `IMPROV_TEST_INSTALLER` are subject-replacement seams.** Exported to a fake,
  the suites would pass while the real installer is broken. They predate this unit and the
  negative control depends on them. Worth gating behind an explicit mutation-mode flag; noted,
  not done here.
- **The executable-set containment row still cannot fire today**, because every file the
  installer chmods is already executable. The static scanner is doing the real work; that row is
  a pin. Said plainly in the code rather than dressed up.

## The installer moved underneath the suites twice, and the second version handles it

Mid-unit, `repo_symlink_points_into_repo` and `record_component_failure` appeared in install.sh,
then vanished, then came back - the sibling agent iterating. Naming them in the `declare -f` list
produced two spurious failures within the hour.

**Fixed by separating SUBJECTS from SUPPORT.** Subjects are the functions a suite's rows actually
exercise and are asserted by name. Support helpers are extracted IF PRESENT and never asserted by
name; the generic dependency row is what enforces that whatever the subjects call is present.
That tracks the installer through churn in both directions, which a name list cannot.

## Harness note

`claude/hooks/codex-failure-watcher.sh` and `claude/hooks/test-settings-wire-parity.sh` each threw
a one-shot bash syntax error while a sibling agent was mid-write. Both parse and run correctly on
retry; the mtimes sat seconds before each failure. Read-during-write on a concurrently edited
file, not a defect in either file.

## Files touched

- `test-userfile-safe-edit.sh` - hash helper, dangling-link row, matcher, staging + containment, two suppression-branch rows, extraction fix, dependency guard
- `test-zshrc-safe-edit.sh` - matcher, extraction fix, dependency guard
- `claude/hooks/test-install-prune-skills.sh` - `snapshot_dir`, unwrapped comparison, delta in the hint
- `claude/hooks/test-ampersand-shim.sh` - `run_ampersand` positional-parameter forwarding, `assert_forwards` + 8 rows, rc capture
