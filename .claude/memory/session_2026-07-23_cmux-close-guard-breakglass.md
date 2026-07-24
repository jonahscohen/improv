---
name: cmux transient permission-denies fixed by a per-target break-glass, NOT by failing soft
description: The lead specced a fail-soft split for an unintrospectable cmux; nine Codex passes proved fail-soft unsafe in every form, so the verdict stayed DENY and the REMEDY changed - CMUX_CLOSE_UNVERIFIED, an explicit per-target assertion that replaces "restart cmux and lose your session"
type: decision
relates_to: [decision_cmux_hardening_proposal.md, session_2026-06-25_cmux-hook-command-not-found-fix.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: Mac
source: session
verified: tests (test-cmux-close-guard 88 -> 127, zero failures) + 13-case lead probe against stubbed cmux + 9 rounds of Codex review (codex-cli 0.142.5 confirmed present)
confidence: high
---

Jonah, 2026-07-23: "cmux keeps experiencing seemingly transient permissions issues that bubble up
when hooks fire... restarting cmux has proven to be costly to active work."

## Root cause

`cmux-close-guard.sh` is a PreToolUse hook on the `Bash` matcher, so it runs on EVERY Bash call, and
it was fail-CLOSED on every uncertainty INCLUDING uncertainty about cmux itself. When cmux's CLI was
unresolvable, timed out, exited non-zero, returned empty, or answered in a shape the parser did not
recognise (a schema change after a cmux auto-update), the guard denied the close. The only way out
was restarting cmux - which destroys the very active work the guard exists to protect. Catalogued in
[[decision_cmux_hardening_proposal]] as Option (a) gap (i), never implemented.

## The decision: the verdict stayed DENY; the REMEDY changed

**I specced this wrong.** My dispatch told the teammate to fail SOFT when cmux cannot be seen -
"there are provably no panes to protect, so allow." That premise is false, and independent review
broke three separate drafts of it:

1. **A close subcommand keeps working while introspection is down.** `list-panels`/`top` failing
   does not imply `close-surface` fails. cmux can be perfectly capable of destroying a live pane
   while unable to answer the query that would have proved the pane live.
2. **A bare name resolves differently for the shell than for this hook.** "I cannot find cmux" is
   not proof cmux will not run - the shell may have a different PATH, a profile entry, or a function.
3. **A missing path can be created earlier on the same line.** TOCTOU:
   `install -m 755 <real cmux> /tmp/cmux-x; /tmp/cmux-x close-surface ...` is absent at hook time
   and fully functional at execution time.

There is no state in which "the guard cannot see cmux" reliably implies "the close cannot kill a
pane," so the guard no longer tries to infer one.

**Alternatives considered:**
- **Fail-soft on absent/transient/drifted (my original spec):** rejected on all three grounds above.
  Each of the three drafts was broken by Codex on a different one.
- **Keep denying with no escape hatch (status quo):** rejected - it is the reported pain. The remedy
  being "restart cmux" is what costs Jonah his session.
- **Break-glass assertion (chosen):** an unintrospectable cmux still DENIES, but the denial now
  offers `CMUX_CLOSE_UNVERIFIED=<target>`, a per-target assertion the caller adds after checking the
  pane by hand.

**Why this one:** it turns "restart cmux and lose your session" into one named, warned and logged
assertion, without ever making an unverified close the default. It is deliberately per-target and
deliberately NOT a boolean - a truthy flag would be pasted once and forgotten, while naming the
surface forces the same positive identification the ownership gate already demands.

**Scoping that matters:** `list-panels`/`top` are needed by EVERY close, so their failure requires
every close on the line to be asserted. The pane tree is needed only by workspace/window closes, so
a tree outage clears only the close that asserted it. An earlier draft emitted a whole-line allow
there, which would have let
`CMUX_CLOSE_UNVERIFIED=workspace:2 cmux close-workspace ...; CMUX_CLOSE_UNVERIFIED=surface:23 cmux close-surface ...`
clear a LIVE surface:23 with no liveness check - a re-introduction of the 2026-07-12 incident,
caught by the second Codex pass.

An unresolvable cmux is NOT break-glassable, by design: the assertion means "I checked this pane,"
and with no reachable cmux there is nothing for it to attach to (Codex, 7th pass).

## Hardening folded in along the way (9 Codex passes)

Each of these was a real bypass of the guard, found by review, not by me:
- `PATH+=` append form was not recognised as an env prefix, so the executable resolved to the
  assignment word and the whole line fell through ALLOWED (9th pass).
- A parsed close with dynamic args skipped the dynamic-arg check entirely; a second `--surface` can
  expand at runtime and close a different pane than the one verified (4th pass).
- A renamed/copied cmux (`/tmp/cmux-x close-surface`) classified as "other" and was allowed (4th),
  while the first fix for it denied `grep close-surface docs/` and blocked ordinary work (5th).
- `PATH=` / `export PATH=` / `hash -p` remapping (5th and 6th passes).
- A `--` end-of-options separator lets cmux's parser pick a different target than the guard verified.
- `CMUX_CLOSE_GUARD_CMUX` made authoritative, because falling through to the real app made tests
  non-hermetic - a stub-path typo silently drove the LIVE cmux session.

## CORRECTION 2026-07-23: figures below were a mid-flight snapshot

The teammate flagged this on stand-down and it is right. The verification section originally recorded
**127 rows / 9 Codex passes**; the FINAL state is **138 rows / 12 passes**. My 13-case probe ran
before passes 10-11, so it predates three more bypasses. Re-probed all three afterwards (11 cases,
both directions):

- **Pass 10 - close hidden in an ASSIGNMENT substitution.** `out=$(cmux close-surface --surface
  surface:23)`: the whole word matched `ENV_ASSIGN`, was swallowed as an inert env prefix, no close
  was parsed, and the line was **ALLOWED**. Same root as the `PATH+=` hole - `ENV_ASSIGN` never
  matched bash's append form. Now DENY (verified, both shapes).
- **Pass 11 - same class as an ARGUMENT.** `echo $(cmux close-surface ...)`, `export out=$(...)`,
  and the backtick form: only cmux commands consulted `args_dyn`, so a substitution on any OTHER
  command went unexamined. Fixed generally in the coarse rule. All three now DENY (verified).
- **Pass 11 also caught a FALSE POSITIVE the teammate had introduced**: the tokenizer collapsed
  backslash escapes BEFORE testing for expansions, so an escaped `\$(` or backtick inside
  double-quoted prose read as a live substitution - it blocked one of its own review commands, and
  at one point `grep`/`rg`/`echo`/`cat` on a close token were denying. That is precisely the noise
  this unit exists to REDUCE, so it matters as much as the bypasses. Verified fixed: both escaped
  forms and all four read-only commands now ALLOW.

**Lesson (mine, again):** I recorded suite numbers sampled while a teammate was still working, for
the SECOND time in one session - the same failure I had already written a self-analysis about
further down this beat. Writing the lesson down did not stop me repeating it, because I treated
"the teammate has gone idle" as "the teammate is finished." Idle is not done; the beat landing and
an explicit stand-down are. Durable rule: take final figures only from the teammate's own closing
report or from a run made AFTER its process has exited.

## Verification (lead-side, independent of the teammate)

- `test-cmux-close-guard.sh` **88 -> 138 passed, 0 failed** (corrected; 127 was a mid-flight read).
- 13-case probe I wrote and ran against stubbed cmux binaries (transient/empty/drift/unresolvable):
  all three unintrospectable cases DENY without the assertion; correct per-target assertion ALLOWS
  on transient and drift; and every laundering attempt DENIES - a different surface, a truthy value
  naming nothing, covering only 1 of 2 targets, an unresolvable cmux, a PATH mutation, and a
  path-named executable. Ordinary prose (`grep`, `echo`) still ALLOWS, so it does not over-block a
  hook that runs on every Bash call.
- `codex --version` -> codex-cli 0.142.5 present, so the 9 cited review rounds are credible.

## Self-analysis

Two failures, both mine.

**I specced the fix wrong.** I read [[decision_cmux_hardening_proposal]]'s "fail-soft" recommendation
and handed it down as an instruction without testing its central premise - that an unseeable cmux
cannot close a pane. One minute of thought about `close-surface` versus `list-panels` would have
shown those are independent subcommands. I inherited a conclusion from a prior beat instead of
re-deriving it, which is the same "trusted the record over the evidence" failure the debugging
protocol exists to prevent. The teammate was right to override me, and the beat it could not write
is this one.

**I reported a mid-flight state as fact, twice.** I ran the suite early, saw rows reading
`TRANSIENT -> allow`, and told Jonah the fix was "absent/transient/drifted now allow, healthy still
denies." By then the design had already been reversed by review; those rows now read `-> deny`. I
described a design that no longer existed because I sampled an artifact mid-edit and never
re-checked before speaking. Pinned: a suite result read while a teammate is actively working is a
snapshot, not a finding - re-run it before reporting, and never characterise a teammate's design
from test NAMES alone.

## Files touched

- claude/hooks/cmux-close-guard.sh (break-glass + the 9 folded hardening findings) - by the teammate
- claude/hooks/test-cmux-close-guard.sh (88 -> 127 rows) - by the teammate
- .claude/memory/session_2026-07-23_cmux-close-guard-breakglass.md (this beat) - by the lead
