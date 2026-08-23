---
name: test-component-browser stale justify-hook assertions fixed
description: Two failing assertions in test-component-browser.sh were stale after justify gained a 5th hook (justify-watcher-guard); fixtures updated to match the real registry
type: project
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Fixed the two failing assertions in `claude/hooks/test-component-browser.sh` (was 145 passed / 2 failed on a clean checkout; now 147 passed / 0 failed, exit 0, `bash -n` clean). Stamped against HEAD 311730e7.

Both failures were genuinely STALE, not regressions: `justify` gained a 5th hook, `justify-watcher-guard`, and the two hook-count-sensitive fixtures still enumerated only the original 4.

**Proof the current registry is correct (checked before editing anything):**
- `claude/hooks/justify-watcher-guard.sh` exists on disk (executable).
- `install.sh:7965` declares justify owning exactly 5 hooks in this order: `justify-source-guard.sh justify-watch-guard.sh justify-watch-standing-by.sh justify-queue-drain-stop.sh justify-watcher-guard.sh` (matched at :4096 deactivate and :2066/:8136 banners).
- `browser-tree.json` `hook_desc` has a full description for `justify-watcher-guard`, and the `justify/Hooks` node lists all 5 in tree order.

**Failure 1 - test #18 (line 772), "apply_pending_plan multi-hook off-list .sh suffix".**
Staging `justify-source-guard` install makes apply_plan emit justify's OTHER hooks as the off-list, each with `.sh`. That off-list is now the other 4, so actual output ends `...justify-queue-drain-stop.sh justify-watcher-guard.sh`. Expected string only had 3. Fix: appended `justify-watcher-guard.sh`. This is exactly the coupling the in-file comment (lines 765-770) demands: "If justify gains a hook, this expectation must grow with it."

**Failure 2 - test #8 (line 592/595), "stage_all install clears opposite pending".**
Intent: with justify fully installed, staging an uninstall of one hook then `stage_all justify install` clears the opposite pending back to 0. The fixture's INSTALLED string omitted `justify-watcher-guard`, so it read as OFF; `stage_all install` then staged it as a FRESH install, leaking `PENDING_INSTALL=|justify/Hooks/justify-watcher-guard|` -> `pending_under=1`. Fix: added `justify/Hooks/justify-watcher-guard|` to the fixture so all 5 justify hooks are already-installed and install-all has nothing new to stage -> pending clears to 0 (reproduced live).

**Why stale, not a fix-to-green:** the registry legitimately grew the hook (disk + install.sh + tree all agree); the test fixtures were the thing left behind. Proved the correct current values by sourcing `browser-lib.sh` with the harness's `BR_STATE_PROBE=fake_probe` injection and replaying each scenario before touching the expected strings.

**Scope:** touched ONLY `claude/hooks/test-component-browser.sh`, exactly 2 lines (2 insertions, 2 deletions). Left the passing test #16 fixture at line 756 untouched - its uninstall-only path only stages what is ON, so the missing 5th (OFF) hook never affected it. No commit made.

Files touched:
- claude/hooks/test-component-browser.sh (lines 592, 772)
