---
name: sidecoach/mcp-server RETIREMENT executed (4157-file cut + classifier dedup to 2 copies)
description: Executed Jonah's 2026-07-24 RETIRE decision - re-verified the drifted removal sequence against HEAD, severed the run-tests.ts tether, deleted the mcp-server dir + .mcp.json, de-misled 4 classifier docstrings. Triplicated classifier -> duplicated.
type: project
relates_to: [decision_sidecoach_mcpserver_fate.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests + grep + codex-review
confidence: high
---

Executes decision_sidecoach_mcpserver_fate.md (Jonah's 2026-07-24 RETIRE reversal). The removal sequence in that beat was stamped @0b65e983; HEAD was 84754c28 (~14 commits past), so every current-state claim was RE-VERIFIED before cutting.

## Re-verification against HEAD 84754c28 (the drifted-sequence check)
- **Tether MOVED: line 30 -> line 40.** `sidecoach/scripts/run-tests.ts:40` was the sole required-suite entry reaching the dir: `{ rel: 'mcp-server/src/__tests__/classifier-parity.test.ts', cwd: 'mcp-server', required: true }`. Confirmed it is the ONLY live-tree thing that executes anything in the dir.
- **`sidecoach/.mcp.json` still present**, still points ONLY at the mcp-server dist (`.../sidecoach/mcp-server/dist/index.js`). Inert (subdir .mcp.json, absolute single-machine path, installer never consumes it).
- **Dead-confirmed.** Rigorous grep (excluding the dir itself BY FILE-PATH PREFIX, node_modules, dist, .map, eval corpus): the only functional (non-comment) refs to the dir are the tether (run-tests.ts:40) + the .mcp.json registration. Everything else is comment/docstring. NO live import/require/spawn/exec appeared since the analysis. NOTE the beat's own grep recipe (`grep -v "mcp-server/"`) is too aggressive - it hides path-refs like `sidecoach/mcp-server/src/keyword-resolver.ts`; excluding by leading file-path prefix is the correct dead-check.
- **4 docstrings re-located by content** (line numbers all drifted): `claude/hooks/sidecoach_lanes.py:4-6`, `sidecoach/src/lane-classifier.ts:1-19`, `sidecoach/parity/classifier-corpus.json:3`, `sidecoach/src/__tests__/classifier-parity.test.ts:1-6`.
- **Prize count:** `git ls-files sidecoach/mcp-server` = 4156 (beat said 4157, drifted -1) + `.mcp.json` = 4157 total deletions.
- **Baseline before touching anything:** `cd sidecoach && npm test` = `run-tests: 76 suite(s) passed` (green). Expect 75 after severing.

## Execution (sever BEFORE delete, per the beat) - DONE
1. run-tests.ts: reworded header 14-20 THREE->TWO copies + deleted tether line 40. Verified zero mcp-server refs remain in run-tests.ts.
2. `npm test` = 75 suites green (was 76; dropped suite = mcp-server parity, 0 mcp-server mentions in log) - proven BEFORE deletion.
3. `git rm -r sidecoach/mcp-server` (4156 tracked) + `git rm sidecoach/.mcp.json` (1) = 4157 staged deletions; then `rm -rf` the 6 leftover gitignored node_modules files so the dir is fully gone from disk (git diff unaffected).
4. De-misled all 4 docstrings (sidecoach_lanes.py, lane-classifier.ts header, classifier-corpus.json note, classifier-parity.test.ts header) - all now name only the Python<->engine pair.

## 8-check verification (ALL GREEN, real output)
1. `cd sidecoach && npm test` -> exit 0, `run-tests: 75 suite(s) passed` (one fewer; 0 mcp-server mentions in log).
2. `python3 claude/hooks/test_classifier_parity.py` -> `PASS test_python_matches_corpus (23 cases)`, exit 0 - LIVE Python classifier still agrees; dedup lost no guarantee.
3. `python3 claude/hooks/test_sidecoach_lanes.py` -> 35 passed, 0 failed, exit 0.
4. `bash claude/hooks/test-sidecoach-keyword.sh` -> 128 passed, 0 failed, exit 0.
5. engine `src/__tests__/classifier-parity.test.ts` -> `engine classifier-parity: 23 cases OK` inside npm test.
6. residual grep (sidecoach claude, ts/py/sh/json, -node_modules) -> only modes.ts:2,18 + cmux-close-guard.sh:908 (both intended out-of-scope residue). ZERO dangling refs in the 4 edited files.
7. `git diff HEAD --stat` -> 4169 files changed, 46 insertions(+), 895599 deletions(-). Deleted 4157, modified 12 (5 my source edits + 5 recompiled dist [comment-only] + 2 pre-existing memory files). Only .mcp.json deleted outside the dir.
8. `npm run build` -> clean; generate-lanes-data --check OK, generate-validators --check OK (no drift); tsc clean.

## CRITICAL Codex finding (HIGH) - install.sh is a LIVE consumer the beat's premise MISSED (drift)
Codex (real different-model, exit 0, 135s) caught a live surface the retire breaks. The decision beat section 1 (authored @0b65e983) asserted "install.sh never builds or registers it" - that assertion is now FALSE. The reversed 2026-07-15 wire-up (beat says it was "abandoned") actually LANDED its install.sh half:
- **install.sh:4737-4758 BUILD+REGISTER block** (comment literally: "Jonah 2026-07-15: wire it up, do not retire"): `cd sidecoach/mcp-server && npm install && npm run build`, then registers `mcpServers.sidecoach -> sidecoach/mcp-server/dist/index.js` in `~/.claude.json`.
- **install.sh:1720-1729 DEREGISTER block**: pops `mcpServers.sidecoach` from `~/.claude.json`.
- **install.sh:4700 + bin/sidecoach.js:42-43**: stale comments ("the hooks and MCP server use", LOW).

Impact of the deletion on this live surface: `install.sh --only sidecoach` now hits a missing dir at :4741 -> warns every run; and machines that ran the post-2026-07-15 installer have a now-dead `mcpServers.sidecoach` entry that will spawn-fail at Claude Code startup and is NOT cleaned up by the retire.

**Handling: STOP-and-REPORT, not folded.** install.sh is OUTSIDE my 7-file scope, and un-wiring it cleanly is a DESIGN decision (delete build+register? keep/convert the deregister block into an active cleanup migration for already-registered machines?). Per my mandate (execution layer; design belongs to the orchestrator; "if a new live consumer appeared since the analysis, STOP and report - do not delete"), I did NOT edit install.sh. The code-surface deletion is left staged (uncommitted, fully reversible) and MUST NOT be committed until the install.sh surface is resolved by the lead. Repo-wide sweep confirms install.sh + bin/sidecoach.js are the ONLY missed live surfaces (no root .mcp.json, no workflow/package.json/workspace refs).

## Self-analysis (the miss) - Why: I trusted a drifted spec claim I was told to re-verify. How: my dead-confirmation grep was scoped to `sidecoach claude` dirs, but install.sh is at the REPO ROOT, so it never entered the grep; and I re-verified the tether/.mcp.json/docstrings but NOT the beat's separate prose claim about install.sh, even though the task said re-verify EVERY current-state claim. The beat itself flagged that install.sh had drifted (line numbers 2931-3006, now 4737) and that HEAD moved far - the signal was there. Codex's repo-root -C scope caught what my dir-scoped grep could not. Lesson: when a beat makes a prose claim about a ROOT-level file (install.sh, root .mcp.json), re-verify it with a repo-ROOT-scoped grep, not a subdir-scoped one.

## Codex LOW finding
`sidecoach/bin/sidecoach.js:42-43` stale comment (CLI "reads the same dist artifacts as sidecoach/mcp-server") - out of scope, residue for lead.

## Scope guardrails honored
- modes.ts NOT touched (out of scope; its docstring refs to mcp-server/src/registries.ts at lines 2,18 are KNOWN RESIDUE deferred to the modes.ts follow-up which must first migrate mode resolution into PHASE_ALIASES).
- `sidecoach/bin/sidecoach.js:43` (comment ref to the MCP server) and `claude/hooks/cmux-close-guard.sh:908` (unrelated ps-name comment) left alone - out of the 7-file scope; flagged as residue for LEAD.
- `claude/skills/lotus/SKILL.md` refs are a DIFFERENT project's mcp-server, unrelated.

Collaborator: Jonah Cohen.

## Files touched (all in-scope; NOT committed)
- sidecoach/scripts/run-tests.ts (tether line + header THREE->TWO)
- sidecoach/mcp-server/ (deleted, 4156 tracked + gitignored leftover)
- sidecoach/.mcp.json (deleted)
- claude/hooks/sidecoach_lanes.py (docstring)
- sidecoach/src/lane-classifier.ts (docstring)
- sidecoach/parity/classifier-corpus.json (docstring note)
- sidecoach/src/__tests__/classifier-parity.test.ts (docstring)
- sidecoach/dist/{lane-classifier.js,.d.ts.map,.js.map, __tests__/classifier-parity.test.js,.map} (auto-recompiled by npm run build; comment-only)
- .claude/memory/{this beat, MEMORY.md} (beat + pointer)

## NOT touched - LEAD action required before commit
- install.sh (HIGH BLOCKER - build+register :4737-4758, deregister :1720-1729, stale comment :4700) - out of scope + design decision on the un-wiring approach.
- sidecoach/bin/sidecoach.js:42-43 (LOW stale comment) - out of scope.
- sidecoach/src/modes.ts:2,18 (docstring refs to mcp-server/src/registries.ts) - deferred to the separate modes.ts follow-up (needs mode->PHASE_ALIASES migration first).
- claude/hooks/cmux-close-guard.sh:908 (unrelated ps-name comment) - leave as-is.
- docs/ dependency-map bookkeeping (beat step 7) - LEAD's job.

## Harness note (false-positive to flag)
`codex-failure-watcher.sh` fired "CODEX FAILURE DETECTED (capacity/error)" on a Bash call that merely `sed`-printed codex-review.py's SOURCE (which lists capacity signature regexes like "at capacity"/"request failed"). No codex ran on that call. The watcher scans bash stdout for capacity strings and matched the tool's own signature list. Minor false positive worth a carve-out (skip when the output is a file listing/printing codex-review.py itself).
