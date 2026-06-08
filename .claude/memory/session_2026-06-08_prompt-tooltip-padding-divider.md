---
name: prompt-tooltip-padding-divider
description: Prompt-mode selection-label tweaks - tighter left padding (icon snug left) + a vertical divider before the remove (x) button.
type: project
relates_to: [session_2026-06-08_prompt-elements-tab-icons.md, session_2026-06-08_prompt-label-centered-above.md]
---

Collaborator: Jonah

## Request
On the Prompt-mode selection label: less left padding so the icon sits more snugly left, and a divider between the label text and the X button -> format `([] label | x)`.

## Change (`claude-dotfiles/justify/core/prompt/index.ts`, `_showSelOverlays`)
- Label pill cssText: left padding `4px 8px 4px 12px` -> `4px 8px 4px 6px` (icon snug left; right stays 8px).
- Added a 1px divider div between the text span and the X button, gated on `_showLabels !== false` (the label-less 24px circle X-only variant gets no divider).
- Divider style (final, after Jonah's follow-up "more space + touch top/bottom"): `width:1px;align-self:stretch;margin:-4px 0 -4px 5px;background:rgba(255,255,255,0.18);flex:none`. `align-self:stretch` + the `-4px` top/bottom margins cancel the pill's 4px vertical padding so the divider spans edge-to-edge (touches top/bottom). `margin-left:5px` adds space before the divider on top of the flex `gap:5px` (~10px total label->divider; divider->X stays 5px).

- Follow-up 2 ("more subtle divider + larger x touch target"): divider `background` `rgba(255,255,255,0.18)` -> `rgba(255,255,255,0.1)` (fainter). X button (`xb`) cssText `padding:0;margin:0` -> `padding:5px;margin:-5px -3px;border-radius:50%` - padding grows the clickable hit box to ~20px (was ~10px); negative margins keep the pill visually compact (margins don't shrink the clickable padding box). Verified the X still removes the selection on click.

Only the selection label changed; the hover label (`_hLabel`, no X) was left as-is.

## Build/deploy/verify
`node build.js --core-only` + `bash deploy.sh --core-only`. Verified live (yesand.lndo.site, Prompt mode): selected h3 -> label reads `T  h3 .fl-module | x`, icon snug to the left, vertical divider between text and the red X. Matches the requested format.

Files touched: `claude-dotfiles/justify/core/prompt/index.ts` (2 edits), rebuilt+deployed bundle. Uncommitted working-tree changes.
