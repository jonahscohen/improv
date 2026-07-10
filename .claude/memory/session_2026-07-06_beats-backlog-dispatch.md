---
name: Beats backlog T-0044/45/46 - full build dispatched to three parallel Opus executors
description: After Jonah's correction about hidden backlog (feedback_surface_backlog_on_completion.md), he ordered the entire remaining beats backlog finished - provenance frontmatter, scheduled weekly reflect, and the read-only MCP surface - built by Opus executors with the lead orchestrating; specs grounded in proposal_beats_next_evolution.md and the ratified Plan B warn-never-block constraint
type: project
relates_to: [feedback_surface_backlog_on_completion.md, proposal_beats_next_evolution.md, session_2026-07-02_beats-backlog-and-cutover-confirmation.md]
---

Collaborator: Jonah. 2026-07-06.

Jonah: "Please finish the beats stuff, all of it, use Opus agents and remain the orchestrator."

## Grounding done before dispatch
- Verified all three are genuinely unbuilt: beats.py has no provenance fields, only reflect-nudge.sh exists (no schedule), no beats MCP server anywhere.
- Read the ratified constraints: Plan B (feedback_memory_first_zero_failure_execution.md) - provenance validator WARNS, never blocks; tooling can never stop a mandated beat write. Proposal fields: author_human/author_model/verified/confidence; task fields: author/session/machine/source - specs merge both, all optional.
- reflect-nudge threshold contract identified as two-sided for T-0045: scheduled run skips below REFLECT_THRESHOLD (quiet week burns nothing) AND touches ~/.claude/last-reflect-timestamp on success so the nudge resets (no double-fire).
- lotus/mcp-server identified as the structural template for T-0046; beats.py treated as a frozen binary interface by the MCP unit so it cannot collide with the provenance unit editing the same file.

## Dispatch (three parallel Opus executors, exclusive file ownership)
- beats-prov (T-0044): beats/beats.py + beats/_tests/ + the Beat File Format section of claude/CLAUDE.md ONLY. Optional fields author_human/author_model/session_id/machine/source/verified/confidence; compile indexes them, verify gains warn-only lint (exit codes unchanged - hard rule), search --json round-trips them. Gates: all shell tests, real-corpus compile/verify/search baseline-vs-after, bench vs 45/48 if offline-runnable, codex.
- beats-reflect (T-0045): NEW claude/hooks/beats-reflect-weekly.sh + claude/launchd/ plist + hook test + claude/docs/beats-scheduled-reflect.md. Threshold-gated headless `claude -p "/reflect"`, timestamp touch on success only, DRY_RUN mode, logs. No live claude run, no launchctl load (lead does live wiring). Gates: test, double DRY_RUN transcript, plutil lint, codex.
- beats-mcp (T-0046): NEW beats/mcp-server/ (TS, MCP SDK, stdio). Read-only tools: beats_search (wraps search --json, surfaces STALE), beats_get (direct corpus read, path-escape rejection), beats_related (frontmatter graph), beats_status (verify exit code). README with Claude/Codex/Gemini registration snippets. Gates: build, real stdio JSON-RPC smoke transcript incl. security rejection, codex.
- Lead retains: install.sh wiring, launchctl load + first live scheduled-run decision, TASKS.md updates, all .claude/memory/ writes, cross-unit verification, teardown.

Files touched so far: this beat + feedback_surface_backlog_on_completion.md + MEMORY.md.
Pending: three executor reports, folds, live wiring, verification, TASKS.md closure.
