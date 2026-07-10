---
name: Justify settings toggles fixed - state never seeded into fresh PromptMode
description: Jonah reported the Hints and Selection Labels toggles do nothing; root cause - every prompt-mode entry constructs a fresh PromptMode and the toolbar toggle state was never (labels) or only partially (hints) seeded onto it, so toggles only worked if flipped while prompt mode was live; fixed seeding + a callback re-registration leak; verified E2E on the exact failure path
type: project
relates_to: [session_2026-07-04_justify-settings-cleanup.md]
---

Collaborator: Jonah. 2026-07-04.

Jonah, after the settings-panel cleanup: the two remaining toggles "do...not actually work lol". My prior claim they worked was existence-not-function verification - owned.

## Root cause (reproduced live before fixing, per the debugging protocol)
- The toggles and their callback chain are sound; toggling WHILE prompt mode is live works (label pill compacts to a circle - proven in-browser pre-fix).
- The break: switchMode('prompt') constructs a NEW PromptMode every entry. Toolbar toggle state was never carried onto it: _showLabels not seeded at all; _showHints seeded only onto the inner prompt object, not the PromptMode (so the attach-point tooltip path read undefined). Toggles flipped before entering the mode, or between mode switches, silently did nothing - which is the only way a user actually uses a settings panel.
- Console confirmed: single switchMode:prompt, zero errors - killing the alternate theories (double injection ruled out via curl: one script tag; callback-array-undefined ruled out: initialized).
- Secondary leak: the three settings callback registrations lived inside switchMode's prompt branch - re-registered per entry, arrays grow duplicate closures.

## Fix (justify/core/index.ts, switchMode prompt branch)
- Seed BOTH flags onto every fresh PromptMode: _showHints (both levels) and _showLabels from toolbar state, with a comment naming the bug.
- Once-guard (_settingsCbsWired) around the onMarkerColorChange/onHintsChange/onSelectionLabelChange registrations.

## Verification
- E2E on the EXACT failure path, real inputs: fresh reload -> toggles OFF before any mode -> enter prompt mode -> select p.hero__lede -> label renders as the compact circle, no hint tooltips (screenshot examined). Pre-fix this sequence produced the full pill.
- Mid-mode toggling re-verified working pre-fix (unchanged path).
- npm test: same 7 pre-existing failures only (selection exports + ws-server port flake), no new failures. Deployed via npm run deploy.
- Additional pre-existing tsc errors catalogued (earlier truncated output hid them): QueueItem undefined at core/index.ts ~1797/1886, PropertyPanel.tsx TypographySection props mismatch - neither symbol appears in today's diffs.

## Follow-up (same day): what Hints-off actually covers - and the surface it missed
Jonah probed "what do you think turning off hints does?" Full audit of the four hint surfaces:
- GATED correctly (post-seeding-fix): toolbar icon hover tooltips (_tt, show-path check), the queue/send button tip in the prompt bar (_btnTip), the attach-point tip (_apTip).
- NOT gated: the cursor-follow element label in prompt mode (_hLabel - the icon + selector pill tracking the mouse), the most prominent hint in the product. Its mousemove show path never checked _showHints; the toggle-off callback hid it once and the next mousemove revived it.
- Fix: gated the _hLabel show path on _showHints !== false (prompt/index.ts mousemove handler), with a comment distinguishing it from the hover HIGHLIGHT BOX, which is selection feedback and deliberately stays.
- Verified E2E with real inputs: fresh bundle, Hints OFF before entering prompt mode, hover the hero paragraph - highlight box present, NO cursor label (screenshot examined). Pre-fix this hover always showed the pill. The live flag read means toggling back on re-enables on the next mousemove.

Files touched: justify/core/index.ts; justify/core/prompt/index.ts (hover-label gate); deployed bundles; this beat + MEMORY.md.
