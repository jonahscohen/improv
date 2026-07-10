---
name: Picker/property-panel/state-toggle marker-var sweep (executor unit)
description: Executor unit for the marker-repaint work - swept core/selector/picker.ts, core/manipulate/property-panel.ts, core/manipulate/state-toggle.ts from hardcoded #D97757 / rgba(217,119,87,x) to var(--justify-marker, #D97757) / color-mix; handled three sites that cannot hold var() (inline SVG presentation attr, data: URI SVG, body-appended reparent highlight) plus a Codex Medium fold making the alignment-grid active icon live via currentColor
type: project
relates_to: [session_2026-07-05_justify-marker-repaint-and-selection-boxes.md]
---

Collaborator: Jonah. 2026-07-05.

Executor unit dispatched by the lead as part of the marker-repaint work (parent beat: session_2026-07-05_justify-marker-repaint-and-selection-boxes.md). Lead owns toolbar.ts + core/index.ts (already set --justify-marker on the overlay shadow host, seeded + live-updated). This unit owned exactly three files and swept every ORANGE-as-accent literal to consume the host var.

## What changed (substitution counts)
- **picker.ts**: 18 `#D97757` + 5 `rgba(217,119,87,x)` occurrences swept.
  - 16 straightforward cssText/template `#D97757` -> `var(--justify-marker, #D97757)` (dotted/solid outlines, pin lines, selection badge, corner handles, reorder ghost border, positionBox border, snap parent indicator, overlay `:host` --justify-red/--justify-blue repoint so all existing var(--justify-red) consumers follow).
  - rgba alpha stops -> `color-mix(in srgb, var(--justify-marker, #D97757) P%, transparent)`: padding gradient (2x 0.5=50%), reorder ghost bg (0.06=6%), positionBox bg (dynamic `calc(${bgAlpha} * 100%)`).
- **property-panel.ts**: 4 `#D97757` -> darkTheme blueText/blue500 custom-property values + previewDot background now var(); activeColor now `currentColor` (see Codex fold).
- **state-toggle.ts**: 1 `#D97757` (orphaned module, but in-spec) -> var().

## Three sites that cannot legally hold var() (why + how)
1. **Inline SVG stroke (picker.ts:219)**: `<line stroke="#D97757">` is an SVG PRESENTATION ATTRIBUTE; var() does not resolve there. Moved the paint into `style="stroke:var(--justify-marker, #D97757)"` (style attribute IS a CSS context, element is in the shadow tree so it inherits the host var). Live.
2. **data: URI SVG X-mark (picker.ts:736)**: a data: URI is an isolated image document; it cannot see the host custom property at all. Resolve the marker in JS from `getComputedStyle(shadowRoot.host)` with a `#D97757` fallback and URL-encode it into the URI. Rebuilt per drawXMark call, so it re-reads the current marker each draw. NOT live during a single draw, but re-drawn constantly.
3. **Body-appended reparent highlight (picker.ts:~1672, `hl`)**: appended to document.body, NOT the shadow root, so it cannot inherit the host var. Seeded `--justify-marker` inline in the SAME cssText it is consumed in (resolved once from the host at creation); its child drop-indicator line inherits that inline property. Read once at drag start - acceptable, marker cannot change mid-drag.

## Judgment call: JS-resolve vs live (property-panel alignment grid)
activeColor feeds `iconPositionX(16, color)` which writes `fill` via setAttribute (icons.ts, not ours) = presentation attribute, so var() is illegal. Initial impl JS-resolved it (spec-sanctioned). Codex Medium finding: JS-resolve is not live (active icon stays old color until the grid rebuilds). Folded to the live path WITHOUT touching icons.ts: pass `currentColor` (which DOES resolve in a presentation attribute, following the element's `color`) and set the active button `color: var(--justify-blue-text)` - the accent token that now points at the marker. Icon fill now follows the marker live.

## Codex cross-model review (real verdict, 153s, exit 0)
- Medium (activeColor not live) - FOLDED via currentColor + button color token (above).
- Low (data-URI only encodes `#`) - FOLDED: swapped `.replace("#","%23")` for `encodeURIComponent(...)` (identical output for the six-digit-hex swatches, robust if the marker ever becomes an arbitrary CSS color).
- Codex confirmed the rest sound: shadow-root var usages resolve from host, inline SVG moved to CSS style (not presentation attr), body-appended hl seeds the var in the same cssText, `calc(${bgAlpha} * 100%)` valid.

## Gates
- Completion-proof grep: every remaining `#D97757` is a var()/color-mix fallback or a JS fallback literal (picker 736/1675, no bare rgba(217,119,87) left).
- tsc: 160 before, 160 after (zero new); zero errors in the three edited files.
- vitest: 2 pre-existing failed files unchanged (selection.test.ts 6 known + ws-server.test.ts port EADDRINUSE flake) | 86 passed. No new failures.
- No deploy / browser verification (lead owns that per the parent unit).

## Method note
Sweep run via python replace scripts with per-pattern `assert count == expected` so any miss fails loud instead of silently under-replacing (scripts were scratch, removed after). Duplicate-prone literals (border-left x2, border-top x2, dotted-outline x4) handled with count-checked replace-all rather than fragile line targeting.

Files touched: justify/core/selector/picker.ts, justify/core/manipulate/property-panel.ts, justify/core/manipulate/state-toggle.ts.
