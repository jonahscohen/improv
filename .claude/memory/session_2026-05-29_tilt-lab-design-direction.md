---
name: tilt-lab design-team direction (CD synthesis) - instrument, not dashboard
description: Creative-director synthesis of the 3 research briefs for the tilt-lab look+utility rethink. North star "instrument not dashboard"; canvas-dominant; dissolve cards/pills; type voice + scrub numerics; utility = preview thumbnails, layer enable/opacity, server-free export. Two taste forks (typeface, accent) pending user.
type: decision
relates_to: [session_2026-05-29_tilt-lab-taste-DONE.md, session_2026-05-29_tilt-lab-ui-audit.md]
---

Collaborator: Jonah. 2026-05-29. design-team sprint, Phase 1 research done (researcher + ux-designer + brand-strategist). User: prior pass was cosmetic, wants REAL look-and-feel + utility change.

## Convergent north star: "INSTRUMENT, NOT DASHBOARD"
All 3 briefs agree: it reads as a generic Tailwind-dark SaaS dashboard. Reframe as a precision console (synth/oscilloscope) - near-black matte chrome around ONE luminous subject (the preview). Flagship = confidence + precision, not decoration.

## LOOK direction
1. CANVAS-DOMINANT: preview fills (~70-85%); side panels become collapsible instrument rails, not equal dashboard columns; fullscreen toggle. ("preview is the product")
2. DISSOLVE CARDS + PILLS: replace boxed cards + the pill/dropdown filter row with hairline-ruled MODULE groups + tiny UPPERCASE letter-spaced micro-labels. Browse becomes a thumbnail grid.
3. TYPE VOICE (researcher: the #1 generic tell): system-UI sans is anonymous. Add a characterful mono/grotesk for wordmark + labels + numerics; big TABULAR-MONO value readouts beside each control. (Bundle self-hosted woff2 - a LOCAL tool can bundle a font with no network round-trip, resolving brand's "system fonts only / no round-trip" concern.)
4. WARM-SHIFT neutrals slightly off cold pure-gray ("designed" not bootstrap-dark).
5. ACCENT as a single LED per view (sparse, points-never-paints); brand law = single accent, dark, flat/no-shadow, no-new-hex. Depth from surface-step ladder + 2-tier hairlines + SIZE, never shadow.

## UTILITY direction (the "real sensible changes", ranked)
1. LIVE PREVIEW THUMBNAILS on browse cards (mini-canvas per effect; factories already render to canvas) - turns the blind text list into a real visual catalog. #1.
2. PER-LAYER ENABLE + OPACITY (LayerConfig + compositor) - stacking becomes composition; A/B without losing tuned params.
3. SERVER-FREE EXPORT (download package / copy config JSON) - the export step is a dead no-op stub today; this completes the core loop without the offline server.
4. SCRUB-TO-EDIT numerics (drag label=adjust, dblclick=type, arrows nudge, shift=10x) - the #1 pro-tool feel tell (Figma/TouchDesigner).
5. DRAG-TO-REORDER layers + visible compositing-order indicator.
6. FULLSCREEN + collapsible panels.
DEFER to a later phase: command-palette search, undo/redo, preset save/load.

## TWO TASTE FORKS - RESOLVED by Jonah (2026-05-29)
- TYPEFACE: **JustifySans (400/700) + JustifyMono (400)** - the Anthropic faces bundled in `justify/fonts/` (justifysans-400/700.woff2, justifymono-400.woff2). Self-host into tilt-lab/app/public/fonts/; @font-face family names `JustifySans`/`JustifyMono` matching justify/core/index.ts convention; sans for body/labels, mono for numerics/wordmark/meta + tabular-nums.
- ACCENT: **Yes& brand red #DC2618** (hover #B01F15, per marketing-site). NOT justify's own clay #D97757. Single accent, used as sparse indicator, no-paint. Brand palette context: ink #1A1F1B, cream #F4EFE4, paper #FAF7EE - but tilt-lab stays dark-base, so red is the lone brand hue on the near-black console.

## Then: Phase 2 build (parallel non-overlapping: type/tokens, shell+canvas-dominant+fullscreen, browse-thumbnails+command, layer enable/opacity/drag + scrub numerics, export) -> CD review -> revise -> Chrome verify.
