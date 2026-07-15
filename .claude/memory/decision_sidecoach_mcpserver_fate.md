---
name: sidecoach/mcp-server fate - RETIRE (dead at runtime, one-line test tether)
description: U9 research - sidecoach/mcp-server has zero runtime consumers; its only tether is a single required-suite line in the engine test runner. Recommend RETIRE with an exact ordered removal sequence; the parity intent survives in the two live classifier copies.
type: decision
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, reference_component_dependency_map.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: code-read + grep (analysis only; no code changed, removal steps NOT executed)
confidence: high
---

Authored against commit 0b65e983. Unit 9 of docs/plans/2026-07-14-parallel-dispatch-plan.md, addressing finding 5 ("sidecoach/mcp-server is built but wired to nothing; only the parity contract in sidecoach_lanes.py keeps it alive"). Read-only research; the ruling (retire vs wire-up) is Jonah's.

**Choice recommended: RETIRE the `sidecoach/mcp-server` package.**

---

## 1. Is it genuinely dead? YES - zero runtime consumers (exhaustive grep)

Nothing builds, registers, or spawns the server on the real path:

- **No root `.mcp.json`.** The improv repo root has none, so launching `claude` from the repo root never registers/spawns it. (`ls .mcp.json` -> absent; the only `.mcp.json` files are `sidecoach/.mcp.json` and `lotus/.mcp.json`.)
- **`sidecoach/.mcp.json` registers it but is inert in practice.** It maps server name `sidecoach` -> `node /Users/spare3/Documents/Github/improv/sidecoach/mcp-server/dist/index.js`. Three reasons it is not a live wiring: (a) it is a SUBDIRECTORY `.mcp.json`, loaded only if `claude` is launched with cwd=`sidecoach/`, not from the repo root; (b) it hard-codes a single-machine absolute path (non-portable); (c) it is git-tracked but the installer never consumes it.
- **install.sh never builds or registers it.** The sidecoach block (install.sh:2931-3006) runs `cd sidecoach && npm run build` (install.sh:2934) which builds ONLY the parent package; the mcp-server has its own separate `npm run build` the installer never invokes. The installer wires 3 hooks into settings.json and symlinks the registries (incl `sidecoach_lanes.py`) but does NOT register the MCP server anywhere. Contrast lotus, which install.sh explicitly registers in `~/.claude.json` (install.sh:436 comment + block) - sidecoach has no equivalent.
- **The sidecoach CLI does not import it.** `sidecoach/bin/sidecoach.js:40` is a COMMENT ("the SAME dist/ artifacts the MCP server ... read"), not an import. The CLI reads the parent `dist/`.
- **No hook imports or spawns it.** The only hook mentions are a docstring in `claude/hooks/sidecoach_lanes.py:5` and an unrelated `ps`-name comment in `cmux-close-guard.sh:590`.
- **No CI runs it.** `.github/workflows/{claude,claude-code-review}.yml` are the @claude bot actions, not a `npm test` gate; neither references the suite.

Footprint of the dead component: **4157 git-tracked files** under `sidecoach/mcp-server` (committed `node_modules` + `dist` + `src` + an extensive `__tests__` / LSP-client / python-sandbox / ast-grep subsystem). Last commit touching it was 3239cd68 (2026-07-10), a broad sweep commit, not substantive server work.

## 2. The parity-contract chain (what actually tethers the dir)

The lane intent classifier is deliberately TRIPLICATED (the packages cannot cross-import: `tsc` rejects it with TS6059 rootDir violations, documented in the file headers and in session_2026-06-13_lane-p1-task8):

1. **Python (LIVE):** `claude/hooks/sidecoach_lanes.py` - deployed to `~/.claude/hooks/`, imported at runtime by `sidecoach-keyword.sh` (import at :120, used at :332). This is the production lane tier.
2. **Engine TS (LIVE):** `sidecoach/src/lane-classifier.ts` - compiled into the parent `dist/`, read by the orchestrator and the `sidecoach` CLI.
3. **mcp-server TS (DEAD):** `sidecoach/mcp-server/src/keyword-resolver.ts` - imported ONLY inside the mcp-server package (registries.ts, tools/classify-intent.ts, and the package's own tests). No live surface reads it.

All three must return identical decisions on the shared fixture corpus `sidecoach/parity/classifier-corpus.json` (23 cases; note at line 3). Parity is enforced by THREE independent test files, each running its own copy against that one corpus:

- `claude/hooks/test_classifier_parity.py` -> tests the Python copy. Imports `sidecoach_lanes` + reads `sidecoach-lanes.json` + the corpus. **Independent of mcp-server.**
- `sidecoach/src/__tests__/classifier-parity.test.ts` -> tests the engine copy. Imports `../lane-classifier` + reads the shared JSON. **Independent of mcp-server.**
- `sidecoach/mcp-server/src/__tests__/classifier-parity.test.ts` -> tests the mcp-server copy. Imports `../keyword-resolver`. **Lives INSIDE the dir.**

**The single load-bearing tether:** the engine test runner `sidecoach/scripts/run-tests.ts` lists the mcp-server parity test as a REQUIRED suite:

```
run-tests.ts:30  { rel: 'mcp-server/src/__tests__/classifier-parity.test.ts', cwd: 'mcp-server', required: true },
```

with an explanatory header (run-tests.ts:14-20) noting the three copies and that the mcp-server's OWN `npm test` does NOT cover this file (that runner globs `__tests__/`, not `src/__tests__/`), "which is exactly why this runner reaches it here." Executing it needs the dir: the test file, `../keyword-resolver`, and the mcp-server's own `node_modules`/tsconfig (it runs with `cwd=mcp-server` via `npx ts-node`).

## 3. Exactly what breaks if you `rm -rf sidecoach/mcp-server`

**Breaks (one hard failure):**
- `cd sidecoach && npm test` hits the missing required suite. `run-tests.ts` (the `!fs.existsSync(full)` + `s.required` branch, ~:137-141) prints `run-tests: REQUIRED suite missing: mcp-server/src/__tests__/classifier-parity.test.ts` and `process.exit(2)`. The WHOLE engine suite hard-fails with exit 2 before running any of its other ~66 suites.

**Also dangles (soft):**
- `sidecoach/.mcp.json` points at a now-missing `dist/index.js`. Only observable to someone launching `claude` from cwd=`sidecoach/`, where it would surface as an MCP server that fails to start.

**Does NOT break (verified):**
- The live hook (`sidecoach-keyword.sh` + `sidecoach_lanes.py`) - pure stdlib Python, self-contained, keeps classifying.
- The Python parity test and the engine parity test - both independent of the dir.
- The parent build: `sidecoach/tsconfig.json` has `references: none`, `include: ['src/**/*']`, and excludes `dist`/`node_modules`; no `generate-*.ts` script reaches mcp-server. `npm run build` is unaffected.
- The sidecoach CLI, install.sh, and every other surface.

So finding 5's phrasing "deleting the server breaks a hook that never calls it" is imprecise: it does not break the hook. It breaks the ENGINE TEST SUITE via one required-suite line. The spirit is right - a green-test contract, not any runtime consumer, is the only thing keeping the dir in the tree.

---

## Alternatives considered

- **WIRE-IT-UP (make the server live):** rejected. To turn it into a real consumer you must (a) register it on the portable path (`~/.claude.json` via install.sh, or a root `.mcp.json`), (b) make install.sh build BOTH the parent and the mcp-server (today only the parent builds), (c) fix the hard-coded single-machine absolute path in `sidecoach/.mcp.json`, and (d) own and keep-green a whole MCP surface (LSP client, python sandbox, ast-grep, state store, validators, cost ledger, cheatsheet) - all to expose rule-based building blocks that the hook, the CLI, and the in-session orchestrator already invoke directly in-process. There is no demonstrated external MCP client asking for these over stdio. It is a strictly larger, riskier, standing-maintenance commitment with no consumer pull. (It is worth noting the server is not broken - per session_2026-06-14_p4d beats it built clean and passed ~295 tests bar one environmental OOM. "Unwired," not "rotten." That is the only real point in wire-up's favor, and it is not enough.)
- **Leave it inert (status quo):** rejected. It is a standing tax: every lane-rule change is a 3-edit + 3-parity-reverify chore (documented in session_2026-06-23 gap analysis) instead of 2, and the tree carries 4157 dead tracked files plus a misleading "not removable" node on the dependency map.

**Why RETIRE:** zero runtime consumers; the sole tether is one self-inflicted required-suite line, trivially cut; the parity INTENT (no classifier drift on the live surfaces) is fully preserved by the two LIVE copies (Python hook + engine), each with its own independent 23-case corpus test. Dropping the third, dead copy removes maintenance burden and 4157 files without weakening the guarantee that the surfaces that actually run agree. Retirement is fully reversible via git if a consumer ever materializes.

## Safe removal sequence (ordered; sever the tether BEFORE deleting)

1. **Cut the tether.** In `sidecoach/scripts/run-tests.ts` delete line 30 (the `mcp-server/src/__tests__/classifier-parity.test.ts` required-suite entry) and reword the header comment (lines 14-20) from "THREE copies ... the mcp-server parity suite lives in a DIFFERENT package" to two copies (Python + engine).
2. **Verify the tether is gone before deleting anything:** `cd sidecoach && npm test` -> expect `run-tests: N suite(s) passed` (exit 0), N one less than the prior count. If it still errors on the mcp-server path, stop.
3. **Delete the server dir:** `git rm -r sidecoach/mcp-server` (drops all 4157 tracked files: committed node_modules, dist, src, __tests__).
4. **Delete the dangling registration:** `git rm sidecoach/.mcp.json` (it references only the now-deleted `dist/index.js`).
5. **De-mislead the parity docstrings** (non-blocking for correctness, required for a clean retire so future maintainers do not chase a deleted mirror):
   - `claude/hooks/sidecoach_lanes.py:5` - drop "The TypeScript mirror lives at sidecoach/mcp-server/src/keyword-resolver.ts and MUST produce identical decisions..."; point the parity note at the engine copy only.
   - `sidecoach/src/lane-classifier.ts` (header ~:2-6 and ~:17) - remove the "DUPLICATED into ... the MCP server (keyword-resolver.ts)" references; keep the engine<->Python parity note.
   - `sidecoach/parity/classifier-corpus.json:3` - drop the "AND sidecoach/mcp-server/src/keyword-resolver.ts (classifier-parity.test.ts)" clause; keep Python + engine.
   - `sidecoach/src/__tests__/classifier-parity.test.ts` header comment - reword "two packages cannot cross-import" to name only the surviving engine<->Python pair. The test body needs no change (it imports the engine copy).
6. **Re-verify the full surface after deletion (all must pass):**
   - `cd sidecoach && npm test` -> exit 0
   - `python3 claude/hooks/test_classifier_parity.py` -> 23 cases, exit 0
   - `python3 claude/hooks/test_sidecoach_lanes.py` -> 35/0
   - `bash claude/hooks/test-sidecoach-keyword.sh` -> pass
   - `grep -rn "mcp-server" sidecoach claude --include=*.ts --include=*.py --include=*.sh --include=*.json | grep -v node_modules` -> only intended residue (ideally none).
7. **Dependency-map bookkeeping (LEAD does at integration, not part of this beat):** drop the "inert but not removable" node from `docs/dependency-map/index.html` (:541-542, :660) and `reference_component_dependency_map.md` (:69, :99-100).

## Revisit when

A concrete external MCP client appears that needs sidecoach's rule-based tools over stdio (e.g. the desktop app or a non-Claude-Code harness calling the validators / registries / cheatsheet directly). At that point resurrect the server from git history AND do the wire-up properly: portable registration in the install path, an installer build step for the mcp-server, and a path fix in the registration. Until such a consumer exists, keeping the server inert is a drift-and-footprint tax with no upside.
