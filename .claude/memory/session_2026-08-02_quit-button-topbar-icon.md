---
name: Quit moved from the footer to a power-icon button beside the theme toggle
description: Direct order - "Move quit button into top right and use power off/on icon no label." Sourced the Lucide power icon verbatim from the local lucide checkout (not vendored in this repo's own icon subset), and generalized the theme toggle's button chrome into a shared .icon-btn class since two icon-only buttons now live in the topbar together.
type: project
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations/35 passes; test-component-browser.sh 147/0; accessible name confirmed via snapshot --interactive ("button \"Quit\""); real click confirmed the move didn't break doQuit (toast "Installer stopped" still fires); footer now shows only Apply
confidence: high
---

# Quit: footer text button -> topbar icon button (2026-08-02)

Jonah: "Move quit button into top right and use power off/on icon no label."

## Icon sourcing

This repo's own vendored icon subset (`sidecoach/data/icons/lucide.json`, 68 common
icons) has no "power" entry. Found the actual Lucide source at
`~/Documents/Github/lucide/icons/power.svg` (a full local checkout, separate from this
repo) and copied its two paths byte-for-byte (`M12 2v10` and
`M18.4 6.6a9 9 0 1 1-12.77.04`) rather than reconstructing the glyph from memory.

## What moved

- `#btnQuit` relocated from the footer `.actions` span (where it sat next to Apply as a
  text button) into `.topbar`, right after the theme toggle. Same id, so the existing
  `document.getElementById('btnQuit').addEventListener('click', doQuit)` needed no
  change at all.
- `aria-label="Quit"` replaces the visible text label - confirmed via
  `snapshot --interactive` that the accessible name is still exactly "Quit".
- The theme toggle's button chrome (44x44 square, `--alt` background, hover/active
  states) was pulled out into a shared `.icon-btn` base class, since Quit now needs the
  identical shape and duplicating the whole rule block for one button would have been
  the wrong call now that two buttons share it. `.theme-toggle` keeps only the
  theme-specific bits (which of the two SVGs shows per `data-theme`).
- The footer's `.actions` span now holds only Apply.

## Files touched

- `claude/installer-gui/index.html` (button markup moved + relabeled)
- `claude/installer-gui/styles.css` (`.theme-toggle` base rule renamed to `.icon-btn`,
  `.theme-toggle` narrowed to the icon-swap rules only)
