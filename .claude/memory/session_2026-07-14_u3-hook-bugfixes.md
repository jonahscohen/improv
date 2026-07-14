---
name: Unit 3 hook bug fixes (arm re-arm, /dev/null misclass, fail-closed beats compile)
description: TDD fixes for three hook bugs unblocking the beats cutover; branch w1-u3, parallel-dispatch unit
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + codex-review (five passes; (c) concurrency redesign + cross-hook race confirmed clean)
confidence: high
---

Unit 3 of the parallel dispatch plan, executed in worktree improv-wt/u3 on branch
w1-u3 off 7eb21eca. Three hook bugs, each fixed TDD (failing test first, then fix).

NOTE ON SCOPE: this beat records only Unit 3. MEMORY.md was deliberately NOT
updated - a parallel-dispatch unit must not mutate the shared index (every unit
appending to MEMORY.md would collide at merge). Index consolidation is the
orchestrator's job after merge.

(a) verify-before-done.sh arm-side re-arm bug.
Why: the Bash arm side matched write tokens (cp/mv/>/tee/sed -i) with NO file-type
filter, unlike the Write/Edit arm side which uses is_code_file. So a markdown-only
Bash write (sed -i notes.md, cp draft.md final.md) re-armed ~/.claude/.needs-verification
right after a browser verification cleared it.
How: split indicators into DEPLOY/BUILD (node build, npm run build, npx, make -> always
arm) vs FILE-TARGET writes (cp/mv/>/>>/tee/sed -i -> extract filename-shaped tokens,
arm only if any is a code file per is_code_file). A code file present only as a READ
source (cp src/a.ts notes.md) still arms - the preferred false-positive direction for
an enforcement gate (feedback_hooks_prefer_false_positives); precise write-target
parsing would risk false negatives. Gotcha: the python body is inside python3 -c '...'
(bash single-quotes) - the separator regex class is built via chr(39)/chr(34) so no
literal single quote breaks the shell string (hit this bug once mid-implementation).

(b) memory-nudge.sh /dev/null redirect misclassification.
Why: a read-only command redirected to the null device (beats.py verify > /dev/null 2>&1,
rg foo > /dev/null) matched the "> " write token and falsely set ~/.claude/.memory-dirty
at pull time.
How: strip exact null-device redirects from a scan copy before the write-token match
via (?:\d*|&)>>?\s*/dev/null(?![\w./-]); the negative-lookahead keeps a real named path
(> /dev/null.log, > /dev/nullx) dirtying. Added rg to the read-only prefixes. Dropped a
proposed fd-dup strip (2>&1) - it was a no-op (2>&1 never contained a "> "/">>" token)
that Codex flagged as risking real ">& file" writes.

(c) beats-staleness-guard.sh stale-on-pull only WARNED; made it fail-CLOSED.
Why: on a stale index it kicked a background rebuild and trusted the stale index in the
meantime - the beats cutover needs the session to serve a fresh (or loudly-flagged) index.
How: on verify exit 6, compile_on_drift() compiles SYNCHRONOUSLY and reacts to the result.
Safety rules all enforced: (1) single-compiler lock is a RACE-FREE bare mkdir with NO
stealing - a held lock fails CLOSED (same loud warning, does not trust/wait/steal); (2)
compile into a temp build dir seeded from the live db (incremental reuse), then atomically
mv into place, db LAST as the effective commit point (search+verify key off the db, so a
crash between the two moves reads as STALE next time, never silent-fresh); (3) compile
fail/timeout -> leave stale index untouched, warn LOUDLY, never claim fresh; (4) dirty index
worktree -> refuse to auto-mutate, warn. Post-install the guard re-runs verify and only
claims FRESH when it returns 0. Bounded by BEATS_COMPILE_TIMEOUT (default 90, clamped 300);
every path still exits 0 (session start never fails). Env seams: BEATS_COMPILE_TIMEOUT,
BEATS_COMPILE_CMD, BEATS_GUARD_FORCE_DIRTY.

(c) REDESIGN after coordinator+Codex rejected v1 for real concurrency bugs (two High):
- v1 stale-lock STEALING had a TOCTOU hole: two waiters both judge the lock stale; A does
  rm+mkdir a fresh lock, then B's already-decided rm deletes A's fresh lock -> two compilers.
  FIX: removed stealing entirely. Lock = bare mkdir only. On mkdir fail -> fail-closed warn
  ("being refreshed by another session; UNRELIABLE until complete; do NOT trust it"), exit 0.
  A crashed-compiler lock persists and warns every session until a human runs beats.py compile
  or removes the named lock dir (documented; simplest correct, race-free).
- v1 timeout killed only the WRAPPER pid; a backgrounded grandchild outlived the budget AND
  kept the SessionStart hook's stdout pipe open (observed: guard "returned" but $() stalled
  ~10s). FIX: run_compile_bounded launches the compile via `python3 -c 'os.setsid();
  subprocess.call(["bash","-c",cmd])'` (new process-group leader, pgid==pid) with stdout/err
  to /dev/null; on timeout kill -KILL -pid (whole group) + kill -KILL pid (leader). wait still
  propagates the compile exit code. Verified by a test whose backgrounded child touches a
  marker AFTER the budget - marker stays absent (group killed).
- Mediums folded: db-last comment now states the db swap is the effective commit point and
  why a single-dir atomic rename is not used (build dir holds live log+lock). memory-nudge:
  also strip `tee /dev/null` (sole-sink only, via a lookahead - `tee /dev/null out.txt` still
  dirties). verify-before-done: one-line comment that .json/config out of CODE_EXTS is
  intentional (a package.json write is not itself a visual change).
Concurrent-start behavior (demonstrated live): A grabs the lock and compiles -> FRESH; B,
concurrent on the same stale index, sees the held lock -> fail-closed warn, no compile, no
steal, no trust. Codex re-review (3rd pass) CLEAN on the guard; confirmed TOCTOU gone,
group-kill correct, db-last no silent-fresh, all paths exit 0 under set -u, EXIT trap owner-only.

(c) CROSS-HOOK RACE (final round; coordinator+Codex found it looking ACROSS hooks). Adding
the guard compiler exposed that beats-rebuild.sh is a SECOND compiler: it used a DIFFERENT
lock ($BUILD_DIR/.lock) and compiled directly into the live $BUILD_DIR, so guard and rebuild
did NOT exclude each other - a background rebuild from an older corpus snapshot could land
after the guard's post-install verify + FRESH and re-stale the live db. Fixes (now own
beats-rebuild.sh, 7th file):
- UNIFIED lock: both hooks acquire the SAME mkdir lock $BUILD_DIR/.compile.lock before
  compiling (guard COMPILE_LOCK; rebuild LOCK, also its debounce/single-runner lock). Only
  one compiler ever runs. rebuild can't get it (guard compiling) -> enqueue sets .dirty and
  defers, spawns no runner. guard can't get it (rebuild compiling) -> fail-closed-warn.
- rebuild now compiles into a TEMP dir (.rebuild-compile.$$) then atomic-moves jsonl then db
  (db LAST) into the live dir, only on success with both artifacts; a stub/failed compile
  installs nothing. Mirrors the guard's install - no reader sees a half-written index.
- DRAIN (Codex-found residual the unification introduced): a write DEFERRED during a guard
  compile set .dirty but could not spawn a runner, and the guard (unlike a rebuild runner)
  did not loop on .dirty, so it stranded until a later write/session. FIX: after releasing
  the shared lock (success-lock path only), if .dirty exists the guard kicks
  `beats-rebuild.sh --enqueue` (idempotent, non-blocking) to hand the deferred work to the
  background rebuild. Gated on .dirty so a clean compile never kicks a redundant rebuild.
Tests: case17 (rebuild defers under a held shared lock, no concurrent compile), case18
(rebuild installs an atomic consistent index), case19 (deferred .dirty drained, not
stranded); case15 reframed to the shared lock (guard fail-closes). Cross-hook exclusion
demonstrated live (both directions). Codex passes 4+5 CLEAN (no findings): shared lock path
matches exactly, temp+move db-last, stub moves nothing, drain closes the strand with no
new race/loop/storm, all paths exit 0.

Verification: TDD red-then-green on each. Final suites green - test-memory-nudge.sh 23/0,
test-verify-before-done.sh 82/0, test-beats-hooks.sh 24/0. Codex reviewed twice: pass 1
raised 3 findings (folded F2 /dev/null bound, F3 pair-atomic install -> post-install verify
gate; F1 read-only-redirect judged by-design); pass 2 confirmed F2/F3 resolved + F1
defensible, raised the read-source-arms FP which is the intended preferred-FP direction.

Files touched (Unit 3 owned set - 7 files after the cross-hook grant):
- claude/hooks/verify-before-done.sh
- claude/hooks/memory-nudge.sh
- claude/hooks/beats-staleness-guard.sh
- claude/hooks/beats-rebuild.sh          (granted final round for the cross-hook lock unify)
- claude/hooks/test-memory-nudge.sh
- claude/hooks/test-verify-before-done.sh
- beats/_tests/test-beats-hooks.sh
