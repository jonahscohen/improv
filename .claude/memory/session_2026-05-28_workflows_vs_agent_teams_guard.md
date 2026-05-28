---
name: Native workflows do NOT trigger agent-teams-guard - no conflict
description: Empirical test - native dynamic-workflow subagents bypass the Agent PreToolUse hook, so agent-teams-guard does not interfere with workflows even in cmux-teams mode
type: project
relates_to: [session_2026-05-27_agent-teams-guard-hook.md, feedback_agent_worktree_isolation_unreliable.md]
---

Collaborator: Jonah. Tested 2026-05-28 after the dynamic-workflows announcement (https://code.claude.com/docs/en/workflows).

## Question
Dynamic workflows (the native `Workflow` tool) spawn dozens-hundreds of subagents. The dotfiles run `agent-teams-guard.sh` as a PreToolUse hook on the `Agent` matcher that, in cmux-teams mode, DENIES any Agent call lacking `team_name`/`name`. Worry: would the guard block native workflow subagents and break the feature?

## Method
1. Confirmed THIS session is in cmux-teams mode: `CMUX_SOCKET_PATH` set AND `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. So the guard is ACTIVE here.
2. Deterministic: piped a workflow-style Agent payload (subagent_type, no team_name/name) to the guard -> `permissionDecision: deny`. A proper teammate payload (with team_name+name) -> `{}` allow. So the guard DOES block bare Agent calls in this session.
3. Empirical: added a temp probe to the guard logging every firing to /tmp/atg-probe.log, then ran a minimal 2-agent `Workflow` (each agent: "reply READY").

## Result
- Workflow COMPLETED: `agentCount: 2, results: ["READY","READY"]`, 2 agents, 2.5s, 83k subagent tokens, 0 tool_uses.
- Probe log stayed EMPTY the entire run. The guard NEVER fired for the workflow's agents.
- Control: a direct Agent-tool payload fired the probe immediately, proving the probe works and the guard is live.
- Then reverted the probe (git checkout), guard back to committed state.

## Conclusion
**Native workflow subagents do NOT route through the `Agent` PreToolUse hook.** The workflow runtime spawns agents via a separate path the dotfiles hooks do not intercept. So `agent-teams-guard` governs only the main-loop `Agent` tool (manual teammate spawning); it does NOT interfere with native workflows - even in cmux-teams mode with the guard active. The feared conflict does not exist.

Caveat scope: this tested the `Agent` PreToolUse matcher specifically. PreToolUse guards on the TOOLS workflow agents call (bash-guard, content-guard via Bash/Write/Edit matchers) are a separate question - the docs say workflow agents inherit the tool allowlist, so those guards likely DO fire inside workflow agents (which is desirable - our safety rails extend into workflows). Not tested here; worth a follow-up if a workflow agent ever hits an unexpected block.

## Implication for the workflows-vs-dotfiles assessment
Removes the one concrete BREAKAGE risk. The dotfiles + native workflows coexist cleanly. Remaining workflow-related items are pure strategy, not breakage: (a) prefer workflows over manual TeamCreate+Agent for fan-out work, (b) optionally re-platform reflect / design-team / sidecoach composite flows onto workflow scripts, (c) the manual-team scaffolding (claude-teams-launcher, agent-teams-guard, team-reaper) stays valid for the cmux-teammate model and does no harm to workflows.
