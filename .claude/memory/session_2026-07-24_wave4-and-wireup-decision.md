---
name: Wave 4 integrated (Stage 2 complete + phase-2 harness deletes) + Jonah rules WIRE-UP not delete for the 3 built-never-wired services
description: stage2bd (Stage 2b pre-render authorship + 2d exclusion-safe deck) + simplify-cut2 (8 dead harnesses, -1166 lines) integrated and committed, 81 suites green. Jonah reversed the delete lean on the 3 built-never-wired services - make ALL THREE real - reference-update-service (sensible, not over-designed), flow-domain-integration (evaluate supersession first, wire if not superseded), project-drift-detector (wire it up). North star: functionally better/faster/easier/more real than oracle.
type: decision
relates_to: [session_2026-07-24_wave3-lead-verify.md, session_2026-07-24_simplification-phase2-deadcode.md, decision_sidecoach_mcpserver_fate.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: gate - npm run build clean, npm test 81 suites; stage2bd broken-mock-halts + exclusion-grep proven; simplify-cut2 tsc-clean deletes
confidence: high
---

Collaborator: Jonah. 2026-07-24/25.

## Wave 4 integrated + committed
- **Stage 2 COMPLETE**: 2b pre-render authorship (bin/sidecoach-preauthor + src/pre-authorship: authors board+mock, renders BOTH headless via runRenderedAudit, gates on the mock - real verdict never inconclusive on a well-formed mock, broken-mock -> blocked -> HALT exit 1, no-browser -> inconclusive exit 3 fail-closed) + 2d exclusion-safe deck (bin/sidecoach-deck + src/direction-deck-present: dual-surface markdown table / static artifact, NO in-browser variant surface - grep-proven, permanent exclusion self-scan test). Foreground Codex 6/8 folded (CSS-injection via font stacks, gate fail-open, TTY hang, silent-drop, markdown injection). Found+fixed a real stdout-truncation-over-pipe bug (flush-safe callback).
- **Simplification phase 2**: 8 dead harnesses deleted (-1166 lines, tsc-proven, Codex no-blocker). convergence-loop KEPT (plan drift confirmed - its test is a live gate). No run-tests removals (none were gated).
- Gate: build clean, 81 suites.

## Jonah's ruling on the 3 built-never-wired services: WIRE UP, make real (NOT delete)
Reversed the delete lean. This is the wire-up-not-retire choice (the option not taken for the mcp-server). North star restated: functionally better, more performant, easier to use, MORE REAL than oracle.
1. **reference-update-service** (337L, keep-the-references-fresh): make it REAL + SENSIBLE, do NOT over-design. Think through the genuine usefulness of an update service for the bundled references (version check / fetch / merge-with-user-captures / DESIGN.md update).
2. **flow-domain-integration** (124L, flows auto-apply domain rules): LEAD DECIDES - EVALUATE whether it is actually superseded by how flows currently apply domain rules (the orchestrator path); if NOT superseded, make it real; if superseded, say so with proof.
3. **project-drift-detector** (84L, flag tokens drifting from the design system): WIRE IT UP, make it real - surface token drift in a useful place (a detect/audit check or CLI comparing project tokens vs DESIGN.md).

## Files touched (lead integration)
- scripts/run-tests.ts (stage2bd's 2 suite lines), dist rebuild, this beat + MEMORY.md. Wave 4 committed per-unit; 3 wire-up teammates dispatched next.
