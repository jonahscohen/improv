---
name: Lead-written handoff for coach, reach and detector - they terminated before flushing their own
description: Three teammates were stood down for RAM before writing handoff beats. This records their state from what the lead verified directly, plus the open defects each was holding, so the recalibrated team does not re-derive any of it.
type: project
relates_to: [session_2026-07-29_scoreboard-handoff.md, session_2026-07-29_adversary-handoff.md, session_2026-07-29_grep-r-vs-R-the-eighth-instrument.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: every number here was measured by the lead directly rather than taken from a teammate report; the code is committed in 61860e5c and the tree typechecks clean
confidence: high
---

# Handoff for three teammates who did not write their own (2026-07-29)

Commit stamp at authoring: a7fcf566. Code snapshot: `61860e5c`.

Jonah paused the team for RAM. `scorekeeper` and `adversary` flushed handoffs.
`coach`, `reach` and `detector` did not, so this stands in for theirs. Everything below the
lead measured directly.

## coach - the craft floor and breadth

DONE AND VERIFIED LIVE: `claude/hooks/sidecoach-craft-floor.sh` emits 15 HOLD THESE rules and
10 REFUSE THESE anti-patterns, every rule with a concrete value, every rule naming its in-repo
`Source:`, every refusal carrying an INSTEAD. 11875 bytes on a `.html` write, 0 on a `.txt`
write, 0 on a second call inside the 900s per-project cooldown. Registered on `PreToolUse` for
`Write|Edit|MultiEdit`, deployed to `~/.claude/hooks/`, and packaged into `browser-tree.json`,
`app-wirings.json` and `install.sh`. Component-browser suite at 139 passed / 0 failed.

Breadth: **21 of 26 flow handlers** reach craft, via `craft-flow` (20) plus `polish-craft` (1).

OPEN, in priority order:
1. WHICH OF THE REMAINING 5 HANDLERS legitimately need no brief versus are simply not done.
   Never answered.
2. WHETHER THE FLOOR READS A PROJECT'S OWN `DESIGN.md` TOKENS or is generic across all
   projects. Never answered, and it matters: a floor that cannot read project tokens is generic
   advice wearing this project's name. Its own payload promises otherwise, saying a pinned brief
   or the project's DESIGN.md overrides any value in it.
3. `src/craft-probe.ts` had a TS2345 at line 219 that blocked `npm run build` for the whole
   team. It is clean now and the file changed, so coach probably fixed it, but nobody confirmed
   that in writing.

## reach - the loadable surface and doctor

DONE AND VERIFIED: loadable documents **2 files to 11**. A `reference/` directory now ships
routing.md, new-work.md, tools.md, doctor.md, harnesses.md plus four playbooks that SKILL.md had
previously named at a repo path an installed skill cannot resolve - named and unreachable, now
vendored with a build-time no-drift check. `tools.md` is GENERATED from `bin/sidecoach.js`'s
registry and fails the build if a shipped bin has no row, if a row describes a bin that no longer
ships, or if the committed doc drifts. That generated-and-asserted shape is the right pattern and
should be the template for the rest.

`doctor` is built and dispatches. 19 findings against us. Validated against planted positives
using the EXACT wording of two real defects `adversary` found, and it caught two false positives
in its own first drafts.

OPEN:
1. **THE HARNESS MIRRORING WRITES OUTSIDE `~/.claude`.** 11 files into each of five non-Claude
   harness dirs, 55 files, landed BEFORE Jonah descoped cross-harness reach on 2026-07-29. It
   must be gated OFF by default behind an explicit opt-in so a plain
   `./install.sh --only sidecoach` touches only the Claude surface. NOT DONE. Leave the
   detection code in place and documented; the decision is a product call, not a quality
   judgement on the unit.
2. `doctor`'s own test suite, and its third case wired into a regression test.
3. Per-capability playbooks: 4 against their 32. Same shape as the surface row.

## detector - three unanswered questions, one of them load-bearing

NOTHING CONFIRMED LANDED. All three of its rows were still open when it stood down.

1. **`marketing-buzzword`: does the rule fire, and was the claim ever true?** The global
   instructions assert the taste validator catches it AND that a live PostToolUse hook sweeps it
   on every HTML and CSS write. The canary says we miss it. A rule documented as enforced that
   does not fire is worse than a missing rule, because it buys false confidence. STILL
   UNANSWERED, and it is the most important open question on the board.
2. **Exit-code precedence.** `bin/sidecoach-detect.js` resolves an aggregate verdict where
   INCONCLUSIVE loses to FINDINGS. On `benchmark/fixtures/linked-css/page.html` the lens says
   `INCOMPLETE (cannot certify clean)` with ~20 rules inconclusive, and the process exits **1**
   instead of **3**. Exit 1 means "I found problems"; exit 3 means "I could not certify this."
   Automation reads the code, not the prose. Fix is upstream of lines 376-377, in verdict
   aggregation: inconclusive must dominate findings, and clean already correctly loses to both.
   A four-case regression test (missing file 2, garbage 3, no args 2, linked css 3) is the
   durable half. NOT FIXED.
3. Source line numbers on findings: **12% against their 80%.** Untouched.

## What the lead got wrong that these three should not inherit

Eight instruments in two days reported confidently while structurally blind, and FOUR were
greps. Two of them produced false tasking for these teammates specifically: an importer grep
against a subprocess spawn (told `imageflight` to build an invoker that already existed) and
`grep -r` against a tree of symlinks (told two teammates the tools were undiscoverable when they
were named in 3 and 4 files).

**The method fix for the recalibrated team: run the thing and read its raw output. Reserve grep
for confirming a positive already seen with your own eyes.**

## Files touched

- none (record only; code is in `61860e5c`)
