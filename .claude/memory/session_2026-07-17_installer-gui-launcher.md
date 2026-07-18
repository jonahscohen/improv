---
name: install.sh --gui launcher
description: --gui flag starts the localhost GUI server, opens the browser, blocks foreground until Ctrl-C
type: project
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 4 of the GUI-installer plan (branch gui-installer). Added the `--gui` launcher to
install.sh so `./install.sh --gui` (and `ampersand --gui`, which forwards flags) starts the
localhost GUI server and opens the browser.

Changes:
- install.sh: `RUN_GUI=0` default beside RUN_MANIFEST/RUN_APPLY_PLAN.
- install.sh: arg-parser case `--gui) RUN_GUI=1; shift ;;` after `--apply-plan)`.
- install.sh: `--help` line for `--gui`.
- install.sh: `--gui` handler before the `_AMPERSAND_APPLY_TEST` seam. Starts
  claude/installer-gui/server.py in the background, waits up to ~5s for the URL file,
  prints "GUI installer running at <url>", opens the browser (unless AMPERSAND_GUI_NO_OPEN=1),
  then `wait`s on the server (foreground; Ctrl-C stops). INT/TERM trap kills the child server.
  It owns its lifecycle and `exit 0`s - does NOT fall through to the interactive browser.
- claude/hooks/test-installer-gui-launch.sh (new): runs the launcher headless
  (AMPERSAND_GUI_NO_OPEN=1) in the background, polls stdout for the launcher's URL line,
  curls /health at that host:port asserting 200 + bind 127.0.0.1, and tears down both the
  launcher and its child server by tracked PID (no blanket pkill, so a concurrent GUI-server
  test is never disturbed).

Why: the GUI installer needs a one-command entry that a non-technical user can run; the flag
reuses the already-landed server.py (Task 3) which reuses --manifest/--apply-plan (Tasks 1-2).

How verified: test-installer-gui-launch.sh PASS (3/3), exit 0, no stray server after
(`pgrep -f installer-gui/server.py` empty). No-regression: test-installer-manifest.sh,
test-apply-plan.sh (33/33), test-installer-gui-server.sh (6/6) all exit 0. `bash install.sh
--help` exits 0 and lists --gui. `bash -n install.sh` clean.

Codex cross-model review (real verdict, 92.8s, exit 0):
- High FOLDED: `--dry-run --gui` violated the global dry-run contract - the GUI server is a
  mutating surface (its /apply route runs `install.sh --apply-plan` for real), and my new
  handler ignored DRY_RUN while every other entry honors it. Added a DRY_RUN guard at the top
  of the --gui block: prints a notice and exits 0 without launching. Verified: `--dry-run
  --gui` exits 0 and starts no server.
- Medium NOT FOLDED (out of scope by design): `--gui --personal` drops personal mode because
  the server shells `install.sh --manifest`/`--apply-plan` without --personal. This is the
  pre-existing, documented Tasks 1-2 decision (apply-plan excludes personal buckets
  unconditionally; "full personal support is out of scope for this entry"). Forwarding
  --personal would require editing server.py (off-limits this task) and the apply_pending
  executor, and still would not apply personal components end-to-end.

Files touched: install.sh, claude/hooks/test-installer-gui-launch.sh.
