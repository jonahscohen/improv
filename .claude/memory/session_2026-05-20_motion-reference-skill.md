---
name: motion-reference skill built
description: New skill bundling canonical GSAP + Lenis patterns for animation/scroll/transition work. GSAP + Lenis only, no fallback libraries. Patterns embedded inline (no live doc fetch).
type: project
relates_to: [session_2026-05-19_fontshare-reference-skill.md, session_2026-05-20_design-references-catalog.md]
---

## What shipped (2026-05-20)

Jonah's question: "can we combine GSAP + Lenis feature set under a skill we can call up when creating animations/transitions/interactions?" The answer is `motion-reference`, modeled on `fontshare-reference` in shape.

Two decisions locked via multiple choice:
1. **Library scope**: GSAP + Lenis only, no fallbacks (no anime.js, Locomotive, Waypoints, Walkway in this skill)
2. **Posture**: Canonical patterns embedded inline (no live doc fetching during use)

## Skill contents

- License clarity (GSAP fully free since Webflow acquisition - SplitText, MorphSVG, DrawSVG, ScrollSmoother, etc. all open)
- Routing table (task -> tool)
- Canonical patterns:
  - Basic tween / timeline / stagger
  - ScrollTrigger pin + scrub (the most common scroll animation)
  - GSAP + Lenis integration (the 3-line glue snippet)
  - React `useGSAP` hook with scope
  - React `ReactLenis` root provider
  - Flip layout transition
  - SplitText word/char stagger
  - DrawSVG path animation
  - Snap-to-section scrolling
- Gotchas: SSR, ScrollTrigger.refresh after dynamic content, Lenis breaking native scrollIntoView, iOS Safari + Lenis + fixed position, React cleanup without useGSAP, plugin registration
- Anti-patterns
- Integration with `impeccable` (strategy) and `make-interfaces-feel-better` (tactical polish)
- When NOT to use this stack (CSS transitions are fine for simple cases)

## Wiring

- `claude/skills/motion-reference/SKILL.md` (canonical source)
- `~/.claude/skills/motion-reference/SKILL.md` (active install)
- `install.sh` updated at 5 spots (header comment, picker description, file list, deactivate, install block)
- `claude/CLAUDE.md` design stack diagram - added `Motion:` row between References and Tactical

## Second-fix-gate v2 observation

The 5-spot install.sh edits triggered the gate ONCE during today's earlier design-references scaffold. Today's motion-reference scaffold did the same install.sh edits - no warning this time because the per-file warned-flag from the earlier scaffold was still within the 10-min window. v2 behavior is consistent: warn-once-per-file-per-window, regardless of which logical task is doing the editing.

## What this skill does NOT cover (intentional)

- anime.js, Locomotive Scroll, Waypoints.js, connoratherton/walkway - all excluded per scope decision. If Jonah ever needs those, they'd warrant their own skill or a "legacy-motion-fallbacks" supplement.
- Framer Motion / Motion.dev - different ecosystem. The skill mentions "do not animate same transform on same element with both" but doesn't otherwise touch it.
- CSS-only animations (transitions, @keyframes, Web Animations API) - intentionally out of scope. The skill explicitly says "do not use GSAP for trivial CSS transitions."

## Files touched

- `claude/skills/motion-reference/SKILL.md` (new)
- `~/.claude/skills/motion-reference/SKILL.md` (active copy)
- `install.sh` (5 edits)
- `claude/CLAUDE.md` (design stack row added)

## Collaborator

Jonah
