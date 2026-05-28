---
name: commit batching (2026-05-28)
description: Five-commit split for the full session's work; documented here so future sessions can find the boundaries in git log
type: project
relates_to: [session_2026-05-28_omc-research-synthesis.md, session_2026-05-27_checkpoint_before_cmux_teams_relaunch.md]
---

Collaborator: Jonah

Jonah asked to commit everything. AskUserQuestion answered "Multiple topic commits." Plan:

1. `chore(rename): improv -> endow cleanup + marketing-site logo/font swap` - R100 renames of improv/ -> endow/, marketing-site visual updates, public/endow-core.js
2. `feat(hooks): agent-teams-guard + beats discipline rename + hook fixes (T-0002..T-0005, T-0017)` - new agent-teams-guard.sh + hook fixes + CLAUDE.md Beats Discipline + tightened question-asking + settings.json
3. `feat(sidecoach): OMC-derived roadmap (T-0008..T-0013)` - keyword hook + retry control + cheatsheet + modes + model-routing + benchmark harness
4. `feat(sidecoach): side observations (T-0015 flow cull, T-0016 bench ledger wire, T-0018 hardened MCP server)` - flow cull 38->26, live ledger detection, full MCP server
5. `chore(memory): session beats + MEMORY.md sweep + TASKS.md updates` - all memory beats from 2026-05-26 through 2026-05-28, MEMORY.md index entries, TASKS.md changes (T-0006 through T-0018)

Files touched: ~377 total. Multi-topic split keeps history bisectable.

## Progress

- Commit 1 landed: improv -> endow rename + marketing-site visual swap (122 files, R100 rename detection).
- Commit 2 landed: agent-teams-guard + beats discipline rename + hook fixes T-0002..T-0005, T-0017 (16 files, +1311/-189).
- Commit 3 in progress: sidecoach roadmap T-0008..T-0013 (94 files staged).
- Commit 3 landed: sidecoach roadmap T-0008..T-0013 (94 files). Visual verification: /tmp/cheatsheet-commit-verify.png read in-band.
- Commit 4 next: T-0015 flow cull + T-0016 t16-bench-ledger.test + T-0018 hardened MCP server + sidecoach/dist rebuild.
- Commit 4 landed: T-0015 + T-0016 + T-0018 + dist + mcp-server node_modules (~4166 files).
- Commit 5 next: TASKS.md + MEMORY.md + sidecoach_followup_queue.md + ~35 session beats.
