---
name: All four units committed by someone outside the team, plus a second unclaimed high-quality change
description: Two commits landed at 07:23 containing every teammate's work and the lead's CLAUDE.md edit, though the lead never authorized a commit and every teammate was told not to. A justify/install.sh guard also appeared that no teammate touched. Everything is green; the authorship is unresolved.
type: project
relates_to: [session_2026-07-27_unattributed-writer-investigation.md, session_2026-07-27_ampersand-selfheal-fix.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: git log and git show inspected directly; .git/hooks confirmed to hold no active hook; gate suites re-run green after the commit
confidence: high
---

# Two commits nobody on the team made (2026-07-27)

## What landed

    14145511  07:23:45  Ship ampersand shim and parity hardening    26 files, +5400 -744
    7269fbfb  07:23:50  Update test-settings-deploy-parity.sh        1 file,  +15 -1

`14145511` contains **everything**: all four teammates' units (agent-teams-guard and its
suite, route-intent.json and its suite, test-bin-parity, test-settings-wire-parity,
test-ampersand-shim, test-hook-data-parity, install.sh, browser-tree.json,
hook-registry-guard, hook-registry-stop, bin/ampersand), every beat written this session,
and the lead's `claude/CLAUDE.md` Teammate Spawn Shape edit.

The lead never authorized a commit and never ran one. Every teammate brief said "Do not
commit," and all four reported "No commit" in their final messages. `.git/hooks` holds no
active hook, so this was not automation in the repo. Every commit in this repo carries
`Jonah` as author because that is the git config, so authorship in the log proves nothing
about which process ran the command.

## The second unclaimed change

`justify/install.sh` (+45 -9, uncommitted) gained a guard preventing a run with `$HOME`
redirected into a temp tree from planting symlinks into a SHARED bin, where the links
outlive their targets and every `justify-done` becomes "command not found" - surfacing to
the user as a Justify panel hung on "Working..." forever. Its comment cites "Observed
2026-07-16: eight of ten shims dead this way."

No teammate was assigned that file, none claimed it, and it is not adjacent to any brief.
It is careful, correctly reasoned, and cites a historical observation - the same signature
as the earlier unattributed writes.

## Standing state - everything is green

Verified after the commit: `test-bin-parity` exit 0, `test-settings-wire-parity` exit 0.
Those two are the acceptance gate precisely because no unit under review wrote them.
Nothing has been lost, and the pre-reconciliation snapshot at
`scratchpad/tree-snapshot-064720/` still holds the full pre-commit state.

## Assessment

The most plausible explanation is a human or a session at the terminal surface
(`surface:58 "improv main"`, open alongside this session the whole time) doing exactly what
an owner is entitled to do in their own repo: reviewing, improving, and committing. That
requires no anomaly at all. The earlier forensics support it - transcript scans found no
agent tool call authoring those files, and the fingerprint test over a seven-minute quiet
window showed no drift, meaning the writer works in bursts rather than continuously.

What is NOT supported is the "third teammate" theory: `cmux list-panels` in the contested
window showed four surfaces and exactly two executors, and those two were `ampersand` and
`coverage`.

**Left open deliberately.** The lead escalated rather than continuing to dig or reverting
anything. Reverting another author's commit on suspicion would be far more destructive than
the ambiguity itself, and every unit in it is independently verified green.

## Files touched

- none (investigation only; the commits were not made by this session)
