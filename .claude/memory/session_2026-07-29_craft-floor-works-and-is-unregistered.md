---
name: The craft floor is built, correct, and registered nowhere - plus the lead's seventh wrong instrument
description: coach built a working craft-floor hook that emits 15 rules and 10 refusals with sources, correctly silent on non-UI writes. It is in no settings file, so it never fires. Also: craft reach is 21 of 26, not 1 of 26 - the lead's tripwire grepped polish-craft while the new code uses craft-flow.
type: project
relates_to: [session_2026-07-29_real-key-fragment-purged-and-two-false-claims.md, decision_discoverability_outranks_internal_quality.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: floor hook invoked directly with a synthetic PreToolUse payload and its raw output read end to end; negative control run on a non-UI path; settings files grepped for the registration; craft reach re-counted against every craft module symbol with the union grep proven to fire
confidence: high
---

# The floor works. Nothing calls it. (2026-07-29)

Commit stamp at authoring: 5fcfdcee.

## What was built, and it is good

`claude/hooks/sidecoach-craft-floor.sh` plus `src/craft-floor.ts`, `src/craft-flow.ts`,
`src/craft-laws.ts`, `src/craft-corpus.ts` and `bin/sidecoach-floor.js`.

Invoked directly with a synthetic PreToolUse payload naming an `.html` path, it returns valid
`hookSpecificOutput` carrying **15 HOLD THESE rules and 10 REFUSE THESE anti-patterns**, every
rule with a concrete value and a `Source:` line naming its in-repo origin, and every refusal
with an INSTEAD clause so the banned shape cannot return under a new name.

Its own framing is correct floor semantics: "It loaded because a UI file is being edited, not
because any sidecoach verb ran and not because anything was measured." And it defers properly:
"A pinned brief or the project's own DESIGN.md tokens override any value here. Your habit does
not."

NEGATIVE CONTROL PASSED: given a `.txt` path it emits nothing. It is not a hook that fires on
everything.

## The defect

    grep -rl "sidecoach-craft-floor" ~/.claude/settings.json ~/.claude/settings.local.json
    # NOT registered in any live settings file
    grep -c "sidecoach-floor" claude/settings.json
    # 0

`claude/settings.json` carries 4 hook registrations and this is not one of them. **The floor
cannot fire.** A hook that is not registered is a script on disk.

This is the exact failure mode every teammate on this team was briefed to prevent, in the exact
words used in the brief: a unit that satisfies its own local boundary while nothing downstream
can reach it. It reproduced anyway, in the one unit whose entire purpose is to load
unconditionally. The lesson is not that the brief was ignored; it is that a builder's definition
of done is the artifact, and only an external check catches the wiring.

## The lead's SEVENTH wrong instrument

My loop tripwire counted "flow handlers reaching craft" with
`grep -rl "polish-craft|craftBrief" src/flow-handler*.ts` and reported **1 of 26**, unchanged.

The truth is **21 of 26**. `craft-flow` is imported by 20 handlers, `polish-craft` by 1. I
grepped for the module name I expected rather than the one the new code uses.

Seven in two days, every one the same shape: the instrument matched what I expected the subject
to look like rather than what the subject emits.

**The correction that follows is a change of method, not more care.** Symbol greps keep failing
because module naming is not mine to predict. Measure by BEHAVIOR: run the thing and read its
raw output. That is what found both facts in this beat - the floor's quality and its silence -
and no grep would have found either.

## Files touched

- `.gitignore` (transient probe artifacts from verification passes: `__flowprobe.*`, `__liveflow.*`, `__pageprobe.*`, `__t.js`, `*.tmp.js` - 17 were sitting untracked and would have been swept into a commit)
