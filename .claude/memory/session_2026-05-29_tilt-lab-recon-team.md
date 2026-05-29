---
name: tilt-lab recon team dispatched + agent-teams self-correction
description: Spawned the tilt-recon team (5 teammates, 10 lane tasks) to fetch verbatim source for tilt-lab's ~25 effects while team-lead builds the foundation inline. Includes self-analysis of initially mis-dispatching via run_in_background instead of the cmux agent-teams flow.
type: feedback
relates_to: [session_2026-05-29_tilt-lab-foundation-plan.md, session_2026-05-29_tilt-lab-brainstorm.md]
---

Collaborator: Jonah. 2026-05-29.

## What was dispatched
Team `tilt-recon` (lead = team-lead, agent_type team-lead). Shared TaskList has 10 lane tasks (Lane 1 regent local; 2 paper.design; 3 spell.sh; 4 cobe; 5 casberry; 6 unlumen cursor-trail; 7 unlumen aurora; 8a + 8b motion-core 6 each; 9 ascii-magic). 5 general-purpose teammates (recon-a..recon-e) each Read docs/superpowers/tilt-lab-recon/RECON-BRIEF.md then claim lowest-ID tasks, write a report per lane, mark complete, claim next. Reports land in docs/superpowers/tilt-lab-recon/lane-*.md. RECON ONLY - no runtime code. They run concurrently while I build the foundation inline (the execution path the user chose).

## SELF-ANALYSIS (mandatory after correction)
FAILURE: My first dispatch used `Agent({run_in_background: true})` for 4 in-process subagents. The harness BLOCKED all 4: this session is inside cmux with agent-teams enabled (CMUX_SOCKET_PATH set, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1), where Agent calls MUST spawn as named teammates (TeamCreate -> Agent with team_name+name -> SendMessage/TaskList coordination -> TeamDelete). User corrected: "cmon, you know better. use agents the way i taught ya."

WHY it happened: I pattern-matched "background recon fan-out" straight to `run_in_background` without first checking the execution environment. The signals I ignored: (1) the env vars in context, (2) a large body of my own beats about the cmux team workflow (T-0021 HUD monitoring pane, team-reaper hook, T-0024 subagent roster, OMC research), all of which presuppose agent-teams. I had the knowledge and skipped the check.

HOW to prevent recurrence (the rule): When this session is inside cmux with agent-teams enabled, ALL multi-agent work goes through the team flow (TeamCreate + named teammates + shared TaskList + SendMessage), NEVER `run_in_background` in-process subagents. Check for CMUX_SOCKET_PATH / CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS before reaching for run_in_background. The harness enforces this with no exemptions (even a single Explore/Plan agent), so default to the team flow here.

## Files
- docs/superpowers/tilt-lab-recon/RECON-BRIEF.md (new, shared contract/posture/format)
- docs/superpowers/tilt-lab-recon/README.md (new)
- 10 lane reports incoming from teammates
