---
name: Deployed cmux-teams teammate to integrate reference skills into Sidecoach pipeline + cmux-teams spawn CONFIRMED WORKING again
description: Spawned named foreground teammate sidecoach-reference-integrator to wire orphaned reference flows (flowC/flowD) into lanes, build an auto-inject reference preflight, and deepen bundles - while keeping skills directly usable. Also confirms the cmux-teams harness break is resolved after session restart.
type: project
relates_to: [reference_sidecoach_reference_routing_map.md, session_2026-06-22_cmux-teams-break-and-guard-fix.md, decision_orchestration_routing_cmux_vs_workflows.md]
---

Collaborator: Jonah Cohen

## cmux-teams spawn works again (resolves the open question in the break beat)
Earlier today cmux-teams Agent spawn failed: `~/.claude/teams/` was EMPTY, harness errored "team file for 'session-...' not found, should have been initialized at startup." Recommended remedy was "restart the cmux claude-teams session." This session is post-restart: `CMUX_SOCKET_PATH` set, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, and `~/.claude/teams/session-52f915eb/` now EXISTS (plus a matching `~/.claude/tasks/session-52f915eb/`). A named foreground Agent call spawned successfully -> `sidecoach-reference-integrator@session-52f915eb`. So: the restart remedy works; the implicit per-session team is created at startup again. Spawn recipe that worked: Agent({subagent_type: general-purpose, name: <name>, prompt}) - NO team_name, NO model param, foreground (no run_in_background). This matches the agent-teams-guard fix (requires `name` only) and the orchestration-routing decision (in cmux -> named teammate panes).

## What was deployed
A single named foreground teammate to make Jonah's "self-contained behemoth" vision real: adapt the reference skills' contents into Sidecoach's pipeline WITHOUT destroying direct skill use. Brief deliverables:
- A. Routing fix: wire orphaned flowC_font_research + flowD_reference_inspiration into lane_build (and lane_delight/lane_live where they help); wire flowC into the `typeset` verb. Edit SOURCE (claude/hooks/sidecoach-lanes.json + verb-command-registry.ts) then regenerate - never hand-edit lanes.generated.ts.
- B. Auto-inject preflight: any build/refinement lane auto-queries the relevant reference systems and injects results as artifacts regardless of verb (component patterns, LIVE design-references catalog matches vs PRODUCT.md voice, font candidates, motion patterns, icon-source). Soft-fail/additive.
- C. Depth audit: enrich thin bundles from the standalone skills' real content (reference-update-service); extend to reference-dependent skills (visual-effects, tilt-lab, icon-source) as attached artifacts.
- D. Preserve direct use: skills stay auto-triggering and directly invocable (hard requirement).

## Verification bar handed to the teammate
Plan-first (verify-clause lines); `cd sidecoach && npm run build` exits 0; `npm test` green; PROVE references now fire via real engine output (before/after on `/sidecoach craft ...` showing font + design-ref + component artifacts that were absent); confirm skills intact; optional Codex (codex:rescue) cross-model review of the diff.

## Why this approach
Jonah's prior-turn ask produced the routing map (the gaps). The fix is routing + an auto-inject preflight, not new capability - the accessors and flow handlers already exist and work. Single teammate (Jonah said "deploy an agent", singular; self-analysis from the break beat said spawn ONE named foreground teammate, keep main-thread recon minimal).

## Files (mine, this session - recon + deploy only)
- .claude/memory/reference_sidecoach_reference_routing_map.md (prior turn)
- .claude/memory/session_2026-06-22_sidecoach-reference-integration-deploy.md (this)
- The implementation diff is the teammate's; it will write its own per-task beats.
