---
name: The log slab at the bottom is gone - shell output is translated into plain sentences, and nothing dismisses itself any more
description: Jonah hated the status block, and it underlaid the toasts. The installer's output is now parsed line by line into English toasts that stack in a column, grow in, slide the others up, and wait for the X. The one exception is the progress toast, which stops being true when the run ends.
type: project
relates_to: [session_2026-08-01_toasts-replace-the-exit-code.md]
supersedes: session_2026-08-01_toasts-replace-the-exit-code.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: real install and real uninstall driven end to end, plus a real exit-4 failure repeated to stack four toasts; success toast held past 14s; X dismiss confirmed; machine left in its starting state
confidence: high
---

# No more slab (2026-08-01)

Jonah: "I fucking hate the status messages appearing in a block at the bottom. They also underlay
the toasts. All log messages need to be rewritten in layman's english, and present in toast
notifications." Then: "make those toasts animate in and slide up when a new one comes in and dont
let them disappear without user consent (x button)."

## The block is gone, and the shell is translated

`<pre id="log">` is deleted, along with the `--console` tokens added for it an hour earlier. The
stream is parsed line by line against a rule table, and each recognised line becomes a sentence:

    apply_pending: could not create the install log in /x - nothing was applied
      -> The installer could not write its temporary files to /x, so nothing was
         changed. Check that the folder exists and the disk is not full.

**The hard part is not the translation, it is the lines with no rule.** Swallowing an
unrecognised failure would be worse than the slab ever was. So unmatched lines are buffered, and
if the apply fails without a single rule matching, the last one is shown verbatim: "The installer
said: ...". One raw line a person can quote beats a reassuring message that hides it.

## Nothing closes itself

Every toast now waits for the X. The single exception is the progress toast, and the reason is
that it is the only one whose text STOPS BEING TRUE: leaving "Applying one change..." on screen
after the run has finished is a lie, not patience. Everything reporting what happened to your
machine stays until dismissed.

That removes the cap, so the column is scrollable instead - `max-height:64vh` with
`:empty{display:none}` so it never sits over the action bar as an invisible click target.

## The animation, and why the enter is a keyframe and the exit is a transition

Each toast lives in a SLOT that opens from `grid-template-rows:0fr` to `1fr`. The ones already on
screen are pushed up by a row that is growing, rather than jumping to a new position - that is the
slide-up, and it costs no measurement.

**Enter is a keyframe animation with NO fill-mode, deliberately.** If it never advances, the
element sits at its normal fully-visible state. Exit has to be a transition, because unlike
arriving it must HOLD its end state until the element is removed a frame later.

That split is not stylistic. This project has already shipped a pane that stayed blank for nine
seconds because an `opacity:0` keyframe carried `fill-mode: both`, and the rule that came out of it
is that the resting state must always be the visible one.

## A defect the previous pass had shipped

The state tints are rgba. Setting `background:var(--red-subtle)` REPLACED the opaque surface
instead of layering over it, so the toast was translucent and the log text read straight through
the middle of the message. Fixed with `linear-gradient(tint,tint) var(--raised)`. It was invisible
in a static read and no lens measures it - only rendering the failure and looking.

## Verified against a real failure, not a simulated one

Exit code 4 is documented as "install log could not be created; nothing executed", so pointing the
server's `TMPDIR` at a directory that does not exist reaches the error path without touching a
component. Repeating it stacked four persistent toasts. Confirmed afterwards that nothing changed
on disk and no stray directory was created.

    static-ban   0
    objective    0 (rendered)
    subjective   0 (rendered)
    static-check 0 blocking, 2 warnings

The write-time taste gate reported a BLOCKING `state-completeness` during the edits; the full
directory run reports 0 blocking. The gate scores a CSS file alone, the detector sees the markup
too - worth remembering before chasing one of its findings.

## Files touched

- `claude/installer-gui/index.html`, `styles.css`
