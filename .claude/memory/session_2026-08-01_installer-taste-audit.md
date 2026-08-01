---
name: The taste audits found two measured contrast failures and two stripped icon provenance markers that no eyeball pass would have caught
description: I had only run the static lens with --no-render, which skips the objective and subjective lenses entirely. Running them found span.keys at 3.24:1 and the disabled Apply at 2.76:1, plus Lucide icons whose provenance markers I had dropped when inlining.
type: project
relates_to: [session_2026-08-01_installer-gui-dashboard-redesign.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: rendered lenses run against a live server in BOTH themes; ban sweep run on html and css; static lens re-run over the directory so it could read the external stylesheet; split build re-rendered and read to confirm styling survived; stylesheet route probed for MIME and traversal
confidence: high
---

# What the taste audits caught (2026-08-01)

Commit stamp at authoring: c5b291f1.

Jonah: "I think you need to run it through some taste audits."

He was right, and the reason is specific: **I had only ever run the detector with `--no-render`.**
That flag skips the objective and subjective lenses, which are the taste layer. I had run the
static lens four times and called it an audit.

## What the rendered lenses found

    [blocking] objective/low-contrast  @ span.keys      3.24:1 (need 4.5:1)
    [blocking] objective/gray-on-color @ button#btnApply 2.76:1 gray text on colored bg

Both real, both invisible to me across five screenshots I had already read.

1. **The footer keyboard legend** ("move", "toggle", "back") was tertiary ink on the raised
   surface. Those are labels you read, not decoration, so they now take secondary ink.
2. **The disabled Apply button** dimmed its label to signal disabled - which is precisely what the
   craft floor warns against: "do not signal disabled with opacity alone, which usually breaks
   contrast - change the surface and keep the text legible." Disabled is now signalled by the
   surface dropping out of the brand red and by the cursor. An unreadable control is not a clearer
   disabled state, just a worse one.

After the fix: **objective 0, subjective 0, verdict clean** - and separately in the light theme,
because the floor is explicit that passing in one does not imply the other.

## What the ban sweep found

**`fabricated-svg` on both Lucide icons.** The paths were copied verbatim from lucide.dev, but I
dropped the `class="lucide-..."` and `data-icon-source="..."` markers when inlining them. The
marketing site carries both. Verbatim-but-unverifiable is exactly the state the icon rule exists
to prevent - the rule is not "did you copy it", it is "can anyone check". Markers restored on both
icons and on the wordmark.

**`large-inline-style`, 249 lines.** Fixed properly rather than argued away: the CSS is now
`styles.css`, with a `/styles.css` route in server.py. The route sits before the auth gate for the
same reason `/` does - a browser fetches a stylesheet without the page nonce, and a 403 would
leave the installer *unstyled but operable*, which looks broken while still working. Fixed path,
no user input, no traversal surface; probed and confirmed a `..` request still returns 403.

## Final state

    static-ban                     0
    static-check                   2 warnings, 0 blocking
    objective  (rendered, dark)    0
    subjective (rendered, dark)    0
    objective + subjective (light) 0
    anti-pattern ban sweep         0 violations

The two remaining warnings are `staggered-enter` and `subtle-exit`, which want enter and exit
animation patterns this UI does not have. Complying means adding motion that does not exist.

One thing worth keeping: pointing the static lens at the FILE after the split made it report
everything inconclusive, because it could no longer see the stylesheet. Pointing it at the
DIRECTORY fixed that. The detector refusing to certify what it cannot read is the fail-closed
behaviour this project wins on, working correctly against its own author.

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css` (new)
- `claude/installer-gui/server.py` (`/styles.css` route)
