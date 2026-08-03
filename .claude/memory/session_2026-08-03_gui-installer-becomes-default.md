---
name: The GUI installer is the default now; --cli (and --browser) opt back into the terminal
description: Direct order - "I want to change the default installer to this [installer-gui]. Then make 'ampersand --cli' the alternative view for people who want to stay in terminal." install.sh already had a fully-working --gui flag; this promotes it to the default and moves the terminal bucket browser behind --cli, keeping --browser as a backward-compatible alias since a whole PTY test suite depends on that flag meaning "terminal."
type: project
relates_to: [session_2026-08-03_review-changes-page.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: bash -n install.sh and python3 ast-parse server.py both clean; test-installer-gui-launch.sh extended to 4 assertions (bare invocation now also proves it launches the GUI server) - 4/4 pass; test-component-browser.sh 147/0, test-apply-pending.sh 33/0, test-installer-gui-server.sh 6/0, test-installer-manifest.sh pass, all unchanged; manually confirmed --cli enters the terminal splash/bucket-browser (not the GUI) and --dry-run alone still falls through to the picks summary untouched; confirmed install.sh --gui --personal now surfaces the Personal bucket through /manifest (and install.sh --gui alone correctly omits it) after the codex-review fold below; test-browser-render.sh's flakiness (2-5 failures per run, varying content) reproduced identically on the clean pre-change baseline via git stash, confirming it is pre-existing and unrelated to this change
confidence: high
---

# Swapping the default entry point (2026-08-03)

Jonah: "I want to change the default installer to this. Then make 'ampersand --cli'
the alternative view for people who want to stay in terminal."

## Nothing to build for the GUI side - it already existed

`install.sh --gui` was already a complete, working launcher: starts
`claude/installer-gui/server.py` on an ephemeral localhost port, waits for its URL,
opens it with macOS `open`, blocks in the foreground until Ctrl-C. The actual task was
entirely about which code path a BARE invocation takes, not building a new one.

## The promotion, not a rewrite of either path

Added one variable (`FORCE_CLI`) and one small block right after the flag-parsing
loop:

```sh
if [[ "$NONINTERACTIVE" == "0" && "$DRY_RUN" == "0" && "$RUN_GUI" == "0" && "$FORCE_CLI" != "1" ]]; then
  RUN_GUI=1
fi
```

This reuses the existing `--gui` block verbatim rather than duplicating its logic -
a bare invocation now just looks like `--gui` was passed, by the time execution
reaches that block. `--manifest`, `--apply-plan`, `--prune-skills[-apply]`,
`--verify-skills`, `--help` are all standalone actions positioned earlier in the file
that exit unconditionally on their own flag, so none of them are affected by this
promotion running underneath them.

## --browser couldn't be repointed to the GUI - an existing test suite owns its meaning

The natural read of "the browser is now the default, so passing --browser should
launch it" is wrong here: this codebase already used "the browser" as its name for
the TERMINAL bucket-browser TUI, well before installer-gui existed (a real web
browser). `--browser` was already an accepted, documented, INERT synonym for "pass
nothing" - and `test-browser-render.sh`, a 750+-line PTY-driven suite, drives
`install.sh --browser` under a pty expecting exactly that terminal experience.
Repointing `--browser` to the new GUI default would have broken that entire suite's
premise and silently changed the meaning of a flag with, per the code's own comment,
real "muscle memory" behind it.

Resolved by making `--browser` an alias for the new `--cli` flag instead of a no-op -
it keeps meaning exactly what it always meant (the terminal experience), it just now
has to ask for it explicitly rather than getting it by default. `--cli` is the
clearer, newly-named way to ask for the same thing.

## Verifying the negative and positive cases directly, not by inference

- Extended `test-installer-gui-launch.sh` with a 4th assertion: a bare
  `AMPERSAND_GUI_NO_OPEN=1 bash install.sh` (no flags) now ALSO prints the "GUI
  installer running at..." line and answers `/health` - real end-to-end proof the
  default switched, not just a read of the flag-parsing logic.
- Manually smoke-tested `--cli`: backgrounded it, confirmed it stayed alive
  (interactive, waiting on input) and printed the same red ASCII-art splash and
  "Checking for updates..." line the terminal browser always has, with NO "GUI
  installer running" line - confirms it takes the terminal path, not GUI.
- Manually smoke-tested `--dry-run` alone: still falls through to the picks summary
  and prints "no files were touched", unaffected by the new promotion logic (which
  only fires when `DRY_RUN=="0"`).

## Codex review, folded (two real findings)

Ran `codex exec --sandbox read-only` directly against the diff before calling this
done. Two real findings, both fixed and re-verified rather than just patched:

- **HIGH - the promotion hijacked an existing test-only seam.** `test-apply-pending.sh`
  drives `install.sh` through an internal seam gated on the env var
  `_AMPERSAND_APPLY_TEST=1`, invoked as a genuinely bare `bash "$INSTALL"` with no
  flags at all. That seam sits BELOW the `--gui` dispatch block in the file, so once
  a bare invocation got promoted to `RUN_GUI=1`, the real GUI server would start and
  block (`wait $gui_pid`) before the test seam was ever reached - the test would hang
  or silently spawn a live server instead of running its intended lightweight
  function call. Reproduced directly (not just taken on the review's word): traced
  the exact invocation line in `test-apply-pending.sh`, confirmed it has no flags,
  and confirmed the seam's own block sits after `--gui`'s in file order. Fixed by
  adding `&& "${_AMPERSAND_APPLY_TEST:-}" != "1"` to the promotion's own condition,
  mirroring the guard the seam already uses on itself. Re-ran `test-apply-pending.sh`
  after the fix: 33/33 passed, no hang. Swept for any other similar env-var-gated
  seam that bypasses normal flag parsing (`grep -n '_AMPERSAND_[A-Z_]*:-' install.sh`)
  - found only `_AMPERSAND_HOOK_OFF` (reads a deselection list, not an entry-point
    switch) and `_AMPERSAND_NO_SUMMARY` (gates a print at the very end of the file,
    long after any interactive/GUI block would already have exited) - neither is a
    competing entry path, so this was the only instance of the bug class.

- **MEDIUM - `--personal` never reached the GUI's own subprocess calls.** `--gui`'s
  server (`claude/installer-gui/server.py`) is a SEPARATE process from the launcher;
  every manifest/apply-plan/dry-run call it makes is a fresh `bash install.sh ...`
  subprocess that never saw the original invocation's `--personal` flag (which only
  ever set an in-process `PERSONAL=1` in the launcher's own bash). This has been true
  since `--gui` was first built - genuinely pre-existing, not introduced by this
  diff - but promoting GUI to the DEFAULT is what makes it reachable by a plain
  `--personal` with no other flags, where before you would have had to deliberately
  combine `--gui` and `--personal` to hit it. In scope to fix here because this
  change is exactly what makes it common. Fixed on both ends: `server.py` gained a
  `--personal` argparse flag stored on `State.personal`, and its `install_sh()`
  helper now appends `--personal` to every subprocess call when that's set;
  `install.sh`'s `--gui` block now forwards `--personal` to the server launch
  whenever the original invocation's own `PERSONAL` was `1`. Verified both directions
  live: `install.sh --gui --personal`'s `/manifest` route includes a `"Personal"`
  bucket; `install.sh --gui` alone (no `--personal`) correctly omits it.

## test-browser-render.sh's flakiness - investigated, not fixed

Three consecutive runs produced three different failure counts (2, then 5, then 5
again) with different specific rows failing (a missing "Tilt-lab" row on one run,
"never reached Beats/Hooks" on another). Rather than assume this was caused by the
install.sh edit, stashed it and re-ran the SAME suite against the clean, unmodified
baseline: it failed too, with yet a third distinct count (3) and different specifics.
This is pre-existing PTY-timing flakiness in the test file itself, confirmed via the
Debugging Protocol (reproduce against a known-clean state before hypothesizing about
the change) rather than assumed from a single failing run. Left alone - out of scope
for this task, and not a regression this change introduced.

## Files touched

- `install.sh` (`FORCE_CLI` var added; `--cli` flag added; `--browser` case changed
  from an inert shift to setting `FORCE_CLI=1`; default-to-GUI promotion added right
  after the flag-parsing loop, guarded against `_AMPERSAND_APPLY_TEST`; `print_help()`
  usage text rewritten for the new default and `--cli`; the terminal-browser block's
  header comment and its own `if` condition updated to require `FORCE_CLI=="1"`
  explicitly, and its "does NOT fall through to the interactive browser" comment
  corrected to "terminal browser" now that "browser" alone is ambiguous between the
  two; `--gui` block now forwards `--personal` to the server launch)
- `claude/installer-gui/server.py` (`State.personal`, a `--personal` argparse flag,
  and `install_sh()` now appends `--personal` to every subprocess call when set)
- `claude/hooks/test-installer-gui-launch.sh` (4th assertion added: a bare
  invocation also launches the GUI; cleanup extended to track a second
  launcher/server PID pair)
