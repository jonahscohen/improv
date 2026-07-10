---
name: Justify marker-change repaint bug + selection boxes follow marker
description: Jonah caught two bugs after the light/dark hardening - toolbar buttons went white when a new marker color was selected (updateModeButtonStyles event-time repaint still hardcoded white), and manipulate-mode selection bounding boxes never followed the marker (picker.ts fully hardcoded orange, zero marker plumbing); fixed via palette repaint + a --justify-marker CSS var on the shadow host with a picker sweep dispatched to an Opus executor
type: project
relates_to: [session_2026-07-04_justify-light-dark-hardening.md, session_2026-07-04_justify-color-picker-dispatch.md, session_2026-07-05_picker-marker-var-sweep.md]
---

Collaborator: Jonah. 2026-07-05.

Jonah (with screenshot, light theme + Yes& Red): "buttons white when new marker color selected. also selection bounding boxes should change to the marker color"

## Self-analysis (same failure family as yesterday, caught by the user again)
updateModeButtonStyles() is an EVENT-TIME repaint that runs on every marker change and mode switch. Yesterday's sweep themed creation paths and _reskin but missed this repaint - the exact TRUNCATED-SWEEP failure mode named in yesterday's beat, one more instance. The complete-listing rule now has to include: grep for hardcoded colors must cover REPAINT/EVENT paths (style writes inside methods), not just creation cssText. The selection-box gap is different: the picker was never in any sweep because manipulate mode's chrome lives in core/selector/picker.ts, a file no prior unit touched - a coverage gap, not a regression.

## Bug 1 - white buttons on marker change (FIXED, verified)
- Root cause: core/index.ts marker callback calls toolbar.updateModeButtonStyles(); its inactive branch reset btn color to hardcoded rgba(255,255,255,0.65) - white on cream in light mode.
- Fix: inactive branch now reads currentPalette().textDim at event time (toolbar.ts).
- Also fixed while in there: createVerticalDivider used hardcoded white-12% (invisible divider on cream); dividers now created from palette.border and repainted in _reskin via a _dividers registry.
- Verified in browser (light theme, real swatch clicks): after selecting Codex Blue, zoom shows comment + sliders icons INK on cream, gear active blue, X ink. Previously they went white.

## Bug 2 - selection bounding boxes follow marker
- Prompt mode: plumbing already existed (_selColor seeded at activate, _syncPromptModeColor re-renders overlays). VERIFIED live in browser: selection box + screen glow + focus ring all blue with blue marker; flipped swatch to Yes& Red with the selection open - box re-rendered red in place, glow followed, buttons stayed ink.
- Manipulate mode: core/selector/picker.ts (~3000 lines) owns ALL selection chrome (hover box, selection box, handles, guides, snap labels) and hardcodes #D97757 / rgba(217,119,87,x) in ~25 places with zero marker plumbing. Same for property-panel.ts accent table and state-toggle.ts.
- Mechanism chosen: lead wired core/index.ts to set a --justify-marker CSS custom property on the overlay shadow HOST (seeded at toolbar creation at both creation sites, updated in both marker callbacks, helper _setMarkerVar). Everything in the shared shadow root consumes var(--justify-marker, #D97757) and recolors live for free; alpha variants via color-mix. Why: one write point, zero per-element repaint plumbing, live updates without re-render calls.
- Picker/property-panel/state-toggle sweep dispatched to Opus executor jf-picker (exclusive file ownership; lead owns toolbar.ts + core/index.ts). Executor constraints: complete greps with assertion scripts, completion-proof grep to zero, tsc zero-new, no deploy (lead deploys + browser-verifies).

## Infra note
Named-teammate spawn hit the team-init orphan bug again (team file for session-203f1dae not found); repaired mid-session per reference_cmux_team_init_orphan_bug.md (create config.json + inboxes/team-lead.json with fresh mtimes) - repair procedure worked exactly as documented, spawn succeeded immediately after.

## Gates (lead edits)
- tsc: 160 errors before and after (zero new).
- vitest __tests__/core: 1 pre-existing failed file (selection.test.ts, 6 known failures) | 8 passed; toolbar-theme 16/16.
- Bundle deployed (npm run deploy) and freshness proven: daemon serves ~/.claude/justify/dist/justify-core.js, on-disk copy timestamped post-build and contains the new identifiers; page hard-reloaded before verification.

## UNIT CLOSED (same day) - executor folded, Codex gate on lead diff folded, manipulate mode verified live
- jf-picker executor delivered: picker.ts 18x #D97757 + 5x rgba-alpha -> var(--justify-marker,#D97757)/color-mix; :host --justify-red/--justify-blue repointed; property-panel accent table + state-toggle swept. Judgment calls verified in repo: SVG stroke moved to style attr (presentation attrs do not resolve var()), data-URI X-mark JS-resolved + encodeURIComponent, body-appended reparent ghost seeds the var inline read-once at creation. Its own Codex round: alignment-icon accent moved to a live currentColor path; encodeURIComponent hardening. Executor gates: tsc 160/160, vitest baseline, completion grep clean.
- BROWSER VERIFIED (manipulate mode, real clicks): with Yes& Red in dark theme - hover box, selection box, corner handles, size badge (684x139 pill), screen glow ALL red (previously hardcoded orange); flipped swatch to Codex Blue with selection open - entire chrome recolored INSTANTLY (pure CSS var propagation, zero re-render). Light theme flip with everything open re-skinned correctly; selection chrome stays marker-colored.
- CODEX GATE ON LEAD DIFF (real verdict, 145s): 4 findings, 3 folded + 1 accepted:
  1. FOLDED: deactivate() never destroyed _changesPanel -> stacked detached panels + stale themed-surface appliers across activate cycles (pre-existing; now destroyed in deactivate).
  2. FOLDED: _applyBarTheme clobbered marker-colored queue-count spans to body text on every theme flip (hex inline colors serialize back as rgb(), so the blanket rgb test caught them). THIS EXPLAINED the ink-colored count I saw in my own light-flip zoom and dismissed as intended - validation-by-gloss again, caught by Codex not me. Count spans now repainted to marker via closest('[data-queue-btn]'). Verified in pixels post-fix: light flip keeps the count marker-orange.
  3. FOLDED: annotation badge kept the old marker bg after swatch changes -> repainted in updateModeButtonStyles.
  4. ACCEPTED (no change): inactive dark buttons brighten 0.65 -> 0.75 alpha; pre-fix state was already inconsistent (creation 0.65 vs _reskin 0.75), unified at textDim.
- Final gates: tsc 160 (zero new), vitest 2 pre-existing failed files | 86 passed, bundle deployed, browser restored exactly as found (dark + Claude Orange, toolbar collapsed, Jonah's queued task untouched - someone used the browser mid-session, state respected).
- jf-picker stood down via sanctioned shutdown_request after acceptance.

## WAVE 2 (same day) - Jonah: "marker still orange with red selected" (justify.html screenshots)
- Reproduced FRESH on justify.html (not a stale tab): persisted Light+Red, enter prompt, hover -> box ORANGE while glow/focus-ring/active-button correctly red.
- DISAMBIGUATION THAT MATTERED: moved the cursor away from the selected element - the persistent selection overlay was actually correct deep red at 40% alpha; the orange box was the HOVER HIGHLIGHT sitting on top of it. Both his screenshots (li hover box, div.ref-callout "selection") were the hover highlight. Lesson: two coincident boxes on one element - identify WHICH construction you are looking at before blaming a code path (same wrong-path family as 07-04).
- ROOT CAUSE (hover box): overlay.ts positionHighlight creates the highlight div LAZILY on first hover with a hardcoded #D97757 cssText; setHighlightColor (seeded at mode entry from the persisted marker) stores _hlColor but only recolors an EXISTING element. Seed-before-create = stored color ignored. Why my earlier verification missed it: I only ever tested the change-while-open path (swatch click fires setHighlightColor on the existing element) and the homepage flow went straight to click; never zoomed the hover box on a fresh-load seed path.
- FIX: creation cssText uses (this._hlColor || '#D97757').
- BONUS FOUND WHILE REPRODUCING: queue pill rendered DARK on a light-themed machine at page load - module palette booted PALETTES.dark and only corrected after a theme EVENT; chrome built pre-Toolbar (launcher, early daemon queue push) read the wrong palette. FIX: _currentPalette boots from readStoredTheme + prefers-color-scheme (guarded IIFE, falls back dark). Verified: queue pill cream with marker-red count IMMEDIATELY at load, launcher cream at boot.
- VERIFIED (fresh hard reload, real flows): hover box deep red on hover (zoomed), selection overlay red, browser left in Jonah's state (Light + Yes& Red, queued task untouched). Gates: tsc 160 (zero new), toolbar-theme + inline-prompt tests 22/22, deployed.
- NOTE for Jonah: any tab loaded before this deploy still runs the old bundle - reload the tab.

Files touched (lead): justify/core/toolbar.ts (updateModeButtonStyles palette fix + badge repaint, divider registry, palette boot from stored theme), justify/core/index.ts (_setMarkerVar helper, both marker callbacks + seeds, changes-panel teardown in deactivate, queue-count marker guard in _applyBarTheme), justify/core/overlay.ts (hover-highlight creation honors seeded _hlColor); executor: core/selector/picker.ts, core/manipulate/property-panel.ts, core/manipulate/state-toggle.ts (see session_2026-07-05_picker-marker-var-sweep.md); deployed bundles; this beat + MEMORY.md.
