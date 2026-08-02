---
name: Row left padding removed, partial-badge count switched to slash format
description: Two small direct orders - "remove the left padding from each component row", and matching an existing screenshot, "make this 7/8" so the partial-group badge reads N/N like every other count on the page instead of "N of N".
type: project
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: confirmed live in every screenshot taken this session (row content flush with the pane's own left edge, no gap before the name/description column; partial badges read e.g. "4/5" not "4 of 5")
confidence: high
---

# Two small direct orders, folded into this session's commit (2026-08-02)

Both were made earlier in this session and confirmed visually in every subsequent
screenshot, but had not yet gotten their own beat or landed in a commit.

- `.row`'s left padding went from `var(--s2)` to `0` (`padding:var(--s3) var(--s2)
  var(--s3) 0`), so a row's name/badge/description start flush with the pane's own edge
  instead of sitting indented from it.
- The partial-group badge text changed from `c.on+' of '+c.total` to `c.on+'/'+c.total`,
  matching the slash format every other count on the page already uses (rail counts,
  fully-installed badges, staged-count text).

## Files touched

- `claude/installer-gui/styles.css` (`.row` padding)
- `claude/installer-gui/index.html` (partial badge `btext` format)
