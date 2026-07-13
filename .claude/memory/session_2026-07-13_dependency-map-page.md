---
name: Dependency map page + servers (2026-07-13)
description: Built docs/dependency-map as one offline HTML file, stood it up on :4832 alongside marketing-site :4830, folded 10 Codex findings
type: project
relates_to: [reference_component_dependency_map.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: browser (cmux + chrome MCP) + codex-review
confidence: high
---

Built the improv dependency map as a single self-contained page and served it, from a
lead-supplied evidence sweep. Collaborator: Jonah Cohen.

## What was built

- `docs/dependency-map/index.html` - one file, inline CSS+JS, zero external requests
  (verified: no `src=`, `href=`, `@import`, or `fetch`; the only URLs in the file are
  finding TEXT and the SVG namespace identifier). Renders offline.
  Tiered hierarchy, 5 colour-coded classes, SVG connector wires with a
  runtime/vendored/deploy filter row, click-to-open detail panel (class, evidence
  file:line, debt flags), islands section, and the 10 findings in full sentences.
- `docs/dependency-map/serve.py` - no-cache dev server, exit-code contract
  (0 ok / 2 missing index / 3 port in use / 4 bad port / 5 permission denied).

## Key decisions

**Why the palette is computed, not chosen:** ran the dataviz skill's
`validate_palette.js` on the 5 class hues in BOTH modes rather than eyeballing them.
Light passed with a contrast WARN on aqua/yellow and dark passed with a CVD floor-band
WARN (worst adjacent dE 10.3). Both WARNs are conditional-legal ONLY with secondary
encoding, so every node carries a direct text label plus a text class badge, and text
wears ink tokens, never the series colour. Red is reserved for status/debt flags and is
never a class colour.

**Why serve.py deliberately DIVERGES from marketing-site/serve.py:** that file serves
the process cwd and defaults to port 4830, which is the direct cause of finding 9
(reference/serve.py is a copy carrying the same default, leaving only convention
between two sites and a port collision). Copying the pattern forward verbatim would
have propagated the bug being documented. This one binds its own directory explicitly
and defaults to 4832.

## Codex review (real, exit 0, 107.9s) - 10 findings, all folded

The one that mattered: **`<button class="kid">` nested inside `<button class="node">`**
is invalid HTML with unreliable click/keyboard/a11y behaviour. It rendered fine in
Chrome, which is exactly why a same-model read missed it. Fixed by making the node a
div with a stretched hit-button layered UNDER the content (z-index), so kids are
siblings, not descendants, of a button. Also folded: dropped the only `innerHTML` path
(findings now build real text/code nodes from backticks); bound the server to
127.0.0.1 instead of all interfaces; split EACCES out of the "port in use" exit code
(the contract was lying about which failure occurred); added `server_close()` in a
finally; anchored same-row wire endpoints to each card's OWN bottom; added a
`prefers-color-scheme` change listener so wire strokes cannot go stale; made the panel
a real modal (`aria-modal="true"` + `inert` background as the focus trap); gave the
theme toggle an exposed `aria-pressed` state and a live label.

**Contrast finding, computed not argued:** the palette's muted ink `#898781` measures
3.41:1 on the light page plane - under AA for the 11-12px labels it was used for.
Darkened light-mode `--ink-muted` to `#6e6d66` (4.93 on page, 5.06 on surface). Dark
mode keeps `#898781`, which already clears AA on the dark plane.

## Self-analysis: two defects I shipped into the browser

1. **Vertically-centred card content.** `.node` was a `<button>`, and a button centres
   its content when taller than it, so short cards floated their text to the middle
   while cards with kids did not. Caught only by LOOKING at the screenshot. The failure
   mode: I reasoned about the box model and never questioned the element type.
2. **Tier 1 wrapped.** Five nodes at `min-width:168px` overflowed the track, so
   `.claude/memory` wrapped to its own full-width row and read as a tier of its own.
   Fixed with a per-tier CSS grid. Both defects share a root: I verified the code was
   correct instead of verifying the RENDER was correct.

Also: the first cmux screenshot was under 900 CSS px, so it rendered the responsive
branch, not the desktop one. Nearly reported "verified" on a layout I had not actually
seen. Widened via Chrome MCP `resize_window` to 1440 and re-verified.

## Justify daemon state (observed, not assumed)

Daemon was UP: `:9223/justify-core.js` returned HTTP 200 (603191 B) and the
marketing-site console logged `[Justify] Ready. Transport: connected`, no errors. So
finding 7's degradation is real in the code but was NOT manifesting during this
session - the pages only break when the daemon is down.

## Harness notes: two commit-gate false positives (for Jonah)

Both gates in `bash-guard.sh` blocked a commit whose obligations were already
satisfied. Neither is a violation; both are stale-flag bugs worth a look.

1. **`.needs-verification` is re-armed by non-UI writes.** `verify-before-done.sh`
   sets the flag on ANY file change. Writing the two session beats (`.md`) AFTER the
   browser verification re-armed it, and because a `.html` file was staged, the commit
   gate then demanded browser verification a second time for a page that had not
   changed since it was verified. The commit-time gate already filters staged files by
   type; the SET side does not. Suggest exempting `.claude/memory/**` and `*.md` in
   `verify-before-done.sh`, matching the filter the commit gate already applies.

2. **`.memory-dirty` is set by a `/dev/null` redirect.** `memory-nudge.sh` scans the
   bare command for write tokens. `cmux browser ... navigate "..." > /dev/null 2>&1`
   contains the `> ` redirect token, so a read-only browser navigation was classified
   as a project-file write and re-armed the beats gate after the beats were written.
   The existing de-quoting fix (T-0033) handles write tokens inside quoted spans but
   not a genuine redirect to `/dev/null`. Suggest treating `> /dev/null` (and
   `2>&1`) as non-authoring.

Neither was bypassed. Both were cleared through the sanctioned paths (a real
screenshot Read for the first; this beat edit for the second).

## Files touched

- docs/dependency-map/index.html (new)
- docs/dependency-map/serve.py (new)
- .claude/memory/reference_component_dependency_map.md (new)
- .claude/memory/session_2026-07-13_dependency-map-page.md (new)
- .claude/memory/MEMORY.md (index)
