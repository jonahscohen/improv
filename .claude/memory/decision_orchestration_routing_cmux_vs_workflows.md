---
name: Orchestration routing - cmux teams (panes) vs dynamic workflows
description: Default fan-out routing - in cmux use cmux teams in panes; anywhere else use dynamic workflows; may opt out of teams in cmux case-by-case
type: decision
relates_to: [session_2026-05-28_workflows_vs_agent_teams_guard.md, session_2026-05-27_agent-teams-guard-hook.md, feedback_agent_worktree_isolation_unreliable.md]
---

Collaborator: Jonah. Decided 2026-05-28 after the dynamic-workflows announcement and the agent-teams-guard conflict test.

## Choice made
How to route multi-agent / fan-out work:
- **In cmux** (detected by `CMUX_SOCKET_PATH` set AND `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): default to **cmux teams in panes** - TeamCreate + named Agent teammates, each a visible cmux split with sidebar metadata + notifications.
- **Anywhere else** (no cmux): use **dynamic workflows** (the native `Workflow` tool).
- **Override**: while in cmux, Jonah may opt out of a cmux team for a given task, case-by-case. The opt-out form is a dynamic workflow (which runs cleanly in cmux - it bypasses agent-teams-guard, proven 2026-05-28).

**Operational rule for Claude:** before starting fan-out work, check the two env vars. In cmux -> team flow by default. Not in cmux -> Workflow. If Jonah says "use a workflow for this" while in cmux, honor it (workflows are not blocked by the guard).

**Alternatives considered:**
- All-workflows everywhere: rejected - loses the live cmux pane visibility Jonah values when watching the work happen matters.
- All-teams everywhere: rejected - loses workflow resumability/scale/adversarial-verification and reintroduces the friction hit on 2026-05-28 (worktree no-op, wedged-agent manual recovery, orphan team records).

**Why this one:** the two primitives have different observability/robustness tradeoffs (panes = watch-live; workflows = headless robustness + resume + scale). Routing by venue gives the right model per context: cmux is where Jonah is watching, so panes; elsewhere is headless, so workflows.

**Why no new mechanism is needed:** agent-teams-guard already enforces the cmux->teams default (blocks bare Agent calls, forcing the team flow). Workflows spawn agents via a separate runtime path the guard does not intercept, so they remain available as the opt-out inside cmux with no guard change. The team-reaper (T-0029) cleans up team records; it does not touch workflows.

**Opt-out mechanics (RESOLVED 2026-05-28, Jonah chose A):** opting out of a cmux team while in cmux means **run a dynamic workflow instead** - nothing else. agent-teams-guard is UNCHANGED; plain bare in-process subagents stay BLOCKED in cmux (preserves the "no silent agents in cmux" guarantee). No escape hatch, no session toggle, no code change. The workflow path is the only sanctioned in-cmux opt-out, and it already works (bypasses the guard via the runtime spawn path).

**Revisit when:**
- Dynamic workflows gain a visible-agent / pane mode (then panes-in-cmux could ride on workflows and the two converge).
- cmux teams gain resumability/checkpointing (then the robustness gap that motivates workflows-elsewhere shrinks).
- Jonah finds the venue-based default wrong in practice (e.g. wants workflows as the in-cmux default for heavy fan-out).
