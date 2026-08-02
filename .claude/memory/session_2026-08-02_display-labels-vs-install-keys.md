---
name: Sidecoach, Justify, Lotus and Tiltlab now display capitalized/restyled - the label field existed in the data all along but nothing ever read it
description: browser-tree.json already carried a label override for these four buckets ("Sidecoach", "Justify", "Tilt-lab", "Lotus"), but the rail, breadcrumb, H1 and row all rendered the raw lowercase install key instead. Wired label through with a single labelFor() helper, and restyled tilt-lab's label to "Tiltlab" per direct order.
type: project
relates_to: [session_2026-08-02_intro-vs-install-text-split.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered rail/H1/breadcrumb/row/aria-label for all four; confirmed the badge still stages and clears correctly (state keyed on path, untouched); detector 0 blocking; suite 147/0
confidence: high
---

# Data that was already there, never read (2026-08-02)

Jonah: "Capitalize Lotus, stylize tilt-lab as Tiltlab, capitalize Sidecoach, capitalize Justify."

## The gap

`browser-tree.json` already had a `label` field on exactly these four bucket entries -
`Sidecoach`, `Justify`, `Tilt-lab`, `Lotus` - and `manifest.py` already forwarded it
(`"label": b.get("label", b["key"])`, present since the very first version of this file). But
`buildTreeFromManifest` never put `label` on the tree node it builds, and every render site (rail,
breadcrumb, pane H1, row name, the select/deselect aria-label) printed the raw `key` - which is
lowercase and hyphenated because it doubles as the install path
(`pending['sidecoach/Hooks/...']`, `--only lotus`, etc.) and can never change.

So the nicer text was sitting in the data the whole time, wired halfway, and simply never reached
the screen.

## The fix

One field, one helper, five call sites. `node.label = b.label || ''` in `buildTreeFromManifest`,
then `labelFor(path)` (falls back to the path's last key when no label exists, which is every
bucket except these four) replaces the raw key at: `rail__name`, the breadcrumb segments, `paneTitle`,
`row__name`, and the checkbox's `aria-label`. `key` itself is now unused in the row-render scope and
was removed rather than left dead.

tilt-lab's label also changed content, not just usage: from "Tilt-lab" to "Tiltlab" - a hyphen
removed, per the direct instruction to stylize it that way rather than just capitalize it.

## What stayed untouched, on purpose

Every place that actually NEEDS the lowercase key - `pending[path.join('/')]`, `installed[...]`,
`leafPaths`, `stageAll`, the apply plan sent to the server - still reads `path`/`key` exactly as
before. Confirmed live: staging and clearing Lotus's install still works, because none of that
logic ever touched display text.

## Files touched

- `claude/hooks/browser-tree.json` (`tilt-lab`'s `label` value only)
- `claude/installer-gui/index.html` (`labelFor`, five call sites)
