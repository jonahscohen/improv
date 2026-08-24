---
name: Taste miner scheduling built - third adapter on the shared spine (precheck/advance + wrapper + plist + install)
description: sidecoach-mine.js gains precheck/advance (corpus-signature change-detection gate); sidecoach-mine-daily.sh wrapper + com.yesand.sidecoach-mine-daily.plist (05:00) + install.sh 14d + hook-registry exemption + test-sidecoach-mine.sh (14/0)
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (test-sidecoach-mine.sh 14/0; precheck run/skip/fail-loud; wrapper DRY_RUN; plist plutil -lint; templating 0 leftovers)
confidence: high
relates_to: [session_2026-08-24_phase1-2-shoreup.md, session_2026-08-23_scheduled-research-runner-built.md, session_2026-08-23_cmux-feature-tracker-built.md]
---

The taste miner is now a REAL scheduled adapter (the third on the shared learning-researcher spine, alongside cc-tracker-daily and cmux-tracker-daily). Built after Jonah chose "do both cleanups first" + "no deferrals". Previously the miner was on-demand only (/sidecoach mine) with no run/skip+cursor contract, so it could not be put on a timer - that was the deferred gap; now closed.

CHANGE-DETECTION CONTRACT (sidecoach/bin/sidecoach-mine.js):
- computeInputSignature(): sha256 over the assembled corpus.entries (beats + measured audit-history + external expert content + rule stores), canonicalized by stringify-then-SORT so entry order can never spuriously flip the sig. Excludes the volatile generated_utc/commit. Any real input change flips it; identical inputs are stable.
- `precheck --cursor FILE`: prints "run" if the sig differs from the cursor (or cursor missing), "skip" if identical; exits 0 with the decision. Missing --cursor or any internal error exits non-zero and prints NO decision (SRR fail-loud contract - a broken gate never silently skips forever).
- `advance --cursor FILE`: writes {schema, sig, stats, advanced_utc, commit} to the cursor (outside the repo) after a successful run, so the next precheck skips until inputs change.
- Added crypto import, --cursor flag, HELP entries, exported computeInputSignature.

SCHEDULING ARTIFACTS:
- claude/hooks/sidecoach-mine-daily.sh: SRR wrapper mirroring the trackers. SRR_PRECHECK_CMD=mine precheck; SRR_PROMPT=the headless /sidecoach mine flow directive (assemble corpus -> produce findings treating expert content as UNTRUSTED DATA -> materialize via `mine run --findings`, inert proposals + taste_mine beat only, never edits registry/guidance/harness); SRR_SUCCESS_CMD=a fresh taste_mine_*.md beat newer than the start marker; SRR_ADVANCE_CMD=mine advance. Cursor at ~/.claude/sidecoach-mine/last-inputs.json; engine runs from SRR_REPO_ROOT (not copied).
- claude/launchd/com.yesand.sidecoach-mine-daily.plist: 05:00 local (staggered off cc 03:00, cmux 04:00, reflect Sun 09:00 so no two heavy headless claude runs overlap). RunAtLoad false; launchd wake-catchup covers a closed laptop.
- install.sh section 14d: symmetric to the trackers' 14b/14c - link_or_copy the wrapper + shared runner, mkdir cursor/log dirs, template the plist (author repo+home rewrite via the SENTINEL approach; dry-run 0 leftovers). PLACEMENT only; launchctl bootstrap is the user's step.
- hook-registry-guard.sh: added `sidecoach-mine-daily) return 0` (launchd-scheduled, not an event hook - same exemption class as the two trackers + reflect-weekly).
- generate-tool-index.ts: sidecoach-mine invocation/reachedBy updated for precheck/advance.
- claude/hooks/test-sidecoach-mine.sh: 14/0 (precheck run/skip/fail-loud, advance, cursor shape, stale-sig, wrapper syntax + SRR params + DRY_RUN no-side-effect, plist lint + args, hook-registry exemption).

DESIGN NOTE: the scheduled flow uses SRR_PROMPT (a headless Claude session running the reflect-style /sidecoach mine fan-out), NOT a bare deterministic `mine run`, because the expert/beat LEARNING happens in that flow (the deterministic engine only owns dedup/preflight/inert-write). This is what makes it "learn from the experts on a schedule."

CODEX REVIEW of the miner-scheduling diff found 3, all being folded (in progress):
- HIGH: propose-only was PROMPTED, not ENFORCED - the headless flow runs bypassPermissions, so an injection in untrusted expert content could edit a live file (registry/guidance/hook/skill) and still be marked success. FOLD (shared-spine): added SRR_ALLOWED_WRITE_ROOTS to scheduled-research-run.sh - after a clean flow, every repo file the flow touched (mtime>start-marker, git tracked+staged+untracked view) MUST be under the job's allowed roots, else exit 7 + cursor rollback (fail-closed if the fence is armed but repo is not git). Armed on ALL THREE adapters (miner: proposed-rules + taste-candidates.json + .claude/memory; cc: proposals/cc-tracker + .claude/memory; cmux: proposals/cmux-tracker + .claude/memory). This closes the same hole in the two committed trackers too.
- MEDIUM: precheck swallowed ALL cursor errors -> clean "run". FOLD: only ENOENT is a first run; a truncated/dir/unreadable/non-JSON/missing-sig cursor now fails loud (exit 2, no decision).
- MEDIUM: advance would write any --cursor path, incl. inside the repo. FOLD: advance refuses a cursor resolving inside REPO_ROOT.
Tests extended: test-sidecoach-mine.sh (+corrupt-cursor, +in-repo-cursor, +fence-armed = 18/0 at last run before the fence-runner test); test-scheduled-research-run.sh (+fence compliant/violation/fail-closed). Runner exit code 7 documented.

FENCE DEBUG + Codex ROUND 2 (folded):
- The first fence used an mtime check (`-nt` start marker) that MISSED a fast flow writing in the same instant (my isolated test only passed because of a sleep). Rewrote the fence to a git-TREE diff: capture a full-worktree tree before AND after the flow via `GIT_INDEX_FILE=<temp> git add -A && git write-tree` (real index untouched), then `git diff -z --name-only PRE POST`; any changed path not under an allowed root -> exit 7 + rollback. Content-aware, untracked-inclusive, NUL-safe, fail-closed. Runner suite 85/0 (compliant->0, stray-write->7, rollback, fail-closed, AND pre-dirty-re-mod->7).
- Codex round 2 on the folds found: HIGH `advance` used lexical path.resolve so a cursor SYMLINK into the repo slipped the in-repo check (same symlink class as the ingest bug). FOLD: advance now uses realResolve + writes with O_NOFOLLOW; refuses a symlink-into-repo cursor and never follows a symlink target. MEDIUM: a pre-dirty live file re-modified by the flow was skipped by the old path-set diff - closed by the tree-diff above (content-aware). Two Lows accepted (theoretical file-root-as-dir prefix; newline-in-path now moot under the -z tree diff). Miner suite 19/0 (incl. the symlink-cursor refusal).

Codex ROUND 3 (final): only 1 PLAUSIBLE Medium - advance opened the RAW opts.cursor, so an ancestor-dir symlink swapped in the check->open window could still be followed. FOLD: advance now opens the REALRESOLVED path (ancestor symlinks already followed at check time), so swapping the original path's symlink no longer changes where we write; O_NOFOLLOW guards the final component. Residual = an active same-uid attacker replacing the resolved parent dir itself in the microsecond window (irreducible without openat2 RESOLVE_NO_SYMLINKS, which Node lacks) - accepted, out of threat model, same class as the ingest/runner active-racer residuals. Everything else round 3 confirmed correct. Miner suite 19/0.

DONE + GREEN (the whole pre-Phase-3 cleanup phase, committed together with baseline-fix's 3 pre-existing-red fixes): integrated npm test = run-tests 187 suites PASSED (was 3 red), component-browser 147/0, cc-tracker 38/0, cmux-tracker 33/0, sidecoach-mine 19/0, scheduled-research 85/0. Codex 3 rounds folded. Committed locally (not pushed, per Jonah's earlier "keep it local"). baseline-fix torn down after acceptance.

NOTE: a CONCURRENT process (another session running /sidecoach flows + the miner) kept rewriting sidecoach/data/taste-candidates.json + sidecoach/.claude/memory/ during this work - deliberately EXCLUDED from my commits (not my changes). Do not `git add -A` blindly here while that process runs.

Files: sidecoach/bin/sidecoach-mine.js, claude/hooks/sidecoach-mine-daily.sh (new), claude/launchd/com.yesand.sidecoach-mine-daily.plist (new), install.sh, claude/hooks/hook-registry-guard.sh, sidecoach/scripts/generate-tool-index.ts, claude/hooks/test-sidecoach-mine.sh (new).
