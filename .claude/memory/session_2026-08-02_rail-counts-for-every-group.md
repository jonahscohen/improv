---
name: The rail now shows a count for every group - complete groups had been hiding theirs entirely
description: Direct order - every component grouping in the left rail shows its N/total now, not just the incomplete ones. Kept the amber color reserved for groups that actually need attention, since applying it to every count (including fully-installed ones) would have made the color meaningless.
type: project
relates_to: [session_2026-08-02_wcag-aa-508-audit.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered - all 10 rail items show a count (Beats 9/9, Tiltlab 1/1, Design Tools 11/11 etc now visible); only genuinely incomplete groups (Foundation 4/5, Sidecoach 8/9, Guardrails 37/38) render amber; detector 0 blocking; suite 147/0
confidence: high
---

# Every group, not just the unfinished ones (2026-08-02)

Direct order: "In the left hand nav, show number counts for all component groupings."

The rail previously suppressed a group's count entirely once it was fully installed
(`c.total>1 && c.on<c.total`), reasoning a count that just says N/N repeats what the group's own
completeness already implies. Removed that gate - every rail item shows its count now.

## Keeping the color meaningful once every row has one

The count's amber color was written for exactly the opposite situation - "the one thing in the
rail that is allowed to be coloured, so the eye lands on what is unfinished." Coloring every count
amber, including fully-installed groups, would have erased that distinction outright: nine out of
ten rows would read as equally worth a second look, none more than the others.

Split it: the count itself is now unconditional, but only carries the amber `.is-part` class when
`c.on<c.total`. A complete group's count sits in `--text-tertiary` (the same token this session's
accessibility pass just re-verified at 4.5:1), matching everything else quiet in the rail; an
incomplete one still gets the color that means "look here."

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css`
