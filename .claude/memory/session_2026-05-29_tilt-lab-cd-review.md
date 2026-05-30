---
name: tilt-lab instrument redesign - CD review + fixes
description: Creative-director review of the 3-builder instrument redesign. Look transformed (mono wordmark, warm dark, dominant preview, composition panel). Found 3 dead features (enable/opacity/export) from App.tsx wiring gap - fixed directly. Thumbnails broken by WebGL context cap - needs Builder A re-architecture. Added &dev logo per Jonah.
type: project
relates_to: [session_2026-05-29_tilt-lab-instrument-foundation.md, session_2026-05-29_tilt-lab-design-direction.md]
---

Collaborator: Jonah. 2026-05-29. CD review of tilt-design build phase (builders A/B/C all reported done). Verified in Claude-in-Chrome at :5180. tsc clean, 160/160 tests.

## What landed well (Approve)
- LOOK genuinely transformed from generic dashboard -> instrument: mono tracked TILT-LAB wordmark, warm near-black, lean rails, DOMINANT true-black preview stage, mono micro-labels (BROWSE/COMPOSITION/role tags), tabular-mono readouts.
- Builder B composition panel: PAINT ORDER "background to post" indicator, per-layer enable toggle (red), opacity slider + % readout, channel number 01, accordion params (GENERAL/LAYER1-4/MOVEMENT/SKY), drag handle. Store has setEnabled/setOpacity correctly.
- Builder C: TopBar export (Download/Copy config) wired to export.ts, gates on layers; AddShaderModal re-homed.
- Adding Aurora renders a beautiful full-bleed live aurora in the main preview (its dedicated WebGL context is healthy).

## BUGS FOUND
1. THREE dead features (enable toggle, opacity slider, export buttons) - ROOT CAUSE: Builder A's App.tsx did not pass the new props. LayerStack/TopBar/store were all correct (defensive optional props). FIXED DIRECTLY (CD): App.tsx now passes layers={layers} to TopBar and onSetEnabled/onSetOpacity to LayerStack (A had also added the LayerStack wiring concurrently). The build I first tested was stale (pre-wiring).
2. THUMBNAILS BROKEN (Builder A ThumbnailPreview) - STILL OPEN, needs revision. 26 simultaneous live WebGL contexts exceed the browser cap (~16) -> "THREE.WebGLRenderer: Context Lost"; most browse cards show letter-fallback tiles, Aurora shows a white broken-image tile. Shared-RAF+IntersectionObserver saves CPU but NOT contexts (a created context is held even off-screen). Headline "live catalog" feature does not deliver. FIX: re-architect to poster-frame (single shared GL context: render each effect's first frame -> snapshot to image/ImageBitmap -> dispose context -> show still), optionally upgrade to live-on-hover. -> Builder A revision.
3. POINTER role tag rendered in RED in browse (only pointer; POST/BACKGROUND muted) - accent-as-role-coding, violates single-accent/no-color-coding brand law. Make role labels uniformly muted. -> Builder A (BrowseGrid/role CSS).

## CRITIQUE-level (polish)
- Many param-slider fills are red (accent-everywhere risk per brand-strategist). Consider neutral/muted slider fills, reserve red for enable/active state.

## User request (mid-review)
- Added &dev logo top-left next to TILT-LAB title: copied marketing-site/assets/and-dev-white.svg (red ampersand + white "dev", verbatim brand asset) -> app/public/, <img class=top-bar__logo> in TopBar before wordmark, .top-bar__logo CSS (18px) in styles.css.

## Files touched (CD direct): App.tsx (TopBar+LayerStack wiring), TopBar.tsx (logo img), styles.css (.top-bar__logo), app/public/and-dev-white.svg

## VERIFIED in Chrome (post-fixes + Builder A revision)
- &dev logo top-left, enable toggle blacks preview, opacity dims to 37%, export enabled, scrub-edit commits (with select-all caveat -> sent to C). tsc 0 / 160 tests.
- Builder A REVISION VERIFIED: thumbnails now POSTER FRAMES. Clean reload -> NO "Context Lost" cascade (the cap problem is solved). Real posters render: Aurora (aurora), Fluid (magenta), Fractal Glass (blue radial), Grain Gradient (purple grain), Dithered (orange). Un-posterable effects show DARK letter fallback (Cursor Image Trail pointer, Globe cobe). POINTER + all role tags now MUTED (red coloring removed). Browse scroll responds.
- MINOR open: cobe globe poster gen throws once on clean load (cobe.js getUniformLocation: async image onload races shared-context dispose) -> globe shows dark "G" fallback. Graceful, single, not a cascade. Follow-up: guard cobe poster (skip/try-catch around its async onload) or accept dark fallback for globe.

## Builder C revision VERIFIED: scrub select-all works. Typed "2" (no manual cmd+a) -> 2.00, thumb at 2/3. Typed "4.2" -> clamped to 3.00 (Aurora speed max=3, step 0.05) - correct replace+clamp (a merge would have given ~1.10). 161 tests, tsc 0.

## STATUS: all 3 builders green + verified. Look transformed, composition works, posters work, scrub+export work, &dev logo in.
## OPEN: (1) red-slider-fill taste decision (asked Jonah). (2) cobe globe poster async exception -> dark fallback (minor follow-up). (3) formal sidecoach QA triad (audit/critique/polish) + make-interfaces-feel-better not yet run - offered to Jonah.
