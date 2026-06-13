---
name: Stats band - lede trimmed, beat-count stat, staggered fade + border progress bars (via Justify)
description: Three-prompt batch - lede last sentence removed; zero stat replaced with Session beats 457 (real, counted from .claude/memory); stats stagger-fade in and each stat's top border fills left-to-right in red tracking its own count-up
type: project
relates_to: [session_2026-06-11_stats-lede-depth.md]
---

Collaborator: Jonah. 2026-06-11. Via Justify (3 prompts).

1. Lede: "And every one is reproducible from the repo - clone it and count for yourself." removed; depth sentence stands alone.
2. Stat 6 "Accounts, dashboards, telemetry / 0" replaced with "Session beats / 457 / The project's own running memory." - real number: `ls .claude/memory/session_*.md | wc -l` = 457 at edit time (gets the count-up + progress bar like the rest; the static 0 never could).
3. Entrance: count-up JS rebuilt from per-span observation to container-level - observer watches .stats once, then staggers each stat at i*140ms: adds .is-in (fade-up via .stats--animate gate) and runs the count tick which now ALSO writes --count-progress (eased) on the stat; .stat::before is a red 1px bar laid over the top border, scaleX(var(--count-progress)) origin left - the border literally fills left-to-right in step with that stat's own counting. Reduced-motion/no-JS: .stats--animate never applied, band renders fully visible, no bars.
- styles.css ?v=30.

VERIFIED mid-animation (the honest capture): frame 1 shows only stat 1 ghosting in; frame 2 shows stats 1-2 mid-fade with stat 1's border ~70% red and stat 2's ~10% (borders tracking each stat's own count, stagger visibly left-to-right); frame 3 shows row 2 entering with Session beats counting toward 457. Lede ends at "layer over layer." Responded x3 with full schema; hot refresh delivered the change to all tabs.

Files: marketing-site/index.html (lede, stat 6, count-up JS, v30), marketing-site/styles.css (stat::before progress, stagger gate).

## Correction (Jonah reply): package stats, not project milestones
"Do not use our actual beats count, use another stat that describes the package, not our milestones." Session beats 457 -> **Design verbs / 22 / "One shared vocabulary, shape to ship."** (count verified against sidecoach/src/verb-command-registry.ts - 22 distinct verbs). RULE for the stats band: numbers must describe what a CLONER receives (validators, hooks, verbs, components), never our own usage mileage (beat counts, sessions, hours). Verified settled: 26/218/49/17/27/22, all progress borders full.
