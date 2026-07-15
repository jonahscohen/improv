---
name: change plan authored - cmux/fable component-scoping + sidecoach-mcp wire-up
description: Stamped, self-reviewed change plan for the 3 units Jonah ruled on (fix cmux+fable via component-scoping; wire up sidecoach-mcp). Plan-consistency lint + Codex gates pending, then execute without an approval gate (Jonah's instruction).
type: project
relates_to: [session_2026-07-15_cmux-fable-alacarte-leak.md, decision_sidecoach_mcpserver_fate.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: self-review pass embedded in the plan; plan-consistency-lint + Codex still to run
confidence: high
---

Jonah's morning rulings on the two mis-framed decisions + the sidecoach fate:
- cmux + fable: "fix both now, but write a change plan first without my approval and making use of that self-review stuff you just wrote." -> write plan, self-review, run plan-consistency-lint + Codex, then EXECUTE without gating on his approval.
- sidecoach-mcp: "Wire it up" (not retire) - realize the original external-surface vision.
- cutover: greenlit ("Start the machinery") - sequenced AFTER these, as a separate additive build.

Plan written to `docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md`, stamped f3677189. Three units, one shared pattern (component-scoped settings.json/claude.json wiring - the sidecoach/voice/lotus idiom already in install.sh):
- **Unit A (bug fix):** move the 4 leaked cmux hooks (cmux-close-guard, cmux-teammate-shim-heal, resume-guard, resume-toggle) out of base claude/settings.json into the cmux component; the config-only repro (dangling exit-127 refs) must invert. Exact events/timeouts captured from a live probe (close-guard=PreToolUse/Bash/12, shim-heal=SessionStart/5, resume-*=/5).
- **Unit B (opt-in):** new default-OFF `fable` component (KEYS+arrays+detect+install+deactivate+help). Caught the hidden dep: fable-orchestrator-guard.sh execs detect-session-model.sh, so B0 resolves that (and flags the same latent gap in the base model-router-guard.sh) before wiring PreToolUse Write|Edit|MultiEdit|NotebookEdit|Bash/10.
- **Unit C (wire-up):** build sidecoach/mcp-server in the sidecoach install block + register portably in ~/.claude.json with a GENERATED $REPO_DIR path (not the hardcoded /Users/spare3 one in sidecoach/.mcp.json); deactivate pops it; package + run-tests.ts tether stay (no retire).

Every step carries a runnable verify (sandbox `HOME=$(mktemp -d) install.sh --only ...` assertions, grep/python/npm test), per Team Rule 7. Baseline-first (Rule 9): reproduce the cmux leak in a sandbox HOME before fixing. Risks surfaced for review: Unit C adds ~22 MCP tools to every session (register-on-pick default, matching lotus); Unit A does not retroactively clean already-merged installs (flagged, not silently migrated).

Why plan-first here (self-analysis continuity): earlier this session I mis-framed cmux/fable because I built options off research + the dependency map without reading install.sh. This plan is grounded entirely in re-read current-state excerpts (install.sh component catalogue, cmux install/deactivate, the claude.json MCP merge, the sidecoach block, a live hook-wiring probe) - reading the file that governs distribution before proposing distribution changes.

Files touched so far: docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md (new), decision_sidecoach_mcpserver_fate.md (ruling banner + origin section), decision_cmux_hardening_proposal.md (superseded_by), session_2026-07-15_cmux-fable-alacarte-leak.md (new), MEMORY.md (index).
