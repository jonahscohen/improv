---
name: skill-recon synthesis - 4 external UI skills gap analysis + roll-in plan
description: Consolidated findings from the skill-recon team; what to roll into sidecoach and where, what to skip. Key finding - the gaps are CAPABILITY not TASTE
type: project
relates_to: [session_2026-05-28_skill-recon-team.md]
supersedes: session_2026-05-28_skill-recon-team.md
---

Collaborator: Jonah. Synthesized 2026-05-28 from 4 recon teammates (skill-recon team).

## Headline finding
None of the 4 skills adds curated TASTE sidecoach is missing. Each is ~55-60% redundant with what we already absorbed (impeccable, make-interfaces, emil, leonxlnx, bencium, refactoring-ui, typeui + the codified validators). The genuine gaps are CAPABILITY / COVERAGE, not taste: Forms, gesture physics, chart-type selection, mobile-platform. This VALIDATES the "sidecoach is the taste authority" claim - the holes are domains we never built, not better taste. All 4 are MIT-licensed (clean to extract with attribution into reference/_extracted/external/).

## Per-skill verdicts
- **vercel-labs/agent-skills@web-design-guidelines** (real ruleset: vercel-labs/web-interface-guidelines/command.md, ~150 lint rules, React/Next/Tailwind-flavored) -> ROLL-IN-PARTIAL. Headline: Forms.
- **mblode/agent-skills@ui-animation** (CSS-first + Framer; MIT) -> ROLL-IN-PARTIAL. Headline: gesture/drag physics (GSAP-compatible pointer math). Framer JSX must be translated to GSAP; keep CSS + pointer math verbatim.
- **giuseppe-trisciuoglio/developer-kit@shadcn-ui** (real path plugins/developer-kit-typescript/skills/shadcn-ui/; ~3300/3700 lines are scraped official docs) -> ROLL-IN-PARTIAL, OPT-IN only (gate on components.json/Tailwind).
- **nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max** (.claude/skills/ui-ux-pro-max/, data-CSV driven, v2.5.0) -> SKIP CORE, roll-in 2 narrow data assets. Core recommender = category-default codification, philosophically opposed to our anti-slop stance; Google-Fonts monoculture conflicts fontshare.

## Prioritized roll-in plan
TIER 1 (HIGH value, codifiable, clear home):
1. Forms validator domain (NEW, ~20 rules from vercel): autocomplete/inputmode, never-block-paste, submit-stays-enabled-until-request + idempotency/spinner, inline errors + focus-first, placeholder ellipsis+example, trim trailing ws, unsaved-changes warn, Enter-submit/Cmd+Enter, label shares hit-target. -> extend 159-rule validator + Flow G. Sidecoach has ZERO forms coverage.
2. Gesture/drag physics (mblode): velocity-dismiss (>0.11 + 20px min), boundary damping max*(1-exp(-offset/max)), setPointerCapture, multi-touch lockout, friction-not-hard-stop. -> new gesture section in motion-reference + motion-domain thresholds. GSAP-compatible.

TIER 2 (MED, codifiable, extend existing):
3. Content-resilience (vercel): min-w-0 for flex truncation, line-clamp/break-words, designed empty/sparse/dense/error states, stable skeletons. -> polish domain / Flow J.
4. clip-path techniques (mblode): inset reveals, tab color transition, hold-to-delete, comparison sliders. -> motion-reference.
5. CSS transition recipe catalog + element->recipe decision table, 12 recipes (mblode). -> Flow H + motion-reference.
6. URL-as-state / navigation (vercel): filters/tabs/pagination in URL, scroll restore, <a>/<Link> for cmd-click, destructive=confirm/undo, optimistic+rollback. -> new navigation-state notes. React/Next-flavored (down-weight if vanilla).
7. Dark-mode device-UI mechanics (vercel): color-scheme:dark, theme-color meta, native <select> explicit bg+color. -> color domain.
8. Touch/mobile interaction CSS (vercel): touch-action:manipulation, tap-highlight, overscroll-behavior:contain in modals, input font-size>=16px (iOS zoom). -> Flow M / polish.
9. Chart-type SELECTION decision matrix (ui-ux-pro-max charts.csv): when-to-use/not, data-volume thresholds (SVG/Canvas/aggregate), per-type a11y grade + fallback + lib. -> data-viz domain (clean, no taste conflict).
10. 2 motion-validator rules (mblode): high-frequency-invert timing (ephemeral UI enters 0ms, exits 100-150ms); paired-elements-share-easing (modal+overlay, tooltip+arrow). -> motion domain.
11. UX copywriting (vercel): active voice, Title Case buttons/headings, specific labels, errors-include-fix, numerals. -> Flow B writing + copy validator. Opinionated defaults (Vercel-specific), not hard rules.
12. Char-substitution lint (vercel): ellipsis char, curly quotes, &nbsp; glued units, scroll-margin-top anchors. -> typography domain. (emdash ban already in content-guard - do NOT double-implement.)
13. Image perf (vercel): explicit width/height, loading=lazy below-fold, fetchpriority=high above-fold. -> performance domain.
14. Perf specifics (vercel): idempotency keys, latency budget <500ms mutations, content-visibility:auto, no-layout-reads-in-render (aligns with validation-guard philosophy). -> performance domain.

TIER 3 (opt-in / conditional):
15. shadcn taste-validator carve-out: recognize Tailwind token-utilities (bg-primary/90, rounded-md=--radius) as token-compliant so they pass hardcoded-hex / radius-drift checks. False-positive prevention - worth doing if ANY Tailwind projects exist. Codifiable. Watch token-format bridge (DESIGN.md {path.to.token} vs shadcn HSL-channel CSS vars).
16. shadcn-ui opt-in reference (cn/cva, Radix asChild/Slot, RHF+Zod, next-themes, ChartContainer): gate on components.json/Tailwind detection; NOT global. Cookbook prose.
17. Native/mobile HIG+Material reference (ui-ux-pro-max): safe areas, Dynamic Type, haptics, tab-bar, 44pt/48dp, gesture-nav. NEW platform-native reference ONLY if dotfiles ever targets mobile. Currently web-only -> DEFER.

## SKIP (redundant or opposed)
- ui-ux-pro-max product-type reasoning engine (category-default codification = anti-slop antithesis), its Google-Fonts pairings (fontshare monoculture conflict), React-perf/stack CSVs, MASTER.md workflow.
- mblode spring presets (Framer/GSAP clash - prose-only at best).
- All redundant a11y / easing / scale-press / shadow / radius / contrast bulk across all four (already in our validators + polish standard + references).

## Recommended first move
Tier 1 only: Forms validator domain + gesture-physics into motion-reference/motion-domain, plus the shadcn validator carve-out (false-positive prevention). Those are the highest-value, cleanest, taste-neutral wins. Tier 2 is a codifiable backlog; Tier 3 mobile defers until mobile is in scope.
