---
name: The installer said "[exit 0]" to a human, and its status messages were written into a span the next hover erased
description: The closing line is now a sentence, and it is still the exact signal the client matches. Status moved into a real toast anchored above the action bar. Also fixed the log panel, which took an inverting token and turned into a bright cream slab in dark mode.
type: project
relates_to: [session_2026-08-01_badge-becomes-the-checkbox.md]
superseded_by: session_2026-08-01_log-block-became-toasts.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: a real install and a real uninstall driven through the UI end to end, success toast caught by polling, dismiss button clicked, both themes read, machine restored to its starting state
confidence: high
---

# Saying it in words (2026-08-01)

Commit stamp at authoring: 395a6492.

Jonah: "Can you choose different language than 'exit 0', like, make this look professional. Also,
status messages like that should appear in a toast module, bottom center of viewport, utilize theme
elements."

## The exit code was load-bearing, which is why it was still there

`[exit 0]` was not decoration. The browser matched it to decide whether the plan had actually
landed, and on anything else it KEEPS your staged changes rather than silently dropping them. So
the wording could not simply be prettied up on the server - the emitter and the matcher had to move
together or every apply would report as failed.

    server.py   "\nAll changes applied successfully.\n"
    index.html  /All changes applied successfully\.\s*$/

Both now carry a comment naming the other. A sentence doing double duty as a machine signal is a
real coupling, and the only honest way to hold it is to say so at both ends.

The failure line got the same treatment: "Apply did not complete. The installer stopped with status
N and your staged changes were kept." The status number survives because it is the one thing worth
quoting when asking for help - it is just no longer the whole message.

## The status bar was erasing itself

`toast()` wrote into a span in the action bar. Row hover called `showDetail()`, which cleared it.
**A message about a failed apply could be wiped by moving the mouse.** The most important sentence
in the app had the shortest life.

A toast owns its own lifetime instead: five seconds for a confirmation, ten for an error, dismiss
on click, capped at three so a burst cannot become a wall. `role="alert"` on errors and
`role="status"` otherwise, so an error interrupts a screen reader and a confirmation waits its turn.

**Anchored to the action bar, not the viewport.** `position:absolute; bottom:100%` on a child of
the footer puts it directly above the bar whatever height the bar happens to be. A fixed viewport
offset would have needed a magic number that goes stale the moment the bar changes.

State reads as a tint plus a Lucide icon, never an edge stripe, which is what the craft floor asks
for and what the earlier side-stripe correction established.

## Two things fixed on the way through

**The log was a bright cream slab in dark mode.** It took `--inverse`, which is cream in the dark
theme, so a console panel inverted into the single brightest surface on a dark screen - the exact
opposite of the terminal look intended. The token flipped but the INTENT did not. Now a `--console`
pair that stays dark in both themes, deeper than the canvas in dark so it still reads as recessed.

**Removing the status span removed the layout spacer.** That span carried `flex:1`, so deleting it
would have bunched the keys and actions to the left. The spacing is now stated on `.keys` directly,
rather than inherited from an element whose real job was text.

## Verified by doing it

Toast rendering cannot be proven from a screenshot of the default state, so the apply path was
driven for real: installed `sidecoach-detect` (advisory, off by default), watched the log read
"All changes applied successfully", then uninstalled it again to leave the machine as found. The
success toast auto-dismisses in five seconds and was missed on the first pass, so the second run
polled for it and caught "One change applied." with the singular grammar correct.

    static-ban   0
    objective    0 (rendered)
    subjective   0 (rendered)
    static-check 0 blocking, 2 warnings

## The error toast, and the defect that only showed once it was on screen

Jonah asked to see the error state. Faking one would prove nothing, so it was triggered through a
real documented failure: apply exit code 4, "the install log could not be created; nothing
executed". Pointing the server's `TMPDIR` at a directory that does not exist reaches it without
touching a single component, which is the point of that code existing as a distinct value.

The whole chain behaved: the log carried the real mktemp error and the closing status line, the
toast said what to do about it, `sidecoach-detect` stayed staged as WILL INSTALL, and Apply stayed
armed. Confirmed afterwards that nothing had changed on disk and no stray directory was created.

**And the screenshot caught a defect nothing else would have.** The state tints are rgba, and
setting `background:var(--red-subtle)` REPLACES the opaque surface rather than layering over it -
so the toast was translucent, and the log text it was describing read straight through the middle
of the message. Toasts nearly always sit over that log, so the one place this shows is the one
place it always happens.

Fixed by layering the tint over the surface, `linear-gradient(tint,tint) var(--raised)`, which
keeps the tint honest and the backdrop opaque. It cannot be seen in a static markup review and no
lens measures it - only rendering the failure and looking at it.

## Files touched

- `claude/installer-gui/server.py`, `index.html`, `styles.css`
