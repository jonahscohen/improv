---
name: Tier 2 build pipeline - tasks filed + team
description: Filed skill-recon Tier 2 as T-0034/35/36 and deployed a 3-teammate cmux team; lead wires rule-modules into the validator, validates, commits, removes tasks
type: project
relates_to: [session_2026-05-28_skill-recon-synthesis.md, session_2026-05-28_tier1-shipped.md, decision_orchestration_routing_cmux_vs_workflows.md]
---

Collaborator: Jonah. 2026-05-28. Jonah's pipeline: queue Tier 2 -> team build -> lead validate -> commit -> remove tasks -> then Tier 3 same way (confirmed "P3 = Tier 3"; per-batch commit).

## Decomposition (collision-safe by isolated rule-modules)
~8 of 12 Tier 2 items add rules to the single extended-domain-validator.ts (chokepoint, same as Tier 1). To parallelize safely without serializing: teammates write NEW isolated rule-module files; the LEAD wires them into DOMAIN_RULES (import + spread) at integration. Three fully-disjoint owners:
- T-0034 tier2-content-perf: NEW src/domains/tier2-content-perf.ts (content-resilience/polish, touch/mobile, image-perf, perf-specifics/performance).
- T-0035 tier2-visual-copy: NEW src/domains/tier2-visual-copy.ts (dark-mode/color, chart-selection/data-viz, 2 motion rules, char-substitution/typography, UX-copywriting advisory).
- T-0036 tier2-references: motion-reference docs (clip-path + CSS recipe catalog), navigation-state reference doc, + flow-handler wiring (Flow J/M/H/B reference the new domains). Owns reference/ + flow-handler-*.ts.
LEAD integration: add imports + spreads of the two rule modules into extended-domain-validator.ts DOMAIN_RULES, MCP domain exposure if new inputs needed, rebuild dist, validate (tsc parent+mcp + test suites), commit per-batch, then remove the Tier-2 tasks.

cmux team (in-cmux per routing decision), background, named panes, no worktree (disjoint files).

## Status
Tasks filed; spawning the 3-teammate team next. Tier 3 (opt-in shadcn cookbook reference + native/mobile HIG reference) is the next batch after Tier 2 lands.
