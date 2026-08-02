---
name: Page transitions doubled in duration to actually be seen, and the WILL REMOVE badge got the same marching-ants ring - which first shipped as two overlapping outlines
description: Two direct orders. The fwd/back slide and the lateral fade were both too quick to register as intentional motion, so both got noticeably longer. The WILL REMOVE badge asked for the same animated ring WILL INSTALL already has, and the first attempt drew it on top of the badge's own still-colored static border - a real, visible defect caught by looking, not by the audit tooling.
type: project
relates_to: [session_2026-08-02_rail-fade-transition.md, session_2026-08-02_marching-ants-three-attempts.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: caught the stretched fade mid-flight (already done for the duration change last turn); the double-outline defect and its fix both confirmed by screenshot; real motion on the fixed red ring confirmed by a 2-frame pixel diff (17.5 differing pixels); the green WILL INSTALL ring re-confirmed unaffected; detector 0 blocking, suite 147/0; corrected real drift on the machine (sidecoach-detect had been left genuinely installed by earlier testing this session and is now actually removed, not just unstaged)
confidence: high
---

# Slower, and a ring that had a real bug in it (2026-08-02)

Jonah: "Make the page transitions more apparent, they happen too fast." Then, mid-turn: "Also
please add marching ants border effect to the 'Will Remove' status badge."

## Durations

fwd/back slide: 190ms -> 380ms. Lateral fade: 160ms -> 320ms. Both roughly doubled - long enough to
read as a deliberate cue, still well inside "quick" for a settings screen. No new safety concern:
the slide was already transform-only, the fade already ends at the pane's own resting opacity with
no fill-mode, per the reasoning recorded when each was added.

## The ring that shipped broken

Reused the exact working pattern from WILL INSTALL: a currentColor SVG ring so the SAME markup
reads green there and red here, wired into the badge that was already gated on `is-staged`. First
screenshot looked wrong immediately - Jonah: "It does not look like the other one, it looks awful."

**Two overlapping outlines**, not one. WILL INSTALL's rule sets `border-color:transparent`
specifically so the CSS border disappears and only the animated SVG ring remains; WILL REMOVE's
rule still set `border-color:var(--red)`, so its own real dashed border kept rendering UNDERNEATH
the new ring - two dashed capsules at slightly different radii, which is exactly the "awful"
double-outline in the screenshot. Fixed with the same `border-color:transparent` WILL INSTALL
already uses. Re-confirmed at 4x zoom: one clean ring, and a 2-frame pixel diff proved it is
genuinely animated (17.5 differing pixels, not the 0 a frozen ring would show).

## A second thing found while verifying, unrelated to either ask

Testing the green ring required staging something for install, and the first candidate
(`sidecoach-detect`) showed WILL REMOVE instead - meaning it was ALREADY genuinely installed on the
real machine, left there by earlier verification passes in this same long session that staged and
unstaged it repeatedly but never confirmed the FINAL real state matched the assumed baseline. Fixed
by actually applying a removal (not just staging and unstaging), confirmed by `settings.json` going
from 1 reference to 0 and a real "One change applied" toast. Worth naming as a lesson on its own:
"restored: ''" (empty staged count) proves nothing was left PENDING; it does not prove the real
installed state matches what testing assumed going in.

## Files touched

- `claude/installer-gui/styles.css` (durations; `will-remove` border-color; ring stroke changed
  from a hardcoded `--ok` to `currentColor` so one rule serves both staged states)
- `claude/installer-gui/index.html` (ring now appended for any `is-staged` badge, not only
  `will-install`)
