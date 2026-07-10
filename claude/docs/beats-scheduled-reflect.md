# Scheduled weekly beats reflection

Authored against commit `62b04e7f`. Collaborator: Jonah Cohen.

Re-activates the dormant `reflect` skill as an unattended weekly routine. This is
stage 3 of the beats next-evolution roadmap (`proposal_beats_next_evolution.md`,
"Continuous reflection as a scheduled routine"): schedule the EXISTING skill,
zero new analysis architecture. The proposal measured the need directly: reflect
ran three times in May, then went dormant for ~40 days and ~500 beats despite a
nudge hook, and the one reflection that did run caught a real, costly pattern.

## Pieces

| Path (in repo) | Installed to | Role |
|---|---|---|
| `claude/hooks/beats-reflect-weekly.sh` | `~/.claude/hooks/beats-reflect-weekly.sh` | The scheduled entrypoint (gate + run + timestamp reset). |
| `claude/launchd/com.yesand.beats-reflect-weekly.plist` | `~/Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist` | launchd user agent: Sunday 09:00 local, `RunAtLoad` false. |
| `~/.claude/logs/beats-reflect-weekly.log` | (created at runtime) | The script's own run log (last ~500 lines). |
| `~/.claude/logs/beats-reflect-weekly.launchd.log` | (created at runtime) | launchd's raw stdout/stderr capture (belt-and-suspenders). |

## What a run does

1. **Threshold gate.** Count `.claude/memory/*.md` newer than
   `~/.claude/last-reflect-timestamp`, using the EXACT same `find` and the same
   `MEMORY.md` exclusion as `reflect-nudge.sh`. If the count is below
   `REFLECT_THRESHOLD` (default 15), log `skip: N below threshold` and exit 0. A
   quiet week never burns a 6-agent reflect run.
2. **Run.** At or above threshold, invoke the skill headlessly with cwd set to
   the repo root:
   `claude -p "/reflect" --permission-mode bypassPermissions --add-dir <repo>`.
3. **Success = a new reflection file.** After the run, if a `reflection_*.md`
   newer than the run's start marker exists in the corpus, `touch`
   `~/.claude/last-reflect-timestamp` and exit 0. Otherwise leave the timestamp
   alone and fail loudly.

## The no-double-fire contract (two sides, one timestamp)

The scheduled run and the interactive SessionStart nudge share a single file,
`~/.claude/last-reflect-timestamp`:

- **`reflect-nudge.sh`** (SessionStart) counts beats newer than that timestamp
  and nudges the user when `count >= REFLECT_THRESHOLD`.
- **`beats-reflect-weekly.sh`** gates on the SAME count and threshold, so it only
  runs when the nudge would also have fired. On success it resets the SAME
  timestamp.

The result: a successful scheduled run silences the interactive nudge until the
corpus accrues another `REFLECT_THRESHOLD` beats, and an interactive reflect
(which also resets the timestamp) makes the next scheduled pass a cheap skip.
This is cooperation through a shared timestamp, not a lock: the two paths
coordinate only because they read and reset the same file, and nothing serializes
them. A scheduled Sunday-09:00 run landing at the same instant as an interactive
nudge is a remote-but-real race, not an impossibility. On failure the wrapper
leaves its own touch alone, so the next scheduled pass retries and the nudge
still fires.

The wrapper is also not the SOLE writer of the timestamp: the reflect skill
itself touches `~/.claude/last-reflect-timestamp` as its penultimate step (after
the reflection file has landed, before presenting to the user). So on a fully
successful run the skill may reset the timestamp before the wrapper's own reset
runs; the wrapper's touch is a backstop. Net state stays correct in every traced
case, because the skill only touches AFTER a reflection has landed. Two
consequences follow: the wrapper's exit code can be pessimistic (a run that
produced a reflection but then exited non-zero exits 4 even though the skill may
already have reset the timestamp), and the guarantee "failure never touches the
timestamp" is a statement about the wrapper's OWN touch, not a claim that the
skill left the file untouched.

## Flags chosen for the headless run (and why)

- `-p "/reflect"` - print / non-interactive mode; the prompt invokes the skill
  (the skill is documented as available via `/reflect`).
- `--permission-mode bypassPermissions` - the run is unattended. The skill spawns
  six sub-agents, writes `reflection_*.md`, updates `MEMORY.md`, and touches the
  timestamp via Bash. There is no human present to approve any prompt, so the run
  must not block on one.
- `--add-dir <repo>` - belt-and-suspenders tool access to the corpus under
  launchd; cwd is already the repo root, so this is redundant but harmless.
- **No `--max-turns`** - it is not a flag in the installed claude build
  (`claude 2.1.201`), and a print run self-terminates. Runaway is bounded by a
  wall-clock watchdog instead (see below), which cannot truncate a healthy run
  the way a too-low turn cap would.
- **No `--model`** - inherit the newest configured default; never pin a version.

Add flags for the first live run (or permanently) via `BEATS_REFLECT_EXTRA_ARGS`,
e.g. `BEATS_REFLECT_EXTRA_ARGS="--verbose"`.

## Runaway guard

Stock macOS has no `timeout(1)`, so the script runs claude under a background
watchdog: it polls the child every `BEATS_REFLECT_POLL_SECS` (default 5) and, at
`BEATS_REFLECT_TIMEOUT_SECS` (default 1800 = 30 min), sends SIGTERM then SIGKILL.
The child is launched as its own process-group leader (via `perl setpgrp`, always
present on macOS) and the watchdog signals the whole group (SIGTERM, then SIGKILL
after `BEATS_REFLECT_GRACE_SECS`, default 5), so `claude`'s descendants (node +
sub-agents) are bounded too rather than orphaned. On a timeout the wrapper waits
for the watchdog to finish its full TERM -> grace -> group-KILL sweep before
returning, so a descendant that ignores SIGTERM is still SIGKILLed rather than
left running. A timed-out run exits 5 and does not touch the timestamp.

## Exit codes (fail-loud, never a silent success)

| Code | Meaning |
|---|---|
| 0 | success (complete run + timestamp reset), OR clean skip (below threshold), OR a `DRY_RUN` preview |
| 2 | configuration error (repo root / memory dir unresolvable, or a non-numeric `REFLECT_THRESHOLD` / `BEATS_REFLECT_TIMEOUT_SECS` / `BEATS_REFLECT_POLL_SECS` / `BEATS_REFLECT_GRACE_SECS`) |
| 3 | claude binary not found on the resolved PATH |
| 4 | reflect did not complete: exited non-zero, or produced no new `reflection_*.md` (timestamp untouched) |
| 5 | reflect exceeded the watchdog timeout (timestamp untouched) |
| 6 | a reflection was produced but the timestamp could not be written; the no-double-fire reset did not happen (surfaced loudly, never swallowed) |

Only a run that (a) did not time out, (b) exited zero, and (c) produced a new
`reflection_*.md` resets the timestamp. A partial reflection written just before
a hang or a non-zero exit is treated as a failure so the next pass retries and
the interactive nudge stays live.

## Load / unload the agent

```sh
# Copy the plist into place (install.sh normally does this; manual form shown):
cp claude/launchd/com.yesand.beats-reflect-weekly.plist ~/Library/LaunchAgents/

# Load (register with launchd):
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist

# Confirm it is registered:
launchctl print gui/$(id -u)/com.yesand.beats-reflect-weekly | head

# Unload:
launchctl bootout gui/$(id -u)/com.yesand.beats-reflect-weekly

# Fire it once on demand, out of schedule (real run - not a dry run):
launchctl kickstart -k gui/$(id -u)/com.yesand.beats-reflect-weekly
```

`gui/$(id -u)` is the per-user GUI domain; use it for a user agent that needs
keychain access (claude's OAuth credentials). `RunAtLoad` is false, so
`bootstrap` registers the schedule without an immediate run.

## Change cadence or threshold

- **Cadence:** edit `StartCalendarInterval` in the plist. `Weekday` 0 = Sunday.
  Biweekly is not a single launchd interval; approximate it by raising the
  threshold, or run weekly and let the gate skip the light weeks. After editing,
  `bootout` then `bootstrap` again.
- **Threshold:** set `REFLECT_THRESHOLD` (default 15) in the plist's
  `EnvironmentVariables`, matching whatever `reflect-nudge.sh` uses so the two
  stay in lock-step.

## DRY_RUN and testing

`DRY_RUN=1` does everything except invoke claude - it runs the threshold gate and
prints the exact command it would run, without touching the timestamp:

```sh
BEATS_REPO_ROOT="$(git rev-parse --show-toplevel)" DRY_RUN=1 \
  bash claude/hooks/beats-reflect-weekly.sh
```

Env overrides for tests (used by `claude/hooks/_tests/test-beats-reflect-weekly.sh`):
`MEMORY_DIR`, `TIMESTAMP_FILE`, `LOG_FILE`, `BEATS_REPO_ROOT`,
`BEATS_REFLECT_CMD` (replace the claude invocation), `BEATS_REFLECT_TIMEOUT_SECS`,
and `BEATS_REFLECT_POLL_SECS`. Run the suite with:

```sh
bash claude/hooks/_tests/test-beats-reflect-weekly.sh
```

## First live run

Load the agent, then trigger it once with `launchctl kickstart -k` and watch
`~/.claude/logs/beats-reflect-weekly.log`. Confirm a `reflection_YYYY-MM-DD.md`
lands in `.claude/memory/`, `MEMORY.md` gets its pointer, and the timestamp
advances. If the run truncates or the corpus assembly costs more turns than
expected, tune via `BEATS_REFLECT_EXTRA_ARGS`.
