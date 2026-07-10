---
name: Executive report made code-enforced + team-reaper idle bug fixed
description: Jonah rejected prompt-ware as "an empty note you'll eventually ignore" - the executive report is being moved INTO the engines (sidecoach monitor renders it; justify-done prints it); dispatched 2 Opus executors; root-caused and durably fixed the team-reaper idle-reaping of active teams
type: project
relates_to: [feedback_executive_report_output_contract.md, reference_cmux_team_init_orphan_bug.md]
---

Collaborator: Jonah. 2026-07-04.

Jonah on the skill-doc contract: "I think this is just an empty note that you'll eventually ignore. I want it a part of Sidecoach and Justify's hard output, no exceptions." Correct per his own zero-failure principle - prose contracts are diligence-dependent. The format moves into code.

## Dispatched (2 opus-executor teammates)
- sc-report: sidecoach-present.js gains renderExecutiveReport() built from the same structured findings the old panel consumed; sidecoach-monitor.js default stdout becomes the executive report, --json carries renderedReport (renderedPanel key removed unless consumers exist); fixture tests assert block headings, table syntax, per-block sentences, single status line; full 65-suite gate.
- jf-report: the justify-done confirmation card becomes the executive block (heading, Selector|Property|Before|After table from JUSTIFY_CHANGES, summary sentences, status line); network behavior untouched; JUSTIFY_DRY_RUN added for offline tests; repo source edited then installed copy synced.
- Lead holds: SKILL.md integration (print the code-rendered report verbatim), Codex review, syncs, beats, teardown.

## Team-reaper bug - root-caused and fixed (Hook Error Protocol)
- Symptom: first jf-report spawn failed team-file-not-found minutes after sc-report spawned fine; the whole team dir was GONE.
- Delta trace: yesterday's repaired team dir (placeholder leadSessionId, inboxes idle overnight) was intact until sc-report booted. Teammate SessionStarts run team-reaper.sh; in session-start mode it reaps any team not owned by the current session whose inboxes are idle >= 30 min OR age >= 12h. The overnight dir was both. sc-report's own SessionStart reaped the ACTIVE lead team out from under it; jf-report then had nothing to join.
- Durable fix: IDLE_MINUTES default raised 30 -> 240 in claude/hooks/team-reaper.sh (live via symlink, immediate, no restart) with a comment recording why: long executor units send no inbox traffic while working; a 30m idle window reaps active teams mid-run. Age-gc at 12h remains the real GC. Env override TEAM_REAP_IDLE_MINUTES unchanged.
- Team dir rebuilt with fresh timestamps and sc-report registered as a member (its completion message would otherwise have failed); jf-report spawned clean; both executors verified running with all three inboxes present.
- Residual harness flaw (noted, not fixed here): the reaper has no liveness check - it cannot tell an idle-but-alive team from a dead one. Proper fix is member-process/pane liveness detection before idle-reap. Candidate T-task.

## jf-report unit ACCEPTED (2026-07-04)
- justify/cli/justify-done.sh: the confirmation card is now the executive report (heading via short_heading(), Selector|Property|Before|After table from JUSTIFY_CHANGES, summary sentences, status line); JUSTIFY_DRY_RUN added for offline tests; new justify/cli/test-justify-done.sh (22 checks green); installed /opt/homebrew/bin copy synced.
- JONAH'S BOUNDARY VERIFIED at diff level: the in-browser Review Changes panel is untouched - the /respond payload construction is byte-equivalent (the executor's summary/status locals are verbatim aliases of e["SUMMARY"]/e["STATUS"]; the removed "hunks" lines were display-only diffnote text; JUSTIFY_DIFF hunk parsing unchanged). The change is purely how things look inside Claude, per his directive.
- Lead polish: short_heading() no longer truncates onto a dangling connective (trims back to a phrase-closing word); re-tested 22/22, resynced installed copy.
- Teammate torn down after acceptance. sc-report (sidecoach renderer) still in flight.
- GOTCHA for future justify-done edits: the script deploys to TWO locations - /opt/homebrew/bin/justify-done AND ~/.claude/justify/justify-done.sh. The lead's post-acceptance polish synced only the first; jf-report caught the stale second copy before stand-down, re-synced, re-ran 22/22. Any source edit must sync BOTH (or run the justify installer). All three verified identical.

## sc-report unit ACCEPTED (2026-07-04) - MISSION COMPLETE
- sidecoach-present.js: renderExecutiveReport() exported (audit -> Finding|Fix tables, build -> Before|After, one #### block per rule/category with a 1-2 sentence mechanical summary, exactly one status line, no chrome/ANSI). Old render() kept exported-dead for minimal diff.
- sidecoach-monitor.js: bare run prints the report; --json carries renderedReport; renderedPanel kept as a compat ALIAS of the same string because sidecoach-postresponse.sh:24 consumes it (the one live consumer found) - the hook now surfaces the report.
- Teammate ran its own Codex rounds (2 findings folded: coveragePartial() dual-signal check downgrading clean-with-partial-coverage to inconclusive; every block now carries a table) + re-review clean.
- Lead: registered the new test in scripts/run-tests.ts (was outside teammate ownership; explicit suite list, not a glob - the gotcha to remember); full suite 66/66 green; bare-run smoke shows the report natively; SKILL.md template now prints renderedReport VERBATIM on text surfaces / visualizer from structured fields on rich (SKILL.md is symlink-live).
- Both engines now render the executive report in code. The format cannot drift by agent inattention: sidecoach output IS renderedReport; justify output IS the justify-done card. Jonah's "hard output, no exceptions" is satisfied mechanically.

Files touched: claude/hooks/team-reaper.sh (idle default + comment); ~/.claude/teams/session-<id>/ rebuilt; justify/cli/justify-done.sh + test-justify-done.sh (NEW) + both deploy copies; sidecoach/bin/{sidecoach-present,sidecoach-monitor}.js; sidecoach/src/__tests__/executive-report.test.ts (NEW); sidecoach/scripts/run-tests.ts (registration); claude/skills/sidecoach/SKILL.md; this beat + MEMORY.md.
