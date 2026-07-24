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

## AMENDMENT 2026-07-23: step 2 can silently fail on long-running teammates

Step 2 above (the sanctioned `shutdown_request`) is NOT reliable, and the failure is silent rather
than an error. Observed on a 4-teammate session (Jonah, 2026-07-23):

- The two SHORT-lived teammates (~23 min) both replied `shutdown_approved` within seconds and their
  processes and panes disappeared cleanly. Step 2 works exactly as documented for these.
- The two LONG-lived teammates (~1h50m) ignored the request entirely - `verify-hook` once,
  `cmux-guard` three times. Neither ever emitted `shutdown_approved` or errored. Each simply
  returned another `idle_notification` with `idleReason: "available"`, i.e. they were still
  processing their mailbox and going idle again, not wedged or crashed.

Net: the request was received and dropped. Because the only feedback is an idle notification that
looks identical to normal parking, a lead can sit waiting on a teardown that will never arrive
while the teammate emits exactly the notification noise this rule exists to stop.

**Amended step 3 (escalation):** if a teammate does not emit `shutdown_approved` after ~2 requests,
stop re-sending - it is being dropped, not queued. Confirm the unit is genuinely closed (work
accepted, beats written, file changes accounted for in the working tree), then kill the pid
directly: `kill <pid>`, and verify with `ps` and `cmux list-panels`. Verified 2026-07-23 - both
processes exited immediately and cmux removed both panes automatically, same as the clean path.

**Ask first.** Force-killing is irreversible and it is the user's machine, so put it to them rather
than doing it unilaterally - unless they have already told you to tear down. Confirming there is no
unsaved work FIRST is what makes the kill safe: in this session every file change was already in
the working-tree diff and every beat was written, so nothing was lost.

**Correlation worth testing, not yet proven:** the split was cleanly along session age (23 min
approved, 1h50m did not). Possible causes include mailbox backlog or a degraded protocol handler
late in a long session. Not root-caused - the lead chose to kill rather than preserve the live repro
(Jonah's call). If it recurs, the repro is a teammate left running past ~1h.

## Files touched
- .claude/memory/feedback_cmux_teardown_dead_subagents.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
- claude/CLAUDE.md (Teammate Teardown team-rule section)
