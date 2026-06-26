---
name: cmux-teams teammate PANES never confirmed working here - 2 failed spawns + root-cause investigation
description: Two Agent spawns for the sidecoach-ref-integration teammate both returned async "running via mailbox" and rendered NO visible cmux split. Investigation shows the env is a correct cmux claude-teams session (TMUX/TMUX_PANE/socket/teams-flag all set, shim works, docs say teammates should split) yet no split appears - and the prior 2026-06-22 deploy was ALSO never pane-confirmed. The agent-teams-guard hook asserts "name = visible split" as fact, which is unverified and currently false; that false confidence is the hook bug Jonah asked me to correct.
type: project
relates_to: [session_2026-06-23_sidecoach-reference-integration-plan.md, session_2026-06-22_sidecoach-reference-integration-deploy.md, session_2026-06-22_cmux-teams-break-and-guard-fix.md]
superseded_by: session_2026-06-23_cmux-teammate-pane-FIX.md
---

> NOTE: This beat's conclusion ("harness bug, panes can't work here, do it inline") was OVERTURNED the same day. Root cause was found and FIXED - see [[session_2026-06-23_cmux-teammate-pane-FIX.md]]. The investigation below is still accurate; only the "give up on panes" conclusion is wrong.

Collaborator: Jonah Cohen

## What happened (the failure)
Picking up the sidecoach reference-integration handoff, Jonah chose "teammate in a new pane" + full A+B+C scope. I spawned the teammate twice; Jonah stopped both, each time saying it did NOT appear in a new pane.
- Attempt 1: `Agent({subagent_type:general-purpose, name:"sidecoach-ref-integrator", mode:"plan", run_in_background:true, prompt})`. Wrong: run_in_background:true makes an invisible background subagent. I overrode the plan beat's explicit "foreground (NOT run_in_background - Jonah wants a visible pane)" note on a theory that background was needed for the teammate to SendMessage "main". Traded away the exact thing Jonah asked for.
- Attempt 2: `Agent({subagent_type:general-purpose, name:"sidecoach-ref-integrator", prompt})` - foreground, named, no mode. STILL returned `Spawned successfully ... now running via mailbox` (an ASYNC teammate) and STILL no pane.

## SELF-ANALYSIS (why/how)
- Why attempt 1 went wrong: I let a mechanical theory (SendMessage to "main" is background-only) override an explicit, twice-stated instruction (plan beat + Jonah's choice) that the teammate must be a visible pane. Pane visibility comes from the cmux split, not from the messaging mode. I prioritized my own reasoning over the documented want.
- Why attempt 2 still failed: I assumed (per the guard hook's own claim) that a NAMED spawn is sufficient to produce a split. It is not - both spawns were named and neither split.
- The deeper miss: I never had VERIFICATION that a teammate pane works here. I treated "spawn returned success" as "pane appeared." Classic false-positive (Verification Protocol #6).

## Investigation (engine truth)
- Session IS a real cmux claude-teams session: `CMUX_AGENT_LAUNCH_KIND=claudeTeams`; launch argv decodes to `cmux claude-teams --teammate-mode auto --dangerously-skip-permissions`.
- All env the shim needs is present: `TMUX=/tmp/cmux-claude-teams/<ws>,<surface>,<pane>`, `TMUX_PANE=%6849280920743803951`, `CMUX_SOCKET_PATH` set, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- The shim is `~/.cmuxterm/claude-teams-bin/tmux` -> `exec cmux __tmux-compat "$@"`. cmux help confirms: "sets a tmux-like environment so Claude auto mode uses cmux splits"; "split-window -> splits current pane". tmux commands DO translate (display-message/list-panes return real cmux pane ids).
- cmux docs (https://cmux.com/docs/agent-integrations/claude-code-teams): "When Claude spawns teammate agents, they render as native cmux splits." Required env: TMUX, TMUX_PANE, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, CMUX_SOCKET_PATH - all present here.
- Net: the spawn params were correct (named teammate) and the env is correct, yet NO split rendered. The harness spawned async mailbox teammates without ever emitting/realizing a cmux split.

## The reframe that matters
Re-reading session_2026-06-22_sidecoach-reference-integration-deploy.md: that teammate spawn was ALSO never pane-confirmed - its own self-analysis says "did not confirm the teammate surfaced as a watchable cmux pane." So across the prior session AND both of today's attempts, a visible cmux teammate pane has NEVER been empirically verified in this project. "cmux teams = panes" has been an assumption sourced from the cmux docs + the launcher's prompt string ("teammate agents appear as cmux splits"), not from an observed split.

## The hook bug Jonah asked me to correct
`claude/hooks/agent-teams-guard.sh` asserts as fact: "name ... is what makes a teammate appear as a visible cmux split" and PASSES any Agent call that has a `name`. That claim is unverified and, in current practice, false (named spawns are not splitting). So the guard gives false confidence and cannot prevent the no-pane outcome, because the failure is NOT in the Agent params the guard inspects. Correcting it requires first determining what actually produces a split here (or whether it's a harness/cmux-version integration gap) - do NOT encode another unverified theory into the hook.

## ROOT CAUSE CONFIRMED (controlled probe test, 2026-06-23)
Ran a one-shot `pane-probe` teammate (named, foreground, no mode, no run_in_background - the textbook-correct form) with baseline-vs-after pane capture. Decisive results:
1. NO teammate process exists. `ps aux | grep claude` shows ONLY the main session (PID 72155, `claude --teammate-mode auto`). The probe teammate never launched as a process.
2. The assigned pane is PHANTOM. `~/.claude/teams/session-14672cde/config.json` registered `pane-probe` with `"backendType":"tmux"` and `"tmuxPaneId":"%6467687314442696516"` - but that pane id exists NOWHERE in cmux (`tmux list-panes -a` shows only my %6849 + %5046), no new surface appeared (`cmux list-panels` unchanged at 3 surfaces), and the teammate's inbox message is still `"read":false`. Registered, never run.
3. The SHIM WORKS. Direct test `tmux split-window -d -P -F '#{pane_id}'` -> exit 0, created real cmux pane `%7728062408192848507` (visible in list-panes), which I then killed. So cmux `__tmux-compat` split creation is fully functional on demand.

CONCLUSION: This is a Claude Code agent-teams HARNESS bug (or version mismatch with cmux's tmux-compat protocol). The harness registers a `backendType:"tmux"` teammate with a fabricated tmuxPaneId but never invokes the shim to realize the pane and never launches the teammate process. NOT my Agent params (named/foreground were correct), NOT the shim (proven working), NOT the env (TMUX/TMUX_PANE/socket/flag all correct). This retroactively explains the 2026-06-22 "black box": that teammate was phantom-registered and never ran - the missing reporting contract was a red herring; the teammate never executed.

Corollary: in THIS environment you cannot have a teammate that is BOTH visible (pane) AND running. The tmux backend (visible) is broken so the teammate never runs; only `run_in_background:true` actually runs a teammate (in-process within PID 72155) but it is invisible (no pane). So for real visible-and-running work the answer is INLINE (main thread), not a teammate.

## Hook correction made (2026-06-23)
`claude/hooks/agent-teams-guard.sh` corrected: (1) removed the false "name is what makes a teammate a visible cmux split" assertion - replaced with accurate language; (2) added a DENY on `run_in_background:true` in cmux-teams mode (would have caught attempt 1 - background = invisible, never a pane); (3) the pass path now injects a KNOWN-ISSUE warning that tmux-backend teammate panes do not currently render / launch in this env, so future sessions VERIFY a real pane+process before relying on a teammate, or work inline. Tested the hook with sample JSON inputs.

## Files
- .claude/memory/session_2026-06-23_cmux-teammate-pane-never-confirmed.md (this)
- claude/hooks/agent-teams-guard.sh (corrected - see above)
- The 4 milestone tasks (#1-4) for the integration work remain pending/unstarted (pending Jonah's call on inline vs. hold).
