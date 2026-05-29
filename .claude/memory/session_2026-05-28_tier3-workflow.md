---
name: Tier 3 via dynamic workflow - shadcn opt-in cookbook reference
description: Batch 2 of the skill-recon roll-in; Jonah chose a dynamic workflow (wedge-resilient) over a cmux team for the single small reference doc
type: project
relates_to: [session_2026-05-28_tier2-shipped.md, session_2026-05-28_skill-recon-synthesis.md, decision_orchestration_routing_cmux_vs_workflows.md]
superseded_by: session_2026-05-28_tier3-shipped.md
---

Collaborator: Jonah. 2026-05-28.

## Why a workflow (not a team)
The thinking-block wedge hit background teammates 3x this session (t0025, tier2-content-perf, tier2-references). Tier 3 is small (one shadcn opt-in cookbook reference doc; mobile/HIG reference deferred - web-only). Jonah chose to run it as a dynamic Workflow: it is wedge-resilient (checkpoint + resume), exercises the resilient path we discussed, and a team's panes add little for a single doc. This is the "opt out of a cmux team while in cmux -> use a workflow" clause from the orchestration-routing decision, triggered by the wedge frequency.

## Scope (T-0037)
Write `sidecoach/reference/_extracted/external/shadcn-ui/COOKBOOK.md` (match _extracted/external convention: frontmatter source URL + type + MIT attribution). Content from giuseppe-trisciuoglio/developer-kit shadcn-ui skill: cn()/cva, Radix asChild/Slot, RHF+Zod, CSS-var HSL-channel theming, next-themes, components.json + CLI (+ registry-security note), ChartContainer/Recharts. Framed OPT-IN (consult only when components.json/Tailwind+Radix present). SKIP the ~3300 lines of scraped official-doc install snippets. The shadcn taste-validator carve-out already shipped in Tier 1 (T-0032), so this is reference-only.

## Workflow shape
2 phases: Draft (agent fetches the shadcn skill source + writes the cookbook doc) -> Verify (agent adversarially checks accuracy vs shadcn docs, MIT attribution present, opt-in framing, no fabricated Radix/shadcn APIs; returns a structured verdict). Lead then re-verifies + commits + removes T-0037.

## Pipeline state
Tier 2 shipped + committed (324bfe0, 8ba25f8), tasks removed, team torn down. Tier 3 queued (T-0037); launching the workflow next. After Tier 3 lands the skill-recon roll-in is complete (Tier 1 + 2 + 3 done; mobile HIG the only deferred remainder).
