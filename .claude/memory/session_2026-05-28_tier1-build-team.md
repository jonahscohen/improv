---
name: Tier 1 skill roll-in - tasks filed + build team
description: Filed skill-recon Tier 1 as T-0030/31/32 and deployed a 2-teammate cmux team to build, scoped by file ownership to avoid the shared-validator collision
type: project
relates_to: [session_2026-05-28_skill-recon-synthesis.md, feedback_agent_worktree_isolation_unreliable.md]
---

Collaborator: Jonah. 2026-05-28.

## Tasks filed (Tier 1 only, per Jonah)
- T-0030 [P2] Forms validator domain (~20 rules from Vercel web-interface-guidelines) -> extended-domain-validator.ts DOMAIN_RULES + MCP exposure if needed + Flow G reference + extract source to reference/_extracted/external/vercel-web-interface-guidelines/.
- T-0031 [P2] Gesture/drag physics -> motion-reference gesture section (Framer translated to GSAP/vanilla pointer math) + motion-domain rules in extended-domain-validator.ts.
- T-0032 [P2] shadcn/Tailwind token carve-out in taste-validator.ts (recognize bg-primary/90, rounded-md=--radius, hsl(var(--token)) as token-compliant; gate to Tailwind context).

## Build decomposition (file ownership, NOT task count)
Architecture fact: extended-domain-validator.ts (2412 lines) holds ALL domain rules in one DOMAIN_RULES array. So T-0030 (forms domain) and T-0031 (motion gesture rules) BOTH edit that one file -> collision. T-0032 edits the separate taste-validator.ts (319 lines) -> disjoint. Worktree isolation is a no-op (confirmed), so teammates share the main tree.

Decision: 2 teammates, scoped by file:
- `validator-domains` teammate owns T-0030 + T-0031 (both touch extended-domain-validator.ts + the motion-reference + MCP forms wiring). One agent owns that file -> no intra-file race.
- `taste-carveout` teammate owns T-0032 (taste-validator.ts only) -> fully parallel, disjoint.
This applies the task-queue lesson: scope by shared-file ownership, not 1-teammate-per-task. In-cmux so it runs as a cmux team in panes (per the orchestration-routing decision). Read/build + return; lead verifies (tsc + tests) + commits + writes per-task DONE notes.

## Status
Filing committed; spawning the 2-teammate team next.
