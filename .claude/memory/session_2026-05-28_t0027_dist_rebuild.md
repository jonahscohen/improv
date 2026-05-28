---
name: T-0027 parent sidecoach dist rebuild (ralph mode + T-0019..T-0023 wave)
description: npm run build caught the parent sidecoach/dist up with src - surfaced ralph mode AND the whole T-0019..T-0023 src wave that was committed but never recompiled
type: project
relates_to: [session_2026-05-28_t0014_sidecoach_cli.md, session_2026-05-28_t0020_ralph_loop.md, session_2026-05-28_t0023_deep_interview.md]
---

Collaborator: Jonah. Closed 2026-05-28.

## What T-0027 was
Filed from the T-0014 CLI work: `dist/modes.js` exported only 5 modes (forge/kiln/bloom/canvas/trim) while `src/modes.ts` + `claude/hooks/sidecoach-modes.json` defined 6 (adds `ralph`, the T-0020 loop mode). The CLI, orchestrator, and MCP server all read dist, so `ralph` was invisible at the execution surface. Filing said "just needs npm run build."

## Verified the drift before building (grep -c would have lied)
`grep -c ralph dist/modes.js` returned 2 - but both were COMMENT lines; the `RALPH` const and `ralph: RALPH` registry entry were absent from compiled output. CLI confirmed "Modes (5)". So the drift was real despite the misleading grep count.

## The rebuild caught more than modes
`cd sidecoach && npm run build` (tsc). Blast radius was broader than T-0027 described - the parent dist was stale for the ENTIRE T-0019..T-0023 wave, not just modes:
- MODIFIED: dist/modes.* (+ralph), dist/teach-command-handler-v2.* (+362 lines of T-0023 deep-interview logic that was committed to src but never recompiled).
- NEW (16 files): dist/ralph-loop.* (T-0020), dist/teach-deep-interview.* (T-0023), + their compiled tests in dist/__tests__/ (consistent with existing practice - dist already carried compiled tests). All map to real src modules.
Root cause of the broader staleness: the omc-gap-close team committed src for T-0019..T-0023 but did not rebuild the parent sidecoach dist (only the mcp-server's own dist was rebuilt during T-0025/T-0026).

## Verification
- dist/modes.js now: `MODE_LIST = [FORGE, KILN, BLOOM, CANVAS, TRIM, RALPH]`.
- CLI `node bin/sidecoach.js list` -> "Modes (6)" incl. `ralph  polish -> audit -> critique`.
- Parent dist import check: `require('../dist/modes.js').MODE_LIST` -> forge, kiln, bloom, canvas, trim, ralph.
- MCP server `tsc --noEmit` clean against the updated parent dist (it consumes ../../dist), so sidecoach_list_modes will now report 6.

## Known wart left as-is (not in T-0027 scope)
`npm run build` exits non-zero with TS6059 rootDir errors: `src/__tests__/t16-bench-ledger.test.ts` imports `benchmarks/runner/*` which sits outside the `src` rootDir. Pre-existing and documented (commit ad04513, T-0023 beat). tsc still EMITS all files despite the errors (no noEmitOnError), so dist is correct - but the non-zero exit is messy. Candidate follow-up: exclude the bench-ledger test from the main tsconfig or give benchmarks their own tsconfig. Did not expand T-0027 scope to fix it.

## Files
- sidecoach/dist/* rebuilt (modes, teach-command-handler-v2, + new ralph-loop, teach-deep-interview, and their compiled tests)
