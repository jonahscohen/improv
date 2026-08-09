---
name: Justify clear-resurrection fix deployed live and merged to main
description: Clear-tombstone-identity fix (commit 8e720c55) built and deployed to the live install (~/.claude/justify/dist) without disturbing the armed :9223 ppai daemon, then the whole justify-closure-contract branch fast-forward-merged to main and pushed. The fix is now permanent (survives a re-install from main). Activation for a running session is a Claude Code restart (server half) + tab reload (client half). Closure-contract Tasks 2 and 3 remain unbuilt.
type: project
relates_to: [session_2026-08-08_clear-tombstone-identity-gap.md, session_2026-08-08_justify-closure-contract-plan.md, session_2026-08-08_justify-emitresponse-helper.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: deployed files grep-confirmed to carry the fix + deterministic suite (306 green) + clear-specific 27/27
confidence: high
---

Collaborator: Jonah. Jonah chose "deploy the clear fix now" then "merge to make it permanent."

## Deploy (daemon-safe, verified)
- Built the branch: `npm run build:all` (core esbuild -> justify-core.js + adapters; server tsc 0 errors). Justify source confirmed committed (built the real fix at 8e720c55, not a dirty tree).
- `bash deploy.sh` synced dist -> ~/.claude/justify/dist (core, adapters, server JS, CLI scripts, spark svgs).
- SAFETY: deploy.sh only COPIES files; it never restarts a process. The armed :9223 ppai daemon (PID 50908) was NOT touched and keeps running its old code until it next restarts. This is the constraint clearfix and I both honored (do not disturb Jonah's other project's live review session).
- VERIFIED the DEPLOYED bytes carry the fix: ~/.claude/justify/dist/server/ws-server.js contains the task-level base-id tombstone logic (`-\d{10,}$`, baseId, clearedBase, tombstone); ~/.claude/justify/dist/justify-core.js contains `_clearedBaseIds`. Both files mtime-stamped to the deploy moment.
- ACTIVATION for a running session: restart Claude Code (server half - the per-session server reloads dist/server) + reload the Justify tab (client half - new justify-core.js bundle). The read-time base-id derivation sweeps any already-resurrected task (e.g. the live prompt-115) on the next clear/GET after activation.
- Live browser button-click verification was deliberately NOT done by me - it would require restarting the armed daemon. Proof of correctness is the deterministic suite + mutation controls + the live-data trace; the visual confirm is Jonah's post-restart step.

## Merge (permanent)
- Fast-forward merged justify-closure-contract -> main and pushed. Five feature commits made permanent: the plan (6c4159b6), Task 1 emitResponse (f5caf674), codex-review wrapper shim fix (4a91edd3), hook deploy-currency check (ce3cba4e), clear-tombstone fix (8e720c55), plus session beats.
- Now durable: a future clean re-install from main keeps the fix (before the merge, a re-install would have dropped it).

## Still open (not this unit)
- Closure-contract Tasks 2 (daemon auto-return sweep) and 3 (/status inFlight) are NOT built. Task 1 is a valid standalone increment. When resumed, they MUST re-ground on the CURRENT ws-server.ts (Task 1 emitResponse + clearfix tombstone guard both changed it since the plan stamp 6c4159b6).
- disarm-endpoint.test.ts has a pre-existing EADDRINUSE port-collision flake (BASE_PORT 49400) - harness bug, unrelated, deferred.

## Files
- deployed: ~/.claude/justify/dist/* (out of repo); merged: main
- this beat + MEMORY.md pointer
