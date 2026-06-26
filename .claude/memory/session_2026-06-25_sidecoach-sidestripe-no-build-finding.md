---
name: sidecoach-sidestripe-no-build-finding
description: Stage 5b side-stripe-borders investigation - NO-BUILD recommendation. linear positive is raster (app-mockup screenshots, DOM-unreachable); mintlify is the lone winnable positive; a rendered detector hits dev precision 1.0 only by replaying the nested-cards false-signal (tuned narrow band, 1 positive). Recall ceiling capped by raster. Precision-disciplined no-build is the honest choice.
type: decision
relates_to: [session_2026-06-24_sidecoach-nested-cards-precision-miss.md, session_2026-06-25_stage5-6-kickoff-grounding.md, session_2026-06-25_stage5-team-dispatched.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Builder teammate "sidestripe" (Task #2). Investigation-first; DEV ONLY (never touched frozen-90 candidates). Did NOT read oracle's detector.

## RECOMMENDATION: STOP / NO-BUILD for a side-stripe-borders RECALL improvement.
A clean documented "we shouldn't chase this" - the successful outcome the lead pre-blessed. Same posture as the motion classes: side-stripe is a noisy class for both tools; precision-disciplined / lower-recall is the honest choice. Protects the banked subjective-precision win (0.426 vs oracle 0.104).

## Dev signal: 2 positives (linear, mintlify), 19 negatives (precision-developable).

## Finding 1 - DOM-reachability of the 2 positives (rendered hermetically, same posture as subjective-rendered-scanner: stripScripts + abortExternal + 1280x800).
- **linear (label conf 0.82, "Colored side accents recur in app panels"): RASTER / UNWINNABLE.** Zero DOM side-stripes by ANY mechanism (border, ::before/::after pseudo bar, box-shadow inset, gradient band, div-as-stripe). The page has 7 large rasters incl. full-bleed app-mockup `<img>` (1920x1080, linear.app CDN) - the "app panel side accents" the labeler saw live INSIDE those product screenshots (pixels, not DOM). The only saturated narrow vertical bars in linear's DOM are data-viz CHART bars (`LwA8Xa_barBottom/barTop`, cyan/blue) - correctly NOT side-stripes. A DOM detector cannot win linear; this hits oracle equally (also DOM).
- **mintlify (label conf 0.71, "Green vertical section accent stripes recur"): DOM-reachable.** 2px green `rgb(12,140,94)` accent spans (`span.absolute.left-0.top-12`) recurring (6x) at the left edge of section labels. Winnable.
- => ~50% of dev positives are raster app-mockup accents. DOM recall has a hard ceiling well below oracle's claimed R0.556.

## Finding 2 - current STATIC detector (absolute-ban-detector.ts:78 scanSideStripeBorders) misses BOTH dev positives.
0 findings on linear, 0 on mintlify (it needs a card-keyword selector + literal `border-left/right:>=2px solid <color>`; neither positive uses that, and it's also slow - ~32s/page regex over 2MB inline styles). NOTE: the static regex has NO saturation gate - it accepts GRAY 2px card borders (only excludes transparent/inherit/currentColor), the likely source of its 17 frozen-90 FP (P0.105).

## Finding 3 - rendered prototype on dev (scratch, /tmp, NOT committed).
- PERMISSIVE (any thin colored edge-bar, width<=10): mintlify TP, linear FN, **6/19 negatives FP** (clerk, calcom, dub, liveblocks, trigger, inngest) -> recall 0.500, precision 0.143 = NOISE. The 6 FP are all 1px GRAY hairline dividers/gridlines (clerk opacity-10 grid, calcom/dub `rgb(225..229)` 1px column separators, trigger/inngest/liveblocks 1px decorative lines) - not accent stripes.
- REFINED (saturated chroma>=40 + width>=2px + recurs>=2): mintlify TP, linear FN, **0/19 negatives FP** -> recall 0.500, precision 1.000 on dev.

## Why the refined "precision 1.0" does NOT justify a build (the integrity call).
Per the nested-cards precedent (dev P1.00 -> frozen P0.267, lead's own gate-miss), dev precision 1.0 is a FALSE signal when achieved by tuning a narrow band to a tiny positive set. Here it's worse: only ONE winnable positive (mintlify), and the discriminator (saturated 2px+ vertical bar at a section edge, recurring) is a GENERIC idiom that overlaps with section-kicker accents, brand-colored dividers, and decorative frame lines. The frozen-90's ~83 negatives will contain those -> high FP risk, unmeasurable from dev. Building it risks adding FP and tanking the banked 0.426 subjective precision - the exact BAD trade the lead flagged (matching oracle's recall at ~0.11 precision adds ~24 FP, 0.426->0.333). Recall headroom is also capped by the raster ceiling (linear). Net: a recall build is a precision gamble with a capped upside.

## Secondary observation handed to the lead (NOT a build I made - lead-held precision territory).
The static detector's missing saturation gate means it fires on gray 2px card borders. A PURE precision move (reject chroma<40 borders, or replace with the saturation-gated rendered version) could REDUCE the static detector's 17 frozen-90 FP without chasing recall. But that touches the banked-precision number, so it's the lead's measured call on the frozen-90, deliberately not done here.

## Constraints honored
DEV ONLY; never read/wrote eval/corpus/candidates*; did not read oracle's detect.mjs; no Codex (lead runs it); no source files changed (all prototypes in /tmp/sidestripe-investigation/).

## Files touched
- (this beat + MEMORY.md index; no sidecoach/src changes - investigation concluded NO-BUILD)
