---
name: Justify WS connect made deterministic - killed the 9225-9228 port-scan noise
description: Removed transport.ts port-range scan (base..9232); core now connects to the single known daemon port. 7 console failures -> 0.
type: project
relates_to: [session_2026-06-15_justify-on-marketing-site.md]
---

Collaborator: Jonah

## Problem
Browser console spammed `WebSocket connection to 'ws://localhost:9225/' failed: ERR_CONNECTION_REFUSED`
(and 9226-9228) on every justify page load, on top of a working :9223 connection.

## Root cause (code path)
`justify/core/transport.ts` `connect()` -> `tryConnect(this.port, 9232)`. That method
looped `for (p = port; p <= 9232; p++)` and opened a WebSocket to EVERY port in the range
simultaneously, racing them with `Promise.any`. The daemon only listens on 9223 (ws/http)
and 9224 (https/wss), so every other port (9225-9232) produced an `ERR_CONNECTION_REFUSED`
in the console. The probe was pure waste: the correct port is already known - `detectJustifyUrl()`
in core/index.ts derives it from the `<script src>` the core was loaded from and passes it to
`new Transport(port)`. The scan ignored that and probed a range anyway.

## Fix (justify/core/transport.ts only - one file)
- `connect()` now opens ONE socket to `this.port` (the known port). No range, no `Promise.any`.
- New `openSocket(port)` replaces `tryConnect(port, maxPort)`.
- On initial failure, `connect()` schedules a quiet capped-backoff reconnect (1s -> 2s -> ... -> 30s),
  one socket per attempt, instead of rejecting outright (old code never retried an initial failure).
- `scheduleReconnect()` uses the capped backoff, resets to the floor on success, and emits
  `'connected'` so the toolbar re-lights after a recovery (old code never emitted it).
- https/wss path preserved (protocol still chosen from `window.location.protocol`); the port is
  whatever the script was loaded from (9224 for https pages).

Why: the daemon port is deterministically knowable, so probing is unnecessary and noisy.
How: single-socket connect to the script-derived port + quiet capped backoff for the rare retry.

## Evidence (headless playwright, isolated A/B on base 9225, same daemon, only bundle swapped)
- BEFORE (deployed/old core): connect 43ms, toolbar 45ms, WS failures = 7 (ports 9226-9232).
- AFTER  (new core):          connect 43ms, toolbar 46ms, WS failures = 0.
- LIVE (real :9223 daemon serving the deployed fix): connect 34ms, toolbar 37ms, WS failures = 0;
  test connection disconnected cleanly (daemon back to baseline 1 connection - live session untouched).
Connect latency was already fast (the first port won the old race); the win is determinism +
zero console noise.

## Build / deploy
- `npm run deploy:core` (esbuild core + deploy.sh --core-only). Synced:
  ~/.claude/justify/dist/justify-core.js (what the live :9223 daemon serves) and
  improv/public/justify-core.js. Verified the live :9223 daemon now serves the fixed bytes
  (0 occurrences of "9232", `openSocket` present).
- Daemon NOT restarted: only the client bundle changed; the daemon reads justify-core.js fresh
  from disk per request, so any page RELOAD picks up the fix. PID 80090 untouched.
- Server code (ws-server.ts) unchanged.

## Notes / not regressions
- tsc on transport.ts is clean. Pre-existing test failures are unrelated to this change:
  6 in __tests__/core/selection.test.ts (`isDynamicClassName is not a function` - stale test),
  1 in __tests__/server/ws-server.test.ts (`EADDRINUSE` flaky port collision). No test imports transport.
- Left in the working tree (not committed) per task. core/index.ts was already dirty before this
  session and was NOT touched.

## Files touched
- justify/core/transport.ts (source)
- justify/dist/justify-core.js + ~/.claude/justify/dist/justify-core.js + improv/public/justify-core.js (built/deployed)
