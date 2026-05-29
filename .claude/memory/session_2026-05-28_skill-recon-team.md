---
name: skill-recon team - gap analysis of 4 external UI skills vs sidecoach
description: Deployed cmux team to research 4 external design/UI skills and identify gaps vs sidecoach's current taste/reference coverage; lead synthesizes + places
type: project
relates_to: [session_2026-05-28_task-queue-team-deploy.md, decision_orchestration_routing_cmux_vs_workflows.md]
---

Collaborator: Jonah. Deployed 2026-05-28.

## Context
Jonah is evaluating new skills to roll into sidecoach's reference layer. First confirmed what's ALREADY baked in: Impeccable (extracted to core validators, soft-deprecated), make-interfaces-feel-better (= 14 baseline of the 22-Point Polish Standard, Flow J), Emil Kowalski (reference/_extracted/external/emil-design-eng), Leonxlnx taste-skill (reference/_extracted/external/taste-skill), plus bencium-design, refactoring-ui, typeui-fundamentals. So sidecoach is already a consolidated + partially-codified taste authority. Then Jonah named 4 NEW candidate skills to vet for gaps.

## Routing
In cmux-teams mode (per decision_orchestration_routing_cmux_vs_workflows.md), so this runs as a cmux TEAM in panes, not a workflow. Team `skill-recon`, 4 general-purpose teammates (named cmux splits), read-only research, run_in_background, no worktree.

## Roster (one skill each)
- `t-vercel-wdg` - vercel-labs/agent-skills @ web-design-guidelines
- `t-mblode-anim` - mblode/agent-skills @ ui-animation (warned: sidecoach already motion-dense - motion-reference + Flow E/H + bencium MOTION-SPEC + emil easings; be rigorous on redundancy)
- `t-shadcn` - giuseppe-trisciuoglio/developer-kit @ shadcn-ui (library-specific Radix+Tailwind; assess opt-in-reference vs global default; check token mapping vs DESIGN.md)
- `t-uiuxpromax` - nextlevelbuilder/ui-ux-pro-max-skill @ ui-ux-pro-max (kitchen-sink name; flag generic/shallow content honestly)

## Job each teammate runs
Fetch the skill (GitHub agent-skill convention skills/<name>/SKILL.md, fallback tree-browse), summarize, diff against sidecoach coverage, classify each element REDUNDANT / PARTIAL / GAP, place each GAP/PARTIAL (which reference system + flow A-M + validator, prose-vs-codifiable, value), and give a verdict (roll-in-full / partial / skip-redundant) + confidence + license flag.

## Baseline given to teammates (sidecoach current coverage)
4 reference systems (component-gallery, fontshare, design-references, motion); extracted external (emil-design-eng, taste-skill, bencium-design, refactoring-ui, typeui-fundamentals); Impeccable-in-core; codified taste-validator.ts anti-slop checks + 22-Point Polish Standard + 159-rule 10-domain validator; flows Tier1 A-E research / Tier2 F-M execution.

## Status
Spawned, running as cmux splits. Awaiting reports. Lead will synthesize into a consolidated gap+placement plan, then TeamDelete.
