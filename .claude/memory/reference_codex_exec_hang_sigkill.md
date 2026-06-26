---
name: reference_codex_exec_hang_sigkill
description: codex exec review subprocesses wedge intermittently; detect via elapsed-vs-CPU, kill with SIGKILL (plain timeout/SIGTERM won't kill a wedged session)
type: reference
relates_to: [session_2026-06-24_sidecoach-m1-verified-decouple-decision.md]
---

During the Sidecoach Stage-1 work (2026-06-24), `codex exec` cross-model review subprocesses WEDGED twice (once for ~2h before detection, once caught at 5min). Pattern + fix, reusable:

## Detection: elapsed-vs-CPU
A wedged codex exec is ALIVE but blocked on a backend response: `ps -o pid,etime,time,stat -p <pid>` shows large ELAPSED, ~0 CPU TIME (e.g., 0.03s), STAT S (sleeping). RULE: any review/collect subprocess alive for minutes with ~0 CPU is hung by definition. Check elapsed-vs-CPU; do NOT wait on it indefinitely (the first one cost ~2h of idle).

## Kill: SIGKILL, not SIGTERM
A wedged codex exec IGNORES SIGTERM. So:
- `kill <pid>` (SIGTERM) does NOT kill it.
- `timeout 240 codex exec ...` does NOT help - default `timeout` sends SIGTERM at the deadline, which the wedged process ignores, so it survives past the bound (observed: 5:10 elapsed despite a 240s bound).
- USE `kill -9 <pid>` (SIGKILL) to kill an already-wedged one.
- BOUND new ones with `timeout -s KILL 240 codex exec ...` (or `timeout -k 10 240 ...`) so the deadline sends SIGKILL and a wedged session actually dies.

## Trigger correlation: stdin redirect wedges; positional arg works (2026-06-24, 2nd session)
A later run reproduced the wedge with a SPECIFIC trigger: `codex exec --skip-git-repo-check < input.txt` (prompt piped on STDIN) wedged hard - 0 bytes out, ~0 CPU, ~60s, needed SIGKILL (exit 137). Re-running the SAME prompt passed as a POSITIONAL ARG instead - `codex exec --skip-git-repo-check "$(cat input.txt)"` - started producing output in seconds and completed clean (exit 0). So: do NOT feed the prompt via stdin redirect; pass it as the positional argument. (codex exec likely still tries to read/interact with a tty on stdin when no positional prompt is given, and a redirected non-tty stdin hangs it.) Watch a real run with `ps -o etime=,%cpu= -p <pid>` against the SPECIFIC pid (a generic `pgrep -f codex/codex` can match an old stray and mislead). Note: macOS has no `timeout`/`gtimeout` by default, so bound via a manual watchdog (background the job, poll the pid, SIGKILL if 0-CPU past a threshold). Also: the review TEXT lands in whatever file you redirect codex's stdout to; the backgrounded wrapper's own `echo EXIT $?` lands in the task-output file - read the redirect target, not the task output, for the actual review.

## NOT-wedged-just-slow: gpt-5.5 + xhigh on big input (2026-06-25)
Before declaring a wedge, rule out SLOW. `~/.codex/config.toml` now defaults to `model = "gpt-5.5"` + `model_reasoning_effort = "xhigh"`. On a 281KB diff that combo produced the full config banner + echoed the whole prompt, then sat for 300s with NO findings - looks wedged, is actually reasoning. Two fixes that made it complete: (1) SHRINK the input - a closure review doesn't need the pure-deletion hunks; exclude deleted files from the diff and append only the NEW file contents (281KB -> 107KB here). (2) Lower effort: `codex exec -c model_reasoning_effort=high ...` (xhigh is overkill + slow for review). A trivial-prompt SMOKE TEST (`codex exec "Reply SMOKE_OK"`, /dev/null stdin) returning fast confirms codex itself is healthy and the big run is just slow, not broken.

## Watchdog without `timeout`: a python wrapper (2026-06-25)
Since macOS lacks `timeout`/`gtimeout`, the cleanest bound is `subprocess.run([...], input=diff_bytes, timeout=N)` in a tiny python3 wrapper - `subprocess` SIGKILLs the child on `TimeoutExpired` (the SIGKILL this beat requires), and you can pass the prompt as the positional arg + the diff as `input=` (codex appends it as a `<stdin>` block; a positional prompt is present so it does NOT hit the stdin-tty wedge above). Wrapper lives at scratchpad/codex-run.py during the convergence work.

## Fallback when it keeps wedging
If a bounded retry also wedges, the Codex backend is flaky - stop fighting it. For a self-contained, well-tested unit (calibration fixtures + an independent lead gate), document "Codex review deferred: backend wedged; calibration + lead gate cover this unit" and proceed. Don't burn hours on the cross-model gate when other independent verification exists. (Verification Protocol item 8 wants the cross-model pass for substantial code; a repeatedly-wedging backend is an infra outage, not a reason to block indefinitely.)
