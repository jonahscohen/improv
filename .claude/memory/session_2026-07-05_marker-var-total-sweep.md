---
name: Marker-var total sweep - property panel, queue panel, claudebar, live refresh
description: Jonah found four more surfaces stuck on clay orange with a non-orange marker (property-panel Target pill, letter-spacing modified dot, Elements tree selected row, queue panel banner/circle) and mandated live refresh on marker selection; root causes were the marker var not reaching the panel's isolated shadow tree (fixed by hoisting --justify-marker to document.documentElement), a second wave of truncated-sweep warm literals in prompt/index.ts and core/index.ts, JS-resolved paints that never refresh, a cssText assignment wiping a previously-set style.color, and the Preact panel's hardcoded blue ramp in panel-shell.css
type: project
relates_to: [session_2026-07-05_justify-marker-repaint-and-selection-boxes.md, session_2026-07-05_marker-var-manipulate-sweep.md]
---

Collaborator: Jonah. 2026-07-05.

Jonah (four screenshots): property-panel Target pill, letter-spacing modified dot, Elements-tree selected row, queue-panel alert banner + launcher circle - all stuck orange with red/blue marker; "it should live refresh the colors as the color is selected."

## Root causes (five distinct)
1. ISOLATED SHADOW TREES: the Preact property panel renders in the overlay shadow root but its TOKENS come from adopted stylesheets; more importantly other justify chrome (panel host trees, body-appended elements) could not see --justify-marker set only on the overlay host. FIX: _setMarkerVar also sets the var on document.documentElement - custom properties inherit into every shadow tree, one write point, live refresh for every var() consumer. (Kept the overlay-host write as belt-and-braces.)
2. TRUNCATED SWEEP WAVE 2 (mine, again): prompt/index.ts still had ~14 warm literals (queue count colors, queue btn actives, alert banner bg/border/icon, Send All family) and core/index.ts had ~9 (qactive circle paints, claudebar spark fills, claudebar icon actives, deleted-element badge, pill icon tint). The 07-04 "complete listing" was of a PATTERN PAIR LIST, not a grep-to-zero of the warm family. All now var(--justify-marker)/color-mix.
3. JS-RESOLVED PAINTS DO NOT LIVE-REFRESH: values painted via this._mk()/markerTint() at creation stay stale after a marker change (queue row number circle stayed blue after flipping red). Anything expressible as CSS now uses var()/color-mix so the browser refreshes it; _setSpark converted to currentColor + CSS color so SVG fill attrs can ride the var too.
4. CSSTEXT WIPE: my sweep set alertIcon.style.color = var(...) then four lines later the PRE-EXISTING alertIcon.style.cssText assignment REPLACED the whole inline style - the icon silently inherited white. Caught only because the pixel zoom showed a white icon on the tinted banner. Rule: when adding style properties near creation code, check for later cssText assignments on the same element - fold the property INTO the cssText.
5. PREACT PANEL BLUE RAMP: panel-shell.css defines a 10-step hardcoded clay ramp (--retune-blue-100..1000) that everything in the Preact panel chains from - no sweep of .ts/.tsx files could ever fix the Target pill / tree row. Dispatched to jf-panel-vars as a follow-up: ramp derived from var(--justify-marker) via color-mix toward white (100-400) and black (600-1000); also 4 focus rings in color-gradient.css. PENDING at beat time.

## Wrong-path lesson recurrence (diagnostic win this time)
First verification zoom looked "red-tinted" on the Target pill - but red-40%-on-dark vs fallback-orange-40%-on-dark are nearly indistinguishable at small size. The LIVE FLIP is the real test: flip the marker and watch what does NOT change. That is how the tree row (ramp), the number circle (JS paint), and the alert icon (cssText wipe) were each isolated.

## Executor units (jf-panel-vars)
- Unit 1 (accepted): manipulate tree sweep - property-panel.ts blueBg -> marker mix 40%; alignment-grid fill attrs -> style {{fill}} + BLUE -> var (SVG presentation attrs cannot hold var()); constraints-input strokes -> style; gradient-stop-bar chits; box-model-overlay padding hatch; handles.ts RADIUS_COLOR; box-model.ts CONTENT_BG/TEXT; controls.css judgment call (literals actually lived there, converted - approved); folded a Codex find in the alignment segmented control (click reset used text token instead of blueText - active icon stopped following marker after click). 34 sites, tsc 160/160, vitest baseline, codex clean.
- Unit 2 (pending): panel-shell.css blue ramp + color-gradient.css focus rings.

## Verified so far (browser, real flows, pixel zooms, live flips)
- Queue panel with a QA task queued through the real submit flow: number circle marker-red, alert icon marker-red (post cssText fix), banner tint red; LIVE FLIP red -> blue recolored circle + icon + banner in place with the panel open, zero re-render.
- Queue launcher circle active state: marker-red (was hardcoded orange in Jonah's screenshot).
- Manipulate selection chrome + property panel opened; Target pill/tree row still clay -> isolated the ramp (unit 2).
- Cleanup: QA task cleared, queue empty, System theme + blue marker restored (Jonah's state), toolbar collapsed.
- Gates after lead sweeps: tsc 160 (zero new), vitest __tests__/core baseline.

Files touched (lead): justify/core/index.ts (_setMarkerVar documentElement hoist, qactive var paints, _setSpark currentColor mechanics + call sites, claudebar icon actives, deleted badge, pill icon tint, numCircle var), justify/core/prompt/index.ts (queue count/btn/banner/Send All var family, alertIcon cssText fold), deployed bundles; this beat + MEMORY.md.
## UNIT 2 CLOSED (same day) - ramp verified
- jf-panel-vars delivered the panel-shell.css ramp (blue-500 = the marker var; 100-400 color-mix toward white at 10/20/38/66 percent, 600-1000 toward black at 88/72/58/40/25) + 4 color-gradient.css focus rings. Executor's honest tradeoff note: dark steps run slightly more muted than the hand-tuned clay (pure marker+black mix cannot reproduce the original's saturation gain toward the darks); read fine in pixels, no re-anchoring needed.
- VERIFIED in browser: Target pill + Elements tree selected row BLUE-tinted with blue marker, then LIVE FLIP to Yes& Red with the panel open recolored both instantly; Target pill zoomed in red state (red wash + red count text). Browser restored to Jonah's state (System theme + blue marker, queue empty, toolbar collapsed).
- The letter-spacing modified dot rides currentColor over blueText -> the ramp completes its chain (same token verified via the Target pill count text).
- Final gates: tsc 160 (zero new), vitest baseline, deployed. jf-panel-vars stood down after acceptance.
