---
name: Lane P1 Task 11 - freeze modes.ts as the MCP legacy feed (do NOT delete in P1)
description: Confirmed modes.ts is engine-orphaned; added a FROZEN(P1)/TODO(P4) banner (marker only). Both builds stay green (sidecoach + mcp-server); the MCP dist/modes import still resolves. Deletion deferred to P4 (must also rm dist/modes.js).
type: project
relates_to: [session_2026-06-13_lane-p1-task10-generator.md]
---

Collaborator: Jonah

Implemented **Task 11 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Committed 1 file (marker-only).

## What was done

- `sidecoach/src/modes.ts` - added a `// FROZEN(P1)/TODO(P4)` banner at the top. NO logic change. modes.ts is RETAINED in P1, DELETED in P4.

## Orphan status PROVEN (Step 1)

- Engine: the ONLY `sidecoach/src` references to modes (`from './modes'`, MODE_LIST, getMode, getModeChain, getModeVerbChain, MODES) are inside `src/modes.ts` ITSELF (its own declarations, lines 182-215). NO other engine file imports it - `lanes.generated.ts` (Task 10) superseded it as the engine registry, and slash-command-router only imports getVerbEntry/VERB_REGISTRY. So the freeze is safe; no importer to repoint (no STOP condition hit).
- MCP consumers (cross-package, retained): `mcp-server/src/registries.ts` (imports MODE_LIST/getMode from `../../dist/modes`) and `mcp-server/src/keyword-resolver.ts` (ModeEntry type). The `list-modes`->`list-lanes` rename + ModeEntry retirement are P4.
- `sidecoach/dist/modes.js` exists on disk (8778 bytes) - the stale-artifact landmine: deleting src/modes.ts in P1 would leave dist/modes.js, the MCP import would still resolve against the stale compiled file, and `mcp-server` build would FALSELY pass. Freezing sidesteps this. P4 must rm dist/modes.js when it deletes the source.

## Acceptance: BUILD-GREEN BOTH SIDES (the gate)

- `cd sidecoach && npm run build` (ts-node scripts/generate-lanes.ts && tsc) -> exit 0, 0 errors. Regenerated lanes artifacts identically (no working-tree drift - generated files stayed clean; only modes.ts shows modified).
- `cd sidecoach/mcp-server && npm run build` (tsc && chmod) -> exit 0, 0 errors. The `import { MODE_LIST, getMode } from '../../dist/modes'` still resolves because modes.ts/dist are retained. No "Cannot find module './modes'".
- error scan of both build logs: 0 "error TS"/"Error:".

## No-behavior-change confirmation

- `cd sidecoach && npm test` -> 5 suite(s) passed, exit 0 (intent-detector 8/8, engine parity 19, slash-phrase OK, mcp parity 19, lane-derivation OK).
- python3 test_sidecoach_lanes.py -> 35 passed, 0 failed.
- model-router-guard: comment-only change, no LLM/network.

## Files touched

- sidecoach/src/modes.ts (FROZEN(P1)/TODO(P4) banner only)
