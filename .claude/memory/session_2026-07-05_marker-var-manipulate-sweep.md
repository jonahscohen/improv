---
name: Marker-var sweep of the manipulate tree
description: Converted remaining terracotta accent literals in the property panel's manipulate tree to var(--justify-marker, #D97757) so they follow the live marker color
type: project
---

Collaborator: Jonah

Follow-up execution unit to the picker/core marker-var sweep. The user found more
surfaces in the property panel that stayed terracotta-orange when the marker color
changed. A `--justify-marker` custom property is hoisted onto
`document.documentElement` (separate lead change) so `var(--justify-marker, #D97757)`
resolves inside every shadow tree and live-updates when the marker changes. This unit
converted the remaining orange-as-accent literals in the manipulate tree to that var.

Changes (per-file):
- property-panel.ts: darkTheme `blueBg` was the last hardcoded accent (`#A94B30 50%`) ->
  `color-mix(in srgb, var(--justify-marker, #D97757) 40%, transparent)`. 40% of the
  brighter clay reads close to the old 50% of the darker `#A94B30` on the dark panel
  (premult red ~84.5 vs ~86.8). Also folded a Codex finding: the alignment
  segmented-control click handler reset the matched active button to `cssVars.text`
  instead of `cssVars.blueText`, so the active icon (now `currentColor`, a lead
  pre-staged refactor) stopped following the marker after a click. Fixed to `blueText`,
  matching the init path.
- ui/alignment-grid.tsx: `BLUE` literal -> var; all 15 icon `fill={color}` presentation
  attributes -> `style={{ fill: color }}` (SVG presentation attrs cannot hold a CSS var,
  the `fill` CSS property can). `fillOpacity` kept as attribute. GRAY untouched.
- ui/constraints-input.tsx: pinned pin-line `stroke=` attr -> `style={{ stroke }}` with
  the var; unpinned `#d6d3d1` grey kept.
- ui/gradient-stop-bar.tsx: both selected-chit `backgroundColor` literals -> var.
- ui/box-model-overlay.tsx: added `diagonalPatternColor(line)`; padding stripe now
  `color-mix(... var(--justify-marker, #D97757) 50% ...)`. MARGIN/GAP output byte-identical.
- handles.ts: `RADIUS_COLOR` -> color-mix var (consumed only as a CSS `background`, safe).
- box-model.ts: `CONTENT_BG` -> 15% color-mix var, `CONTENT_TEXT` (`#EBC8B5`) -> 55%
  color-mix-with-white var (both consumed only as CSS values). MARGIN_TEXT `#f97316` kept.

Discrepancy handled (judgment call): items for grid-picker (selected/preview) and the
pin center-dot named `.tsx` files, but those color literals actually live in
`core/manipulate/styles/controls.css` (`.retune-grid-picker-cell.selected` #D97757,
`.preview` #EBC8B5, `.retune-pin-center-dot` #D97757) - the `.tsx` only carried them in
header comments. controls.css was not on the forbidden list and is squarely in the
manipulate tree, so those three CSS rules were converted (selected/center-dot -> var,
preview -> 45% color-mix-with-white). `#eeeceb` neutral hover kept. Flagged to lead.

Semantic dev-tool colors deliberately NOT touched: handles.ts PADDING (green)/MARGIN
(orange), box-model-overlay MARGIN/GAP, box-model.ts MARGIN_TEXT, all unpinned/neutral greys.

Gates: `npx tsc --noEmit` errors 160 -> 160 (zero new). `npx vitest run` 2 failed files /
7 failed / 86 passed, unchanged (pre-existing: selection.test.ts, ws-server port flake).
Codex review (codex-cli 0.142.5) via claude/hooks/codex-review.py: one finding
(the blueText click-handler bug above), folded, re-review confirmed resolved with no
remaining defects. No deploy / browser-verify (lead owns that).

Files touched: core/manipulate/property-panel.ts, ui/alignment-grid.tsx,
ui/constraints-input.tsx, ui/grid-picker.tsx (comment only), ui/gradient-stop-bar.tsx,
ui/box-model-overlay.tsx, handles.ts, box-model.ts, styles/controls.css.

## Follow-up unit: panel-shell blue ramp + focus rings

Lead's browser verify found the LIVE panel is the Preact one whose accent tokens come
from panel-shell.css, not the property-panel.ts darkTheme table. The tree selected-row
and Target pill are painted by the `--retune-blue-*` ramp (10 hardcoded clay steps), so
they stayed on the old clay after a marker flip. Fix: derive the ramp from the marker.

- panel-shell.css: `--retune-blue-500 = var(--justify-marker, #D97757)`; light steps
  (100-400) color-mix toward white, dark steps (600-1000) toward black, calibrated to
  approximate the old clay ramp at marker=#D97757. Percentages: 100/10, 200/20, 300/38,
  400/66, 600/88, 700/72, 800/58, 900/40, 1000/25. Step 400 uses 66% not the lead's
  suggested 62% (arithmetic best-fit: 62% left the blue channel +11 off; 66% is the
  per-channel average of the target). Light steps are near-exact; dark steps run ~8-15
  units more muted because the original hand-tuned ramp gained saturation toward the
  darks and a pure black-mix cannot reproduce that - documented tradeoff, live-follow
  wins. Semantic blue tokens (--retune-blue/-text/-bg/-bg-hover, light+dark) reference
  the ramp by name, so they follow automatically; unchanged. Red ramp + neutrals kept.
- color-gradient.css: four `:focus` box-shadow glows `rgba(217, 119, 87, A)` ->
  `color-mix(in srgb, var(--justify-marker, #D97757) P%, transparent)`, P = A*100
  (0.15 -> 15% on the search input, 0.5 -> 50% on the three cp/angle/pos inputs). Exact
  reproduction at marker=#D97757 since the marker is opaque. Header comment updated.
- Item-4 scan of panel-shell.css: no other warm accent outside the blue ramp (remaining
  hex are #1c1917/#ffffff/#1a1a1a neutrals, neutral shadows, and the semantic red ramp).

Completion grep across styles/*.css: every hit is a var()/color-mix marker expression or
a comment describing it; zero bare accent/ramp literals. Gates: tsc 160->160, vitest
2 failed files / 7 / 86 (unchanged). Codex (codex-cli 0.142.5): no defects. No deploy.

Files touched (follow-up): styles/panel-shell.css, styles/color-gradient.css.
