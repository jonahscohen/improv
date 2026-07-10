# Justify daemon-owned watch - implementation plan

Authored against commit: `62b04e7f`

## Problem
"watch justify" runs a listen/apply loop tied to a Claude session (the bash
poller `~/.claude/justify-watch.sh` + the `.justify-watch-on` flag + the
`justify-watch-guard.sh` Stop hook that nags a session to relaunch the poller
when it dies). Harness turn boundaries and session teardowns kill the loop, so
queued Send-All batches sit on the daemon until a human nudges. The Stop-hook
relaunch is a half-measure: a session-owned relaunch recreates the disease.

## Destination
Move watch ownership INTO the persistent :9223 daemon (`justify/server/`), which
outlives every session. The daemon holds armed/disarmed state on disk, and when
armed it spawns a headless `claude -p` worker to apply each Send-All batch. The
watch never stops until the user explicitly disarms.

## Steps (each with a runnable verify clause)

1. Add `JUSTIFY_WS_PORT` env override to `server/index.ts` so a test daemon can
   run off the live :9223.
   -> verify: `JUSTIFY_WS_PORT=9323 node dist/server/index.js &` then
      `curl -s localhost:9323/status` returns `"port":9323`.

2. New `server/watch-state.ts`: persist `{armed, projectRoot, armedAt, armedBy,
   disarmedAt}` to `~/.claude/justify/watch-state.json`. Load on boot; arm/disarm
   mutate + persist. Only arm()/disarm() change `armed`.
   -> verify: unit-level - arm writes armed:true; a fresh load from the same file
      reports armed:true (resume-from-disk); disarm writes armed:false.

3. New `server/dispatcher.ts`: while armed, poll prompts.json (~2s). Unclaimed or
   stale-claimed prompts + no live worker -> claim for `daemon-worker:<runId>` and
   spawn the worker. Worker success = observed effect (claimed ids cleared from
   prompts.json), not exit code. Errors -> exponential backoff, NEVER disarm.
   Worker command overridable via `JUSTIFY_WORKER_CMD` (test injection, mirrors
   beats-reflect BEATS_REFLECT_CMD).
   -> verify (D-plumbing): test-port daemon, arm a scratch project, inject a
      prompt, set JUSTIFY_WORKER_CMD to a fake apply-then-justify-done; observe
      the scratch source file change and the prompt cleared.

4. `cli/justify-worker.sh`: the real worker the daemon spawns. Mirrors
   `beats-reflect-weekly.sh` - absolute `claude` resolution, minimal-env PATH,
   `claude -p <apply-prompt> --permission-mode bypassPermissions --add-dir
   <root>` cwd=root, wall-clock watchdog with process-group kill.
   -> verify (A-real): one real worker run against a scratch project applies the
      change and posts /respond.

5. HTTP endpoints in `server/ws-server.ts`:
   - POST /watch/arm {projectRoot,by}, POST /watch/disarm {by}, GET /watch/state
   - POST /prompts/claim {by,ttlMs?} (atomic claim of unclaimed/stale prompts)
   - GET /watch-status.active now = armed || (legacy session-active)
   -> verify: curl arm -> GET /watch/state armed:true; GET /watch-status
      active:true with zero sessions; curl disarm -> armed:false.

6. Legacy migration:
   - `justify-watch-guard.sh` Stop hook: stop blocking + stop relaunching. Never
     block a Stop (a `claude -p` worker must exit cleanly). Optional one-line
     SessionStart advisory keyed off daemon armed state.
   - `.justify-watch-on` flag: retired as source of truth (daemon state is
     canonical). `cli/justify-watch.sh` chat path now ARMS the daemon.
   - New CLI: `cli/justify-watch-arm.sh` / `justify-watch-disarm.sh`.
   -> verify: `test-validation-guards`-style - feed the Stop hook a payload with
      the flag present and no poller; assert it does NOT emit a block decision.

7. Truthful UI: banner + Send-All key off `/watch-status.active` (already true);
   minimal copy tweak in `core/prompt/index.ts`. Claudebar reflects armed states.
   -> verify: browser - arm with zero sessions, banner hidden + Send All shown.

8. Durability: launchd KeepAlive plist `com.yesand.justify-serve.plist` +
   install.sh wiring + doc, following the beats-reflect-weekly plist precedent.
   -> verify: `plutil -lint` the plist; doc lists bootstrap/bootout commands.

## Acceptance criteria mapping
- A: step 3 (plumbing) + step 4 (real worker) + browser round-trip; revert QA change.
- B: step 2 (resume-from-disk) - kill/restart daemon while armed.
- C: step 5 disarm -> dispatch stops, tasks accumulate, banner disarmed.
- D: step 3 claim semantics - interactive claim blocks a second worker; stale re-dispatch.
- E: `npx tsc --noEmit` (baseline 160, zero new); `npx vitest run` (baseline 2 failing files).
- F: codex-review.py over the full diff; fold findings; re-run gates.

## Constraints
Working-tree edits only (a sibling holds a staged index - never touch git index).
No emojis, no emdashes, no AI attribution.
