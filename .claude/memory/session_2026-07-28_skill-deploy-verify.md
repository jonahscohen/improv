---
name: Skill deploy path routed through link_or_copy_data, plus a verify step
description: Skills installed as frozen copies so 13 edits were inert; install_bundled_skill now respects hook_deploy_mode and verify_installed_skills makes drift impossible to miss
type: project
relates_to: [session_2026-07-28_codex-vetting-wave.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests (52-row suite, 8 mutations, pristine-HEAD control, sandboxed installer runs incl. deactivate, live read-only sweep) + codex-review (2 passes, 11 findings folded)
confidence: high
---

# The defect

`~/.claude/skills/*` were deployed as real COPIES via `safe_cp`, not through the
deploy-mode decision that hooks use. Two live consequences, both measured 2026-07-28
at HEAD 96257564:

1. Editing a repo `SKILL.md` changed nothing the model reads until `install.sh` re-ran.
   13 of 15 skill edits made that session were inert on disk.
2. Nothing anywhere could tell a correctly-installed copy from a silently stale one.
   The installer printed "installed" either way and the test suite stayed green.

`sidecoach` was the sole exception - a genuine symlink, which is why its edit went live
immediately.

# Drift inventory, taken BEFORE any change

Every installed skill except `sidecoach` was a COPY, and every one of them differed from
both HEAD and the working tree. Classified by whether the installed bytes match ANY
commit in the repo's history:

HAND-EDITED (match no commit ever - these were modified in place, in the installed
location, and the change exists nowhere in git):

- component-gallery-reference
- consolidate
- design-build
- fontshare-reference
- lotus
- social-media

STALE (match an older commit - simply never re-installed since):

- curate -> fb7c2390 (2026-05-20)
- design-references -> 3239cd68 (2026-07-10)
- design-team -> 3239cd68 (2026-07-10)
- icon-source -> 313b9a47 (2026-05-03)
- motion-reference -> 3239cd68 (2026-07-10)
- reflect -> 57e32547 (2026-05-11)
- tactical-polish -> 3239cd68 (2026-07-10)
- task-list -> 49d05b5a (2026-06-05)
- tilt-lab -> ac9f35de (2026-06-05)
- visual-effects -> 4242437c (2026-05-03)
- voice-output -> 7cea4894 (2026-05-03)

CLEAN: sidecoach (symlink).

This refines the earlier count of six drifted copies. The set is the same size but not
the same members: `task-list` is merely stale (it matches commit 49d05b5a), while
`consolidate` matches no commit and belongs in the hand-edited group. NOTHING WAS
RE-SYNCED - the drifted copies are untouched on disk so the evidence of how they got
that way survives.

# What changed

**`install_bundled_skill` moved into the sourceable library region and now routes every
file through `link_or_copy_data`.**

Why: that is the primitive hooks already use, and it consults `hook_deploy_mode`. On a
dev checkout skills now deploy as symlinks, so an edit is live with no re-install - the
same repair that unfroze `justify-source-guard.sh` after it sat at a dead path for a
month.

How: `find <source> -type f` drives the deploy, so the repo directory IS the manifest.
This also fixed a real divergence: the a la carte path copied only `SKILL.md`, so
`--only motion-reference` silently skipped `VOCABULARY.md` while the bundle path
installed it. The two paths disagreed about what the skill even contained. The opt-in
recursion flag is gone; a second argument is now a usage error rather than a silently
ignored one.

**WHOLESALE SYMLINKING WAS DELIBERATELY NOT DONE.** `hook_deploy_mode` returns `copy`
for a repo in a temp location - the documented
`git clone /tmp/improv && ./install.sh && rm -rf /tmp/improv` case, where a link would
dangle into a deleted clone. The new code respects that mode rather than overriding it.
A copy-mode install is legitimate; a copy-mode install whose copies have silently
drifted is not, and that is what the verify step exists for.

**`verify_installed_skills` (new).** Exit codes 0 clean, 1 missing-or-stale, 2 usage.
Reports MISSING, DANGLING and STALE distinctly. Scope was chosen so it cannot cry wolf:
a no-arg sweep skips repo skills that were never installed (components are a la carte),
named skills must be present, foreign installed skills with no repo source are ignored,
and an extra installed file the repo does not own is not drift.

Wired in two places: `--verify-skills [NAME...]` for a read-only audit of the whole
machine, and an end-of-install check scoped to `SKILLS_DEPLOYED` (only what THIS run
deployed, so `--only brain` never fails over an untouched stale component). The
end-of-install failure routes through `record_component_failure`, so drift exits the run
non-zero through the existing ledger instead of printing a warning under
"Installation complete."

# Verification

New suite `claude/hooks/test-install-skill-deploy.sh`, 52 rows, sourced with
`IMPROV_INSTALL_LIB_ONLY=1` against mktemp fixtures with a snapshot guard proving the
real `~/.claude/skills` was never touched.

- Written FIRST and watched fail: 1 passed / 33 failed before the installer changed.
- Pristine-HEAD control: 48 of 52 rows go red against a `git archive HEAD` checkout and
  all 52 are green against the working tree. A suite that passed against both would prove
  nothing. The only four rows that survive on HEAD are tree-independent by nature: a
  fixture assertion, the fingerprint instrument control, an `rm`-semantics shape check,
  and the real-tree safety guard. None claims anything about this installer's behaviour.
- 8 mutations, each asserting its ANCHOR EXISTS before believing a "not caught" result,
  all caught. Two mutants were rewritten mid-build because the original replacements
  produced syntactically invalid bash - the probe would have scored "caught" because
  sourcing failed, not because a row noticed. A third mutation (M7) exposed that my own
  new row was asleep: a word-splitting version ALSO exits 1, so the row was rewritten to
  assert on the message text rather than the exit code.
- Temp-file leak check across install + verify + the unreadable-source early return:
  zero `improv-skill-*` / `improv-verify-*` files left behind.
- Sandboxed installer runs against temp HOMEs only. Real checkout: 12 skills / 52 files
  deployed as symlinks, end-of-install verify clean. Temp-located checkout: real copies,
  and they survive deleting the clone.
- All five fixture classes through the flag: clean 0, stale 1, missing 1, dangling
  named as dangling, usage 2.
- The end-of-install gate proven to fail the run (exit 1 + ledger line), not just warn.

# Codex review - two passes, 11 findings, all real, all folded

Independent Codex pass (`codex-review.py`, exit 0, 321s) on a sibling-free reconstruction
of the diff. It found five defects, three of which my own suite had missed:

1. **`find`'s exit status was discarded by process substitution** in BOTH functions. An
   unreadable source directory, or one changing under the walk, yields a partial or empty
   listing and a non-zero find status that `done < <(find ...)` throws away - so verify
   could report CLEAN for files it never looked at, and install could report "installed"
   having deployed a subset. Fixed by writing the walk to a temp file, checking find's
   status, then iterating the file. This was the most serious finding: a verifier whose
   whole job is detecting drift, silently reporting clean.
2. **`install_bundled_skill` could print "installed" having written nothing** (empty
   source dir). Fixed with a deployed-file counter that errors at zero. I had caught and
   fixed this independently while the review was running.
3. **`_vs_names` was a space-joined string, re-split by the loop.** Also caught
   independently by probing before the review returned; Codex's recommended fix (a bash
   array with the 3.2-safe guard) is exactly what had been applied.
4. **Five skill deploys bypassed the new path entirely** - consolidate, reflect,
   task-list, sidecoach, tilt-lab. Worst case was sidecoach: a bare `ln -sf` of `SKILL.md`
   alone, which both ignored `hook_deploy_mode` (so a throwaway clone got a dangling link)
   and never deployed `CHEATSHEET.md`, which the source owns. That meant a correctly
   installed sidecoach would have been reported as drift by my own no-arg sweep - a false
   positive in the exact shape that teaches people to mute a check. All five now route
   through `install_bundled_skill`.
5. **The headline copy-mode row was weaker than its label.** The fixture had no `.git`,
   so `hook_deploy_mode` returned `copy` because it was not a checkout at all - the row
   would have passed even with the temp-location branch deleted. The hard case is a git
   checkout that happens to live under `$TMPDIR`. Fixed with a `.git` marker plus an
   explicit row asserting the fixture IS that hard case.

Two further vacuous rows were found by re-running the suite against pristine HEAD after
the fixes: the empty-source and unreadable-source rows passed on HEAD because a MISSING
function also returns non-zero. Both now carry a positive control (a valid skill must
succeed in the same fixture), so "something returned non-zero" can no longer satisfy them.

**Second Codex pass on the final diff - 6 more findings, all real, all folded:**

1. **`lotus` would have been a permanent false positive.** `lotus/install.sh` rewrites the
   `__LOTUS_SRC__` placeholder in the installed SKILL.md at install time, so a HEALTHY
   lotus install differs from source by design and the byte compare would report STALE
   forever. Fixed with a documented `VERIFY_SKILLS_EXEMPT` list. This is the second time
   in this unit that the check was about to cry wolf on a correct machine, which is the
   failure mode most likely to get the whole thing muted.
2. **Both walks were newline-delimited.** A filename containing a newline splits into two
   nonexistent paths. Now `-print0` with `read -r -d ''`.
3. **An untraversable installed root reported "0 skill(s), 0 file(s)" as CLEAN.** Every
   `[ -d ]` probe fails, the sweep selects nothing, and the summary calls it a pass. Now
   an explicit error.
4. **Temp-file leak under `set -e`:** a failing per-file `mkdir` aborted the shell before
   the cleanup line. The mkdir failure is now captured explicitly so every path reaches
   its `rm -f`.
5. **The mutation harness scored a syntax-broken mutant as "caught".** Probes now return a
   distinct code for "could not source the mutant", and the harness reports that as a
   HARNESS failure rather than crediting the suite with a catch it never made.
6. **The space-in-filename row only asserted `rc=1`,** which a broken splitting
   implementation also produces. Now asserts the whole name appears in one message and no
   fragment does - the same weakness M7 had already exposed in its sibling row.

Live read-only proof after the fixes: `./install.sh --verify-skills` against the real
machine reports 16 drifted skills across 17 examined, exits 1, correctly exempts lotus,
and correctly ignores justify (no repo source). That number reconciles exactly with the
inventory above: 6 hand-edited + 11 stale = 17 drifted, minus lotus (exempt) = 16.

# Write-through containment - PROVEN, not argued

Symlink deployment makes the installed path and the repo source the same inode. That is
the topology that rotted CLAUDE.md for months (an installer whose output path resolved
onto its own input), and this unit demonstrated the hazard is reachable by falling into
it: a `printf >` into an installed path truncated a tracked repo file, and the test
reported CLEAN because both sides had become the same file.

So the question "can the INSTALLER do it" was answered with runs, not reasoning.

**Real installer, real repo (symlink mode), sandbox HOME.** Baseline tree hash of
`claude/skills` recorded, then compared after each stage. Identical every time:

| Stage | Result |
|---|---|
| Full install (skills, reflect, task-list, memory) | tree hash IDENTICAL |
| RE-install (destination is now a link straight at the source) | tree hash IDENTICAL |
| Four a la carte `--only` runs (motion, component-gallery, visual-effects, icon-source) | tree hash IDENTICAL |
| Deactivate of 12 components via the production `--apply-plan` path | tree hash IDENTICAL, exit 0 |

After the 12 deactivations, 55 symlinks into the repo were removed from the sandbox,
`claude/skills` still held all 59 files, and `git status` was clean.

**Why it is safe, confirmed by mutation rather than by reading:** `link_or_copy_data`
does `rm -f "$dst"` BEFORE `cp "$src" "$dst"`. That single line is the whole guard. Take
it away and `cp` opens the destination through the link, truncates the source to zero,
then reads the now-empty source. Mutation M8 deletes exactly that line and the
containment rows go red, which is what makes their green meaningful.

`rm` never follows a symlink when deleting, so the deactivate direction removes links
rather than targets - pinned for both the "directory of links" shape and the harder
"installed dir is itself a link into the repo" shape.

**Seven permanent rows** in the suite, including W0, the control the section rests on:
if `src_fingerprint` were blind, all six containment rows would pass while the repo
burned, so W0 changes one byte and proves the instrument notices. W1-W4 and W6 also
assert the deploy ACTUALLY RAN, because "repo unchanged" is trivially true on a tree
where nothing happened - that gap was caught by re-running against pristine HEAD and
watching the containment rows pass there.

No same-inode refusal was needed. The existing `rm -f`-before-`cp` ordering already
contains it, and it is now held in place by a mutation-controlled assertion instead of
by a comment.

# A pre-existing defect found while proving this (NOT mine, NOT fixed)

Deactivating `tactical-polish` through `--apply-plan` fails with
`deactivate FAILED (exit 1) ... (pending preserved)` and aborts the rest of the plan.
Cause: the dispatch line ends with
`for _legacy in "$CLAUDE_DIR"/skills/*interfaces*; do [ -e "$_legacy" ] && rm -rf "$_legacy"; done`.
When the glob matches nothing the `[ -e ]` test is false, so the loop's exit status is 1
and it is the last command in the case arm. The skill IS removed; the function just
reports failure.

Confirmed pre-existing by reproducing it against a pristine `git archive HEAD` checkout,
so it predates this unit. Left alone deliberately - it lives in the deactivate dispatch,
not the deploy path this unit owns.

# A consequence of symlink mode worth knowing

On a dev checkout the installed `SKILL.md` is now a symlink into the repo, so anything
that WRITES to `~/.claude/skills/x/SKILL.md` writes THROUGH to the repo source. Hooks
have always had this property; skills now share it. Two implications:

- A human or agent editing the installed path is now editing the tracked repo file. That
  is the intended direction (edits land in git instead of evaporating), but it is a real
  behavioural change from frozen copies.
- `verify_installed_skills` can never report drift for a symlinked skill, by
  construction - there is no second copy to diverge. Detecting drift is a copy-mode
  concern, which is exactly the case the verify step exists for.

# Self-analysis

Three process failures worth recording.

Third, and the sharpest: while verifying, I "tampered" with an installed skill by
`printf > $SANDBOX/.claude/skills/icon-source/SKILL.md` to prove verify would catch it.
The path was a SYMLINK, so the write went straight through into the repo and truncated
the tracked `claude/skills/icon-source/SKILL.md` to the word "tamper". The test then
reported CLEAN - correctly, since both sides were now the same file - and that false
green is what exposed the damage. Restored with `git checkout --` and confirmed
`claude/skills/` byte-identical to HEAD.

Two lessons. The mechanical one: to corrupt a deployed file you must `rm` the link first
and then write, never write through it - and a `|| fallback` on the redirect is useless
because the write SUCCEEDS. The deeper one: I had just built a system whose whole purpose
is that installed paths now point at the repo, and then wrote to an installed path as if
it were a throwaway copy. The mental model I was verifying was not the model I was acting
on. An unexpected PASS deserves the same suspicion as an unexpected FAIL; this one was
only caught because the result contradicted the row's own intent.

First, my initial drift measurement compared installed files against the worktree and
HEAD only, and reported "everything differs" - technically true but useless, because it
could not separate "never re-installed" from "edited in place." The second pass walked
every commit that touched each file. The lesson: a diff against two points is not an
inventory; the question "when did this last match anything" needs the history, and the
lead's instruction to preserve evidence was what forced the better measurement.

Second, my first attempt to prove the end-of-install gate fails the run reported a false
GREEN-looking result (installer exited 0). The cause was my harness, not the code: I ran
the mutated installer from a temp file, so `REPO_DIR` resolved to `$TMPDIR`, every skill
source was "missing", nothing deployed, and the gate was correctly skipped. Running a
script whose first act is `dirname "$0"` from outside its repo invalidates the test. I
caught it by reading the log instead of trusting the exit code - the failure mode was
an assertion that could not have failed for the reason I thought it was testing.

# Files touched

- `install.sh` - `install_bundled_skill` rewritten and moved into the library region,
  `verify_installed_skills` added, skills bundle collapsed onto the shared helper,
  the consolidate / reflect / task-list / sidecoach / tilt-lab deploys routed through the
  same helper, `--verify-skills` flag + help, end-of-install verify gate
- `claude/hooks/test-install-skill-deploy.sh` - new, 34 rows + 6 mutations

# Not done, deliberately

- The 17 drifted installed copies were NOT re-synced. Overwriting them would destroy the
  evidence of how they drifted, and two of them predate this session.
- `justify` and `lotus` deploy their skills from their OWN installers
  (`justify/install.sh`, `lotus/install.sh`), which are another agent's unit in this
  session. They still bypass `install_bundled_skill` and `SKILLS_DEPLOYED`, so the
  end-of-install gate does not cover them. `justify` has no `claude/skills/justify`
  source at all, so `--verify-skills` ignores it by design; `lotus` DOES have a source and
  its installed copy is one of the six that match no commit.
