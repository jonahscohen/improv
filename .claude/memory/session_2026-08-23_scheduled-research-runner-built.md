---
name: Scheduled-research runner (shared spine) BUILT + tested
description: The generic launchd runner claude/hooks/lib/scheduled-research-run.sh that all three learning-researchers (taste miner, CC tracker, cmux tracker) reuse - parameterized gate/watchdog/cursor spine cloned from beats-reflect-weekly; discover-and-propose only, never edits the repo. Plus a plist template. 45/45 contract tests green.
type: project
relates_to: [session_2026-08-23_learning-researcher-framework-plan.md, session_2026-08-23_self-updating-taste-pipeline-design.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests - test-scheduled-research-run.sh 45/45 green; bash -n clean; plutil -lint clean; live no-repo-write proof
confidence: high
---

# Scheduled-research runner built (the shared learning-researcher spine)

Collaborator: Jonah. Built as an executor teammate on the team-lead's spec; relayed to team-lead for the
independent review the lead said to expect (this beat records the build + self-verification, not acceptance).

## What was built (3 files, nothing else touched)
- `claude/hooks/lib/scheduled-research-run.sh` - the PARAMETERIZED generic runner. Fully gated: it only
  DISCOVERS (runs a headless flow that writes inert proposals) and NEVER edits the repo. Its only writes are
  its own log (~/.claude/logs), its cursor file, and a throwaway temp dir for the run markers.
- `claude/launchd/com.yesand.scheduled-research.plist.template` - the launchd TEMPLATE a specific job
  instantiates (Background ProcessType, RunAtLoad false, StartCalendarInterval catches a missed fire on wake).
- `claude/hooks/test-scheduled-research-run.sh` - 45-assertion contract test in the repo's test-*.sh format.

## Design: parameters via the SRR_* environment (thin-wrapper pattern)
A per-job hook (cc-tracker-daily.sh, etc.) exports the SRR_* params and execs the lib; the plist points at
that wrapper (or the lib directly with SRR_* in EnvironmentVariables). The five spec parameters:
- (a) `SRR_JOB_NAME` - names the log + run markers ([A-Za-z0-9._-] only).
- (b) `SRR_CURSOR_FILE` - the last-seen cursor; touched on complete success; exported to every sub-command.
- (c) `SRR_PRECHECK_CMD` - has-new-signal gate, run via `bash -c`. Contract SHARPENED for fail-loud safety:
  exit 0 -> run; exit 1 -> clean skip (runner 0); exit >=2 -> pre-check itself FAILED -> runner exit 2. The
  spec said "non-zero = quiet no-op"; a pre-check that always errored would then silently no-op forever (a
  silent success on a failure), so >=2 is treated as an error. Aligns with Unix (grep/diff/cmp: 1=no-match,
  >=2=error). Flagged to the lead as a deliberate refinement.
- (d) `SRR_PROMPT` (runner builds `claude -p "<prompt>" --permission-mode bypassPermissions --add-dir <repo>`)
  OR `SRR_FLOW_CMD` (full override, the test-injection path, precedence over PROMPT).
- (e) `SRR_SUCCESS_CMD` - success predicate, run after the flow with `$SRR_START_MARKER` exported; exit 0 =>
  a fresh proposal artifact newer than the start marker exists.
- optional `SRR_ADVANCE_CMD` (content write-back for version-string cursors, run before the mtime touch;
  failure is fatal 6), repo-root resolution, watchdog knobs, DRY_RUN, CLAUDE_BIN.

Why the pre-check owns ALL gating (incl. the no-cursor first-run case): keeps the runner signal-agnostic so
the same spine serves a find-newer beat-count gate (reflect/taste) AND a version-string diff (CC/cmux)
without baking either in. The cursor is advanced two ways on success: always touch the mtime (serves
find-newer jobs) + optionally run SRR_ADVANCE_CMD (serves content cursors).

## Fail-loud exit codes (documented, mirror beats-reflect-weekly)
0 complete success OR clean skip OR DRY_RUN preview; 2 config/pre-check error; 3 claude not found (built
invocation); 4 flow incomplete (non-zero exit, or success predicate found no fresh artifact); 5 watchdog
timeout; 6 produced-but-cursor-could-not-advance (never swallowed). The cursor advances ONLY on a clean,
COMPLETE run - a partial artifact before a hang/non-zero exit is treated as failure, cursor untouched, next
pass retries (the reflect success contract).

## Watchdog (cloned verbatim from the reflect runner)
No timeout(1) on stock macOS: poll every POLL_SECS, at TIMEOUT_SECS write a marker then TERM -> grace ->
group-KILL. The child is launched as a process-group LEADER via `perl setpgrp` so claude's node + sub-agents
are bounded, not orphaned. On timeout the parent lets the watchdog finish its sweep so a TERM-ignoring
descendant is still reached by the KILL.

## Verification (proven, not claimed)
- `bash -n` clean on runner + test; `plutil -lint` clean on the template (integer fields use real defaults,
  03:00; only string fields carry {{TOKENS}}, which plutil accepts).
- `test-scheduled-research-run.sh` = 45 PASS / 0 FAIL, exit 0. Covers: 8 distinct config exit-2 cases (+ no
  flow/cursor side effect), pre-check >=2 -> exit 2, gate skip-when-current / open-when-stale (real
  find-newer gate), DRY_RUN no-side-effects for both the FLOW_CMD and built-PROMPT paths, complete success
  advances the cursor (mtime + content), no-artifact -> 4, flow-nonzero -> 4 (precedence over the predicate),
  advance-cmd-fail + un-writable-cursor -> 6.
- WATCHDOG proven two ways: (1) a self-contained PROCESS-GROUP PHYSICS PREMISE - a single-pid kill of a
  group leader leaves a reparented grandchild ALIVE; only `kill -SIG -pgid` reaps it; (2) the runner given a
  hung flow that spawns a TERM-IGNORING grandchild exits 5, leaves the cursor untouched, and the grandchild
  is dead after the run (elapsed ~3s for TIMEOUT=2 + GRACE=1) - a single-pid kill could not have done that.
- Live no-side-effects proof: a DRY_RUN against a scratch git repo left the repo tree byte-identical and
  created no cursor; the preview showed the correct `cd <repo> && claude -p /demo-track ...` invocation.
- No stray sleep/leader processes leaked (test trap tears down every backgrounded pid).

## Not done (by design / spec)
- Plist NOT installed into launchd (human apply step, per spec). Template only.
- The three per-job wrappers + `/cc-track` `/cmux-track` `/sidecoach mine` flows + staging dirs are separate
  units (this is only the shared spine they call).
- Independent cross-model review is the lead's gate; this beat records build + self-verification.

## Files touched
- NEW claude/hooks/lib/scheduled-research-run.sh
- NEW claude/launchd/com.yesand.scheduled-research.plist.template
- NEW claude/hooks/test-scheduled-research-run.sh
