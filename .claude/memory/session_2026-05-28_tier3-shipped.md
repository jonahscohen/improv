---
name: skill-recon Tier 3 SHIPPED (T-0037) - shadcn opt-in cookbook, via workflow
description: shadcn/ui opt-in cookbook reference doc built by a dynamic workflow (draft -> adversarial verify), wedge-free; completes the skill-recon roll-in
type: project
relates_to: [session_2026-05-28_tier3-workflow.md, session_2026-05-28_tier2-shipped.md, session_2026-05-28_skill-recon-synthesis.md]
supersedes: session_2026-05-28_tier3-workflow.md
---

Collaborator: Jonah. Shipped 2026-05-28. Closes the skill-recon roll-in (Tier 1 + 2 + 3).

## What shipped
`sidecoach/reference/_extracted/external/shadcn-ui/COOKBOOK.md` - a concise OPT-IN shadcn/ui cookbook reference. 9 sections: opt-in scope gate, cn()=clsx+tailwind-merge, cva+VariantProps, Radix asChild/Slot, RHF+Zod resolver wiring, CSS-variable HSL-channel theming, next-themes dark mode, components.json + `npx shadcn add` CLI + registry-security note, ChartContainer/Recharts theming. Frontmatter matches the _extracted/external convention + an `applies_when` gate. MIT (c) Giuseppe Trisciuoglio attributed. The ~3300 lines of scraped official-doc install bloat were deliberately excluded (noted in frontmatter + footer). The shadcn taste-validator carve-out already shipped in Tier 1 (T-0032); this is reference-only.

## Ran as a dynamic workflow (wedge-free)
Per Jonah's choice, Tier 3 ran as a Workflow (wf_c7506a1e-2f7), not a cmux team - chosen for wedge-resilience after 3 team wedges this session. 2 phases (Draft fetches the skill source via gh api + writes the doc; Verify adversarially checks accuracy/attribution/opt-in/no-fabrication with a structured verdict). 2 agents, 19 tool uses, ~217s, NO wedge. The resilient path worked first try - validating the "opt out of a cmux team -> workflow" clause for wedge-prone small batches.

## Lead verification (beyond the workflow's own verify)
- Workflow verdict: ok=true, all 5 checks pass (chart APIs verified verbatim vs ui.shadcn.com, forms vs RHF docs, cn/cva/Slot/theming/next-themes/components.json all real - no fabricated APIs).
- I independently confirmed all 8 cited source_files exist in the repo (gh api -> 200 OK each), so the provenance/source_files frontmatter is accurate (clears the verify agent's "unverified but plausible" nit).
- Applied the one minor fix the verify agent flagged: line 217 `error.errors` -> `error.issues` (canonical in Zod v3 AND v4; forward-safe).

## Pipeline complete
Skill-recon roll-in done: Tier 1 (T-0030/31/32) + Tier 2 (T-0034/35/36) + Tier 3 (T-0037) all shipped. Only deferred remainder: the native/mobile HIG reference (web-only, recommended-deferred). The wedge root-cause fix (T-0033) and TASKS cleanup also landed this session.

## Files
- NEW sidecoach/reference/_extracted/external/shadcn-ui/COOKBOOK.md
