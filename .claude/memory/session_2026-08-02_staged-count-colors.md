---
name: The bottom "+N -N staged" count gets the same green/red the row badges use
description: Direct order with a screenshot of the pill - "make green and red." The .plus/.minus spans already existed in the DOM but had never been given color, so a mixed staged count read as one flat color. Added two CSS rules.
type: project
relates_to: [session_2026-08-02_slower-transitions-and-remove-ring.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: browser screenshot at close crop shows "+1" in green and "-1" in red on the real bottom bar, produced by actually staging one real install and one real uninstall (not synthesized); both test toggles then reversed and confirmed back to "Apply" with no pending count, so no staged-but-unapplied state or real disk drift was left behind
confidence: high
---

# Coloring the staged-count pill (2026-08-02)

Jonah, with a screenshot of the "+1 -1 staged" bottom-left pill: "make green and red."

## What was there already

`index.html`'s footer already builds this text as two separate spans -
`mk('span','plus','+'+ins)` and `mk('span','minus','-'+un)` - but `styles.css` had never
defined `.plus`/`.minus` at all, so both inherited the `.staged` rule's single
`color:var(--text-primary)`. The structure for per-sign color already existed; only the
color rule was missing.

## Fix

```css
.staged .plus{color:var(--ok);}
.staged .minus{color:var(--red-text);}
```

Reused the same two tokens the row badges already use for the identical distinction
(`--ok` for will-install, `--red-text` for will-remove - the text-safe red variant, not the
UI-component `--red`), so the staged-count pill now agrees with every badge on the page
rather than introducing a third color pairing.

## Verification detour: lost the server's one-time auth token

Tried to reload the existing cmux browser tab to pick up the new CSS but navigated to a
bare URL with no `?token=` - `installer-gui/server.py` requires that token on every
`/manifest` and `/apply` route (nonce-per-instance, never persisted to localStorage,
checked with a constant-time compare), so the reload came back with a 403 body the page's
own fetch then failed to parse. Not a regression from the CSS change: killed the orphaned
server instance, started a fresh one with `--print-url` to capture its token, and navigated
there. Then staged one real install (ampersand) and one real uninstall (statusline) to
reproduce the actual mixed state rather than trusting a static mockup, screenshotted, and
cropped tight on the bottom bar to confirm the colors at pixel level.

## Files touched

- `claude/installer-gui/styles.css` (`.staged .plus`/`.staged .minus` color rules added)
