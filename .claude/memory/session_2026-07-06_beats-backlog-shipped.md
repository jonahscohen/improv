---
name: Beats backlog T-0044/45/46 SHIPPED - provenance, scheduled reflect, MCP surface
description: The full remaining beats backlog built by three parallel Opus executors and closed by an integrator under Fable orchestration - warn-only provenance frontmatter in beats.py (7 optional fields, TOOL_VERSION 3), the reflect skill re-activated as a threshold-gated weekly launchd routine, and a read-only MCP server exposing search/get/related/status to any MCP client; all units independently verified, Codex-gated, install-wired
type: project
relates_to: [session_2026-07-06_beats-backlog-dispatch.md, proposal_beats_next_evolution.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
session_id: integrator
machine: Mac
source: session
verified: tests + codex-review + independent re-runs
confidence: high
---

Collaborator: Jonah. 2026-07-06. Lead orchestrated in orchestrator-only mode (Fable blocked from Bash/Write/Edit by same-day cost control); building, verifying, and this beat write all delegated to Opus hands. NOTE the policy collision surfaced today: the beats mandate says tooling can never stop a beat write, but orchestrator-only mode blocks the lead's Write tool - resolved by delegating memory writes to executors; flagged to Jonah for a mode carve-out decision.

## T-0044 provenance (builder beats-prov)
7 optional fields (author_human, author_model, session_id, machine, source enum, verified free-text, confidence enum) lifted into beats.py columns (TOOL_VERSION 2->3), JSONL + search --json conditional emission (zero-provenance corpus byte-identical), verify WARN-only lint + --quiet-provenance, tool_version wired to staleness so old dbs recompile cleanly. Tests 59/0 compile, 47/0 search, 21/0 hooks. Real corpus verify exit 0 -> 0 baseline-unchanged. Bench: official scorer was blocked by pre-existing q09 drift; builder proved 48/48 byte-identical ranked lists pre-vs-post through the full hybrid RRF path; integrator repaired q09 and the official scorer now reports 45/48. Codex: 1 Medium folded (feature-detected provenance reads so real db errors still exit 4), round 2 clean. CLAUDE.md Beat File Format documents the fields.

## T-0045 scheduled reflect (builder beats-reflect, verifier verify-reflect)
beats-reflect-weekly.sh: threshold gate identical to reflect-nudge.sh (skip below REFLECT_THRESHOLD, exit 0), headless claude -p "/reflect" with bypassPermissions cwd=repo, success requires child exit 0 AND a new reflection_*.md, only then touches the shared last-reflect-timestamp (two-sided no-double-fire), watchdog with process-group kill (no timeout(1) on macOS; no --max-turns - flag does not exist in installed claude), env validation, DRY_RUN + env overrides, logging with truncation. 24/24 tests (after a Codex-caught timeout-cleanup race fold with a reproducing regression test; integrator re-ran the suite 24/0 exit 0). Codex round 1: five findings folded (timeout-vs-partial-file ordering, child exit status, checked timestamp writes exit 6, process-group kill, env validation); round 2 clean. launchd agent com.yesand.beats-reflect-weekly BOOTSTRAPPED (Sunday 09:00, RunAtLoad false) - first live run PENDING Jonah's backlog decision (892 beats accrued since May 19: kickstart-through-backlog vs pre-touch the timestamp). Keychain-under-launchd reachability is the one thing only the first live run proves.

## T-0046 MCP server (builder beats-mcp)
beats/mcp-server: beats_search (search --json passthrough, STALE surfaced, exits mapped), beats_get (direct corpus read), beats_related (relationship graph + is_superseded), beats_status (verify exit mapped + count). Security: all path separators rejected (flat corpus) + atomic O_NOFOLLOW open (anti-TOCTOU). Schema-agnostic: sibling provenance fields flow through untouched. Codex pass 1 six findings folded (SDK to dependencies, symlink guard, argparse -- terminator, BEATS_BUILD paired with BEATS_CORPUS, BOM/CRLF, null scalars), pass 2 two folded (TOCTOU, inline-empty-list parity). Smoke 10/10 + folds 14/14, re-run fresh by integrator: fresh npm install + npm run build clean (tsc, 0 errors), smoke 10/10 exit 0, folds 14/14 exit 0. Registered in ~/.codex/config.toml (Codex CLI, [mcp_servers.beats]) and ~/.gemini/settings.json (Gemini CLI, mcpServers.beats) per README snippets, absolute path to dist/server.js, no env override (default corpus).

## Integrator folds
- staleness-guard now passes --quiet-provenance (was 893 WARN lines per session start; integrator measured 894 stderr lines pre-flag, 0 post-flag). Hooks tests 21/0; live guard run emits valid JSON, exit 0, clean stderr.
- q09 bench case repointed to the superseding beat (feedback_executive_report_output_contract.md, which supersedes session_2026-06-27_audit-panel-final-report-redesign.md and is itself the chain head); official scorer 45/48 (0.9375 >= 0.9 bar), hybrid mode, exit 0, q09 now PASSES.
- Corpus hygiene: stray content-close-tag trailer removed from session_2026-06-26_codex-gate-claude-fallback.md (file now ends clean at its Files-touched line).
- install.sh wires the reflect hook, templated plist install (sentinel-based author-HOME/repo-root rewrite, macOS-guarded, placement-only), and a mcp-server lazy-build note (chosen over an unconditional build to keep the pure-python memory component Node-free; opt-in surface, manual registration per README). deactivate_reflect gained bootout + plist/hook removal for symmetry. Codex on integrator diff: 1 Low (raw HOME/repo written into XML string nodes would break the plist if a path held & < >) folded with xml.sax.saxutils.escape; round 2 CLEAN. bash -n clean; templating dry-tested for a foreign machine and an XML-special path (both plutil -lint OK, round-trips correct).

## Open items disclosed (per feedback_surface_backlog_on_completion.md)
- Jonah decision pending: first scheduled reflect vs 892-beat backlog (deadline: before Sunday 09:00, or bootout/pre-touch).
- Keychain-under-launchd unverified until first live run.
- Pre-existing broad OperationalError catches around vector detection in beats.py (Codex note, out of unit scope).
- The whole tree since 62b04e7f remains uncommitted awaiting Jonah's commit call (this includes a pre-existing tactical-polish install-block rename already in the working tree, not part of this unit).

Files touched: beats/beats.py, beats/_tests/ (builder); claude/hooks/beats-reflect-weekly.sh, claude/launchd/, claude/hooks/_tests/, claude/docs/ (builder); beats/mcp-server/ (builder); claude/hooks/beats-staleness-guard.sh, beats/bench/benchmark.json q09, install.sh, ~/Library/LaunchAgents plist, ~/.codex/config.toml + ~/.gemini/settings.json MCP registration (integrator); claude/CLAUDE.md Beat File Format (builder); this beat + MEMORY.md + TASKS.md (integrator as lead's scribe).
