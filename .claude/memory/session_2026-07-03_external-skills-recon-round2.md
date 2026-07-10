---
name: External skills recon round 2 - emilkowalski, shadcn/improve, mattpocock
description: Jonah asked what is gainable from three external skill repos; grounded in prior eval beats + fresh upstream fetch - Emil has 2 new unabsorbed animation skills, shadcn/improve unchanged but our 3 approved steals were NEVER implemented, mattpocock is net-new (workflow lane, 4 borrow candidates)
type: reference
relates_to: [reference_shadcn-improve-eval.md, session_2026-06-12_external-skill-eval-six-skills.md]
---

Collaborator: Jonah. 2026-07-03.

## Finding that matters most: the borrow backlog is unexecuted
Grep-verified: none of the three approved shadcn/improve steals (leverage scoring in audit/critique, verification-baseline-as-finding-#1 gate, commit-hash drift stamping on plans) ever landed - no trace in flows.ts, CLAUDE.md, plans, or TASKS.md. The 2026-06-12 six-skills eval likewise says "NOTHING IMPLEMENTED YET" and no later beat implements its ranked borrow list (incl. double-sourced items: pause-offscreen animations, CSS-var animation perf, tool-boundaries discipline, frequency principle). Pattern: we evaluate externals rigorously, produce ranked borrow lists, then never execute them. New external evals add to a queue nobody drains.

## Repo-by-repo (fresh fetch 2026-07-03)
1. emilkowalski/skills (4.6k stars): now THREE skills - emil-design-eng (absorbed 2026-05-25 as sidecoach/reference/_extracted/external/emil-design-eng/), plus TWO NEW unabsorbed: review-animations (rigorous animation evaluation vs established rules - overlaps sidecoach motion validator/critique, likely detector-grade material) and animation-vocabulary (communicating animation intent to AI - feeds the animate verb / motion-reference vocabulary). Emil borrows historically high-value. GAIN: yes, targeted absorption of the two new ones.
2. shadcn/improve (6.7k stars, 22 commits, no releases): materially unchanged vs the 2026-06-13 eval (issues flag, focused audits, drift stamps - all already in reference_shadcn-improve-eval.md). GAIN: not from upstream - from finally implementing our own 3 steals.
3. mattpocock/skills: NET-NEW, never evaluated. Different lane: engineering workflow, not design - overlaps the superpowers/protocol layer, not sidecoach. Mostly duplicates standing protocols (diagnosing-bugs vs Debugging Protocol, code-review vs Codex cross-model gate, domain-modeling/ADRs vs decision beats, tdd generic). Four borrow candidates worth a targeted single-pass eval: the reusable "grilling" interview loop (could strengthen sidecoach teach / plan clarification), the handoff-doc format (structured briefs for cmux teammate dispatch), to-issues vertical-slice discipline (relevant to feedback_team_spawn_claim_race), writing-great-skills (skill-authoring standard - we author skills constantly).

## Recommendation given to Jonah
Drain before filling: implement the existing approved borrow backlog (3 shadcn steals + double-sourced six-skills items) ahead of any new evaluation; absorb Emil's two new skills (proven vein); mattpocock gets a cheap targeted eval only if the workflow lane feels underpowered.

Files touched: this beat + MEMORY.md.
