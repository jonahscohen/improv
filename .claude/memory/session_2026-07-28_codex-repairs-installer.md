---
name: Codex-designed repairs to the six confirmed installer defects
description: Six confirmed install.sh/justify/lotus defects repaired to Codex's design, Codex re-reviewed the diff and found 7 more (all folded), and a perf regression I introduced was caught by a suite hang rather than by a green row
type: project
relates_to: [session_2026-07-28_installer-integrity-closeout.md, session_2026-07-28_zshrc-bak-missed-callsites.md, session_2026-07-28_codex-repairs-tests.md]
author_human: Jonah Cohen
author_model: claude-opus-4.6
source: session
verified: codex-review + 52-case repair harness + full suite battery
confidence: high
---

Six defects the lead confirmed by hand were repaired in `install.sh`, `justify/install.sh`
and `lotus/install.sh`. Codex designed every fix (deterministic wrapper, prompt positional,
diff on stdin) and re-reviewed the finished diff. Both wrapper passes exited 0. Nothing
committed.

## The six, and what each actually was

1. **The output-overwrites-input cycle was still open on RELATIVE symlinks.** Twelve sites
   asked "is this a link into our own checkout?" with a raw string compare on `readlink`
   output. A relative link misses the prefix, is treated as the user's file, and the
   `--only memory` append writes the assembled block back into `claude/CLAUDE.md`, the
   payload source. Reproduced: the payload went 186 -> 318 lines in one run. All twelve now
   route through one `repo_symlink_points_into_repo`, which resolves the target against the
   link's own directory and `pwd -P`s both sides. The correct resolution had existed in this
   file all along, inside `migrate_legacy_markers`, with a comment claiming a relative link
   "cannot slip past" - true in that one function and false in the twelve others.

2. **Two delegated installers still ran the condemned pattern.** `justify/install.sh` and
   `lotus/install.sh` did `sed -i.bak "s|...|...|g" SKILL.md && rm -f SKILL.md.bak` under
   `~/.claude/skills`: destroys a user's own `.bak`, and the `&& rm` swallows a failed
   substitution so the installer exits 0 having shipped a skill with `__JUSTIFY_SRC__` still
   literal. Both now use a self-contained `replace_placeholder_atomically` (perl, no
   in-place edit, no `.bak`, temp-beside-then-rename, verifies the placeholder is gone).

3. **`safe_cp` deleted the destination before proving the source was copyable.** It was
   `rm -f "$2"; cp "$1" "$2"`. A missing source under `--only memory` destroyed the user's
   existing file and then aborted under `set -e`. Now preflights the source and does
   temp-beside-destination plus `mv -f`, which also preserves the original reason the
   `rm -f` existed (a destination symlinked back at the source).

4. **`deactivate_memory` never handled a repo-pointing `~/.claude/CLAUDE.md`.** The block
   delete is gated on `[ ! -L ]`, correctly, but nothing dealt with the link - so on a
   legacy machine memory deactivated to completion with the instructions still live. It now
   MATERIALIZES the link into a real file and deletes only its own block, rather than
   removing the whole link the way `deactivate_brain` does. That distinction is the
   load-bearing part: brain owns the file in the legacy shape, memory owns one block inside
   it, and deleting the link to uninstall a section would take the user's own global rules
   with it.

5. **Failed user-file edits were warnings and overall SUCCESS.** A read-only `~/.zshrc`
   printed a warn, then "Installation complete.", then exit 0, with `nvm use default` still
   running in every new shell. Added a `PARTIAL_FAILURES` ledger: sites record instead of
   warning, the affected deactivate functions return non-zero (which `apply_pending` checks
   and which does NOT abort mid-undo, because the caller reaches them through an `if`
   condition and bash disables errexit for the whole body), and the end of the run exits 1.

6. **Delimiter containment was a silent strip.** `strip_block_markers` deleted marker-shaped
   lines out of the payload with no diagnostic, so a payload source that legitimately
   documents a marker silently lost those lines and a genuinely contaminated source
   installed cleanly forever. It is now a validator that names the file and line and
   returns 1.

## Codex re-reviewed the diff EIGHT times, and every round found something

Rounds found 7, 4, 2, 4, 3, 3, 4 and 5 findings. That shape is the headline result, not a
footnote: the first review of a "finished" fix found three High defects in it, and the
review after each repair kept finding more. Everything below was folded and re-verified.

### Round 1 - 7 findings against the first implementation

The review was worth more than the design. Three High:

- **My "fast path" was a second implementation that disagreed with the first.** I had added
  a shortcut accepting any absolute target textually under `$REPO_DIR`. `$REPO_DIR/../elsewhere`
  is textually under it and physically outside; so is a path through an intermediate symlink
  that escapes. The shortcut returned "ours" for paths full resolution rejects, and these
  callers DELETE and MATERIALIZE on that answer. Verified live against the pre-review
  function: both shapes returned "ours". Removed the shortcut entirely and got the speed
  from removing forks instead (parameter-expansion dirname/basename, memoized repo root,
  memoized target parent) - one code path, and now no slower than the string compare.
- **Refresh order was destructive.** All three block sites deleted the existing block and
  THEN validated the new payload, so my own new validation failure destroyed the user's
  working block before refusing. Validation and payload capture now happen first.
- **`deactivate_memory` tested only the lowercase marker** when deciding to materialize, so
  a legacy capital-I block left the symlink unconverted and the instructions live - the
  exact defect 4 was closing, reintroduced by one letter of case. Now case-insensitive, and
  deactivate also removes the legacy capital-I block, which it never did.

Four Medium, all fixed: the legacy malformed-block site still only warned; `safe_cp`
exempted a symlink-to-a-directory from its directory guard (verified: returned 0, wrote
nothing to the destination, and silently deposited a hidden temp file inside the user's
linked directory); the success banner printed before the ledger check so a failed run said
"Installation complete." in green; and both delegated installers wrote SKILL.md through a
pre-existing symlink BEFORE the atomic rewrite could help.

### Rounds 2-8 - the fixes kept being wrong in the same shape

- **Round 2:** validation still ran AFTER the block delete, so my new refusal destroyed the
  user's working block before refusing. Also: the `.migrated` / `.mig` sidecar names four
  sites open-coded are the `.bak` hazard wearing a different suffix - they clobber a user
  file at that path and can write through a symlink parked there. One
  `materialize_repo_symlink` primitive now serves all of them.
- **Round 3:** validation was moved ahead of the delete but not ahead of the symlink
  materialization and the `touch`, so the message "left exactly as it was" was still false.
  Moved to the very top of each section.
- **Round 4:** my round-3 guard made `install_app_hooks` return 1, which ABORTS the
  installer, because every call site is a bare `picked x && install_app_hooks ...` under
  `set -e`. Also found the memory section's own settings.json writer ungated - one
  subsection away from the CLAUDE.md cycle this unit was opened to close, and it survived
  three rounds because all the attention was on the markdown path.
- **Round 5:** six `[ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"` seeds were
  unguarded, and on a DANGLING repo symlink `-f` is false so the redirection follows the
  link and creates settings.json inside the checkout. `ensure_real_settings` now removes a
  dangling repo link rather than trying to convert it.
- **Round 6:** three install sections still open-coded the symlink handling instead of
  calling the helper, so they missed the dangling-link rule. Collapsed onto
  `ensure_settings_seed`.
- **Round 7:** `SETTINGS_UNSAFE` had two consumers and only one was wired - the deactivate
  path read it, the install path is governed by the ledger and never looked at it. One
  `settings_write_failed` helper now feeds both.
- **Round 8:** the dangling-link `rm -f` was unchecked; the memory deactivate's Python
  block still turned "settings.json exists but is unreadable" into `SystemExit(0)`, which
  reported a clean deactivate with every hook still wired.

**The recurring shape, stated once:** almost every finding was a SAFETY STEP THAT REPORTED
SUCCESS - a guard that skipped instead of failing, a validation that fired after the damage,
a flag nobody read, an exception handler that turned a real error into exit 0. That is the
same defect as the six the unit started with, which is why the review kept finding it: the
codebase's habit is to keep going, and each repair had to be checked for whether it had
inherited that habit rather than removed it.

## The finding no review caught - and how it surfaced

**Why:** I replaced a pure-bash string compare with a function that forks five subshells,
in `is_our_hook` - a path the TUI browser re-probes on every render. Measured 3813ms per
300 calls against 713ms.

**How it surfaced:** not as a failing assertion. `test-browser-render.sh` went from a 240s
pass to a 443s WATCHDOG HANG (gum losing keystrokes before raw mode). I only saw it because
I A/B'd against HEAD when the suite exited non-zero, instead of writing the exit code off as
flake - the log's own text ("a keystroke was lost", with retries) invited exactly that. A
correctness fix degraded an interactive path badly enough to hang a suite, and no
correctness test could have said so. After the fork removal it is a 240s pass again.

**Lesson:** an ownership check that runs hundreds of times per render is a hot path, and
"it is only a few subshells" is a per-call claim about a per-frame cost.

## Verification

Built the failing case FIRST for all six, watched them fail, then fixed. Negative control:
the same harness against a pristine `git archive HEAD` checkout fails 14 rows and passes 52
against the repaired tree, so no row is decorative. Cases 7-12 cover the Codex findings, and
the two subtlest were proven to discriminate by running the PRE-REVIEW function bodies
directly and watching them give the wrong answer.

Harness lives at `/tmp/repair-cases.sh` (not committed - the repo's test files are owned by
the parallel `codex-fix-installer-tests` agent). Distinct exit codes: 0 pass, 1 failures,
2 harness setup failure.

Harness is 66 rows at the end. Suites: both acceptance gates exit 0 (`test-bin-parity`,
`test-settings-wire-parity`), `test-userfile-safe-edit` 65/0, `test-zshrc-safe-edit` 48/0,
and the full 54-suite battery green. `test-browser-render` is back to a 239s clean pass.

One measurement trap worth recording: running several batteries concurrently made
`test-browser-render` and two others fail with timeouts and a watchdog exit, which looks
exactly like a real regression. Both classes were confirmed clean when re-run alone. A
pty-driven TUI suite is a load-sensitive instrument - do not read its red as a code result
without an uncontended re-run, and equally, do not dismiss it as flake without one (that
same suite's red WAS a genuine regression earlier in this session).

Two rows in the sibling's suites contradicted the defect-5 change mid-flight (they pinned
"a failed edit still returns 0" and an rc for the memory path). Both resolved without my
touching those files - the sibling was repairing them in parallel and had already wired
`repo_symlink_points_into_repo` into their extraction list before I asked.

## Escalated rather than fixed - scope boundary

Round 8 flagged that the delegated installers follow symlinks on writes OTHER than
SKILL.md: justify's `cp -r` into `$JUSTIFY_DIR`, both installers' direct writes to
`~/.claude.json`, lotus's `json.dump(open(p,'w'))`. That is the same hazard class, but it
is the entire write surface of two installers rather than the one line defect 2 named, so
it is a separate unit and Jonah should scope it deliberately. Also still open:
`apply_pending` and `update_apply` in `claude/hooks/browser-lib.sh` leak their `mktemp`
logs on failure - not my file.

The point at which review stops finding things and starts finding adjacent things is a real
boundary, and crossing it silently is how a bounded repair turns into an unbounded one.

## Also flagged, not mine to fix

`claude/hooks/codex-failure-watcher.sh` is broken in the working tree (+304/-31,
uncommitted): a Python tokenizer body sits outside a valid heredoc, so bash parses it as
shell and every tool call in every session on this machine emits a hook error at line 221.
HEAD's copy passes `bash -n`; the live hook is the working-tree file via symlink. Reported
to the lead rather than repaired, because another agent is mid-edit in it.

## Files touched

- `install.sh` - shared symlink resolver; `safe_cp` rewrite; `PARTIAL_FAILURES` ledger +
  `record_component_failure` + end-of-run exit + conditional banner; `strip_block_markers`
  validator + three reordered call sites; `deactivate_memory` materialize/legacy-delete/rc;
  `deactivate_discord` and `deactivate_nvm` non-zero returns; twelve ownership checks routed
- `justify/install.sh` - `replace_placeholder_atomically`, symlink drop before the heredoc
- `lotus/install.sh` - `replace_placeholder_atomically`, symlink drop before the cp
