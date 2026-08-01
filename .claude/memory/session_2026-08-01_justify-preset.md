---
name: A justify preset ships Justify with the guards that make it trustworthy - and a wrong fix the browser test caught
description: --only justify already worked and was self-contained. Added --preset justify = justify + memory + safety + verification + grounding, routed through apply_only so it fails loudly on drift. Also records a wrong diagnosis I shipped and had to revert.
type: decision
relates_to: [session_2026-08-01_justify-only-install-measured.md, session_2026-08-01_sidecoach-hooks-installed-but-unwired.md]
supersedes: session_2026-08-01_justify-only-install-measured.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: preset run end to end under a redirected HOME (exit 0, 40 registrations, 3500 files, nothing escaping); 19-case suite added with a mutation control; component-browser caught the wrong fix and is back at 147/0
confidence: high
---

# --preset justify (2026-08-01)

Commit stamp at authoring: 2f6e7a84.

Jonah's boss wants to work with Justify alone. `--only justify` already did that - measured, exit
0, self-contained, 3499 files. What it could not express was "Justify plus the supporting cast
that makes it good".

    ./install.sh --preset justify --yes
      justify       the tool, its hooks, MCP server, skill, CLI shims
      memory        beats - the change-by-change record of what the worker changed
      safety        bash-guard, content-guard, destructive-ops
      verification  verify-before-done, second-fix-gate, screenshot mandate
      grounding     read the code before probing the app

Measured: exit 0, zero errors, **40 hook registrations**, 3500 files, nothing outside the
redirected HOME.

**Why these five.** The worker is a real headless Claude running `--permission-mode
bypassPermissions` against someone's repo. Safety and verification are the floor, not a nicety.
Beats give the reviewable record. Sidecoach is deliberately absent until it is ready to be the
taste layer - a second unfamiliar system on day one is a cost, not a feature.

**Built on what exists.** `--preset` and comma-separated `--only` were already there, and the
QA-hook clusters are already component keys. So the preset is one `apply_only` call, not new
machinery. Routing it through `apply_only` means a renamed key aborts loudly through the existing
"Unknown component" path rather than silently installing less than promised. That property has its
own test.

## A WRONG FIX I SHIPPED, AND WHAT CAUGHT IT

I reported that `justify-queue-mandate.sh` "shipped nowhere" and wired it into
`app-wirings.json` plus the `picked justify && install_app_hooks` line. **That was wrong.** It is
a `grounding` CLUSTER hook - already in `cluster_hooks grounding`, already in
`cluster-wirings.json` with SessionStart and UserPromptSubmit. It ships correctly; it simply is
not part of the bare `justify` component, which is why `--only justify` lacked it and why this
machine has it (grounding is installed here).

My change created dual ownership and a duplicate wiring. `test-component-browser.sh` went 147/0
to 145/2 and named it exactly: "installer and tree agree on every app hook (both directions)" and
"hook filenames are owner-unique". That test's own comment says it is the test that should have
caught the sidecoach gap and did not, so it was strengthened for precisely this class - and then
caught me.

Reverted both edits. Suites back to 147/0, and the preset still delivers queue-mandate through the
correct path because it includes `grounding`: deployed, 2 registrations.

**The lesson, and it is the same one as this morning:** I saw a hook absent from one install and
concluded it shipped nowhere, without checking the OTHER shipping path. One measurement of one
route is not an inventory. The commit message on `2f6e7a84` overstates the defect; this corrects it.

## A second-order note on the guard that blocked the commit

The beats-dirty guard is a PreToolUse hook, so it blocks the ENTIRE bash call before any of it
runs. Writing the beat with a heredoc in the same command as the `git commit` therefore never
writes the beat - the guard rejects the whole thing. The beat has to be written by a separate
tool call first. Worth knowing; it looked like the write had silently failed.

## Files touched

- `install.sh` (justify preset in `apply_preset`, help text in two places)
- `claude/hooks/test-install-preset-justify.sh` (new, 19 cases)
