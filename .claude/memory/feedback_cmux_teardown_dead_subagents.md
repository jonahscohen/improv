---
name: cmux teardown rule - kill fully stood-down subagents and close their panes
description: Jonah (2026-07-02) - in cmux, once a subagent is ABSOLUTELY done and fully stood down, kill it and close its pane; do not leave idle teammates parked. Mechanism verified live on @compiler.
type: feedback
relates_to: [feedback_fable_orchestrator_opus_codex_executors.md]
---

Collaborator: Jonah Cohen. 2026-07-02, after the stage-2 compiler teammate kept emitting idle notifications post-stand-down.

Directive: when working in cmux and a subagent is absolutely done (unit accepted, stood down, no further tasking), kill the subagent and close its pane. An idle parked teammate is not a resource worth keeping around once its unit is closed.

**Why:** idle teammates emit recurring idle notifications (noise in the lead session), hold a cmux pane, and keep a claude.exe process alive (memory + potential cost). "Available for fresh dispatch" is not a reason to keep one warm - fresh dispatches get fresh contexts anyway (the lead's own re-dispatch pattern).

**How to apply (verified live on @compiler):**
1. Confirm the unit is fully closed first (accepted, committed, teammate acknowledged stand-down). Do not kill a teammate that may still need to relay results.
2. Send the sanctioned kill: SendMessage with `{"type": "shutdown_request", "reason": ...}`. The teammate approves and its process terminates. (Originating shutdown_request is allowed here because Jonah's standing rule IS the ask.)
3. cmux closes the agent surface automatically when the session ends - verified: after the compiler's process exited, `cmux list-panels` showed only the lead surface. If a pane ever lingers, `cmux close-surface --surface surface:<N>`.
4. Verify: `ps -p <pid>` exited + pane gone from `cmux list-panels`.

**Permanence (2026-07-02, same day):** Jonah followed up with "Make sure that's part of our process permanently." Encoded as a team rule: new "Teammate Teardown (cmux subagent lifecycle - MANDATORY)" section in claude/CLAUDE.md (the ~/.claude/CLAUDE.md symlink target), so it propagates to every machine on pull per the Team Rules header. This beat remains the origin record; the CLAUDE.md section is the enforced rule.

## Files touched
- .claude/memory/feedback_cmux_teardown_dead_subagents.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
- claude/CLAUDE.md (Teammate Teardown team-rule section)
