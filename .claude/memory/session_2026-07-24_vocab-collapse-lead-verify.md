---
name: Vocab collapse (GAP5) lead-verified + committed; deep deletion gated on the mcp-server decision
description: Lead independently confirmed vocab-collapse's zero-routing-change (routing goldens zero drift, forge/research/polish all resolve identically, scope = only bin+router+SKILL with orchestrator/modes/verb-registry untouched, 76 green). Committed. Records the emerging gating decision: the deep vocab line-deletion AND the classifier dedup both wait on the mcp-server retirement (the audit's Decision B, unexecuted).
type: project
relates_to: [decision_2026-07-24_vocab-collapse-and-plugin-coupling.md, session_2026-07-24_vocab-collapse-phase-aliases.md, session_2026-07-24_simplification-plan.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - lead re-ran routing-snapshot verify (zero drift), npm test 76, build clean, and spot-checked research/forge/polish resolution
confidence: high
---

Collaborator: Jonah. 2026-07-24. vocab-collapse (option B, alias map) landed and I independently verified it before committing.

## Lead verification (not the teammate's self-report)
- **Scope**: git status shows ONLY `bin/sidecoach.js` + `src/slash-command-router.ts` (+ SKILL.md doc + dist). Confirmed UNTOUCHED: sidecoach-orchestrator.ts, modes.ts, verb-command-registry.ts, validators/, audit-rendered.ts, project-context.ts. No off-limits file.
- **The ONE RULE (zero routing change)**: `routing-snapshot.mjs verify` -> VERIFY OK (zero drift, not even alias-equivalent). Spot-checked: `research` -> verb research, `polish` -> verb polish, and critically `forge` (a RETIRED mode word) -> still "Resolved mode: forge". De-advertised, still functional - exactly the behavior-preservation intent.
- **Gate**: build clean, npm test 76 (== baseline, 0 failed). Codex: no findings.

## Honest scope (committed as-is)
Net +12 lines - a SURFACE collapse + semantic reframe (SLASH_COMMANDS -> PHASE_ALIASES; modes de-advertised from usage/list/help while getMode still resolves), NOT the plan's ~300-line deletion. The user-facing vocabulary IS simpler now (verbs + NL advertised; phases/modes are back-compat aliases). Committed `<hash recorded in git>`.

## EMERGING GATING DECISION (surface to Jonah when on the critical path)
The DEEP simplification wins are all blocked on ONE decision - **retire the mcp-server (the audit's Decision B, standing WIRE-UP ruling 2026-07-15 unexecuted)**:
- vocab deep-delete: `modes.ts` (-193) is imported by `mcp-server/src/registries.ts`; can't delete until the mcp-server goes or stops importing it.
- `getAvailableCommands` phase half (-90) feeds the off-limits orchestrator list handler.
- The audit's "irreducible floor": collapsing the TRIPLICATED classifier -> duplicated also requires retiring the dead mcp-server keyword-resolver copy.
- mcp-server is 4156 tracked files.
So the mcp-server retire/keep decision is the single biggest remaining lever on the "simpler" mission-primary goal. NOT asked yet - deferred because plenty of non-blocked work remains (Stage 3c, 4b/c/d, 2a-2d) and the autonomous mandate favors momentum over stalling on a not-yet-needed decision. Surface it when the deep-delete work reaches the critical path or Jonah returns.

## Files touched
- this beat + MEMORY.md index. The commit itself: bin/sidecoach.js, slash-command-router.ts, SKILL.md, dist, vocab beat.
