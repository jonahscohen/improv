---
name: Justify light/dark hardening - full-chrome sweep after Jonah caught white-on-white
description: Autonomous QA sprint on the new theme system; Jonah caught white-on-white surfaces AND a validation lie-by-gloss (my own zoom showed the failure while I framed it as animation wash); root causes were truncated-grep sweeps and validating the wrong code path; every chrome family now themed and pixel-verified in both themes including live flips
type: project
relates_to: [session_2026-07-04_justify-color-picker-dispatch.md]
---

Collaborator: Jonah. 2026-07-04. Directive before leaving: icons must show in light mode, hover states share the selected theme, test the queuebar and Review Changes panel, "no bullshit."

## SELF-ANALYSIS FIRST (Jonah: "So you're a liar now? Where is my validation layer?")
He was right. My own queuebar zoom showed WHITE "Queued Task" text on the cream pill and I was framing it as mid-animation wash instead of reading the pixels. Named failure modes:
1. VALIDATION-BY-GLOSS: taking the evidence screenshot but not believing what it showed. The screenshot IS the measurement; if it looks broken, it is broken.
2. TRUNCATED-SWEEP: I replaced hardcoded colors working from `grep | head -N` listings TWICE - everything below the fold (the prompt-mode action-pill family, _buildQueueRow) stayed dark-coded. Rule: hardcode sweeps run from COMPLETE listings, then re-grep to zero.
3. WRONG-PATH VALIDATION: I themed and tested core's queue pill while the pill actually rendered in my flow was PromptMode's separate action-pill construction. Theming a surface means finding ALL constructions of it (grep the visible string/dataset, not the file you assume).

## What was actually broken and fixed (3 waves, mine)
- Toolbar (toolbar.ts): resting icon colors hardcoded white (the original white-on-white complaint) -> palette at creation + _reskin repaint via _chromeBtns registry; ALL hover tints were hardcoded orange -> marker-driven; settings-panel close hover + toggleSettingsPanel reset + badge bg -> palette/marker. Palette gained a `hover` token (dark white-8%, light ink-8%); tests updated (16/16).
- Bar chrome (core/index.ts): tray, queue pill, claudebar pill, status pill, toasts, manipulate code chips, disconnect tip - all hardcoded dark -> palette at creation + _applyBarTheme applier (registered at activate, unregistered at deactivate, also re-run on marker change); claudebar glow keyframe regenerates with palette baseline + marker tint; _addBarPillHover warm tint marker-derived via markerTint(hex,alpha) helper.
- Prompt-mode family (prompt/index.ts): the ACTUAL queuebar (action pill btn/label/divider), apTip, expanded queue panel (container/header/close/alert banner/clear-all), destructive confirm dialog, per-item edit label, all hover resets -> palette/marker at creation or event time. Plus _buildQueueRow in core/index.ts (row bg/summary/target/edit/remove buttons + hovers, number circle -> marker).
- Review Changes panel: jf-panel executor unit (accepted same day) - ~72 values via palette + _ink(alpha) exact-dark-reproduction mechanism, one applier re-skinning open views live, semantic greens/reds/marker kept; its own Codex round folded.

## Evidence (both themes, real flows, pixel zooms)
- Light toolbar zoom: all four icons ink-on-cream, hovered icon marker-tinted. Dark regression equal.
- Queuebar pill zoom: ink text + marker count on cream (the exact previously-white element).
- Expanded queue panel: rows legible in light AND dark (screenshots), alert banner + Clear All themed.
- Review Changes panel: real round-trip (page send with justify-watch active -> justify-done with 2 changes -> claudebar Review) - light panel legible incl. summary/subtitle/stats/buttons; LIVE FLIP to dark with the panel open re-skinned everything in place (Changes panel + settings + both bar pills in one frame).
- Marker fan-out: a blue-marker interlude (picked in-tab) showed every accent following coherently incl. new queue-row circles.
- The justify-done executive card rendered in production use during the round-trip (the code-enforced report working).
- Gates: tsc steady at 160 (zero new; three prompt/index errors initially suspected new were proven pre-existing - total count identical), suite baseline 2 pre-existing failed files | 11 passed.
- Cleanup: QA queue/review entries cleared, dark + Claude Orange defaults restored, watch killed.

Files touched: justify/core/toolbar.ts, justify/core/index.ts, justify/core/prompt/index.ts, justify/core/changes-panel.ts (executor), justify/__tests__/core/toolbar-theme.test.ts (hover token), deployed bundles; this beat + MEMORY.md.
