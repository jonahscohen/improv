---
name: CONFIRMED - the polish payload teaches. Also the lead's fourth wrong instrument in two days, and the worst one.
description: Observer verification of the wired craft guidance. The claim holds. It took four probes because the lead's own prose filter excluded the table rows carrying the prose.
type: project
relates_to: [session_2026-07-29_wire-the-coach.md, session_2026-07-29_observer-could-not-yet-confirm.md]
supersedes: session_2026-07-29_observer-could-not-yet-confirm.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: payload reconstructed in the agent's described workdir and READ line by line rather than grepped
confidence: high
---

# The coach is real, and my instrument was wrong four times

## CONFIRMED

`/sidecoach polish the incident dashboard`, run from a workdir holding the 65KB coverage
page plus a PRODUCT.md. Same rule, before and after:

    BEFORE  | linguistic-p1-slop-words = 6  | resolve the linguistic p1 slop words issue on the affected element |
    AFTER   | linguistic-p1-slop-words = 22 | Replace each with a concrete verb or noun rooted in this product's
                                              vocabulary. Where ...

The closing lines are no longer one template repeated 7 times. Each now carries a reason
specific to its rule:

- `violation-count` -> "Do not act on this number directly. Work the individually named
  findings below it"
- a named ban -> "a named ban is a pattern that reads as the default answer rather than a
  choice"
- slop words -> "the flagged words are the predictable training-data default"

`resolve the <rule name> issue on the affected element`: **7 occurrences yesterday, 0 today,
across all four probes.** The template is gone and real instruction is in its place.

## THE FOURTH BAD INSTRUMENT, and it is the worst of the four

I ran three probes that each reported no teaching content, and every one was my fault:

1. No page in the invocation, so nothing failed, so nothing was selected. The agent's
   proportionality design working as intended.
2. A path to a 1.4MB corpus page rather than the workdir arrangement described.
3. The workdir reconstructed correctly - and I STILL reported nothing, because I grepped for
   `Good:` / `Why:` / `Do:` markers and for prose lines over 70 characters using
   `grep -vE '^\|'`.

**That filter excludes every line beginning with a pipe. The guidance lives inside the table
cells. My prose detector was built to skip exactly the lines carrying the prose.**

I only found it by giving up on grep and printing the payload.

## The pattern, now four for four in two days

- an `h5` before an `h1` in a fixture, which is a heading ascent and not a skip
- an emptiness test against a hook that answers `{}` for "no finding"
- a payload naming a file that did not exist, against a guard that reads from disk
- a prose filter that excluded the rows containing the prose

Every one built to match the shape I expected rather than the shape the subject emits. Every
one would have published a false negative about work that was sound. Two were caught only by
a control I nearly skipped; this one was caught only by abandoning the instrument and
reading the raw output.

**The rule I keep re-learning: when a probe reports nothing, read the raw output before
believing it.** A grep that finds nothing and a subject that produces nothing are
indistinguishable, and the grep is the likelier culprit.

## Still unverified

The `Good:` / `Why:` / `Do:` craft brief the agent describes appears when polish-standard
rules fail; this page did not trigger them, so I have not seen that section. The improvement
confirmed above is in the per-finding guidance, which is the part that replaced the template.

## Files touched

- none (verification only)
