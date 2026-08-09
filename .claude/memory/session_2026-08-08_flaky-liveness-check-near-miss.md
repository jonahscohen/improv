---
name: Per-agent ps liveness grep gives FALSE NEGATIVES; use the broad form only
description: While coordinating teammates as PM, a per-agent `ps -Ao pid,command | grep 'claude.exe --agent-id <name>'` liveness check repeatedly reported live workers (clearfix, codexwrap, livecheck) as "gone" when the reliable broad grep showed them ALIVE. Nearly concluded the active urgent clearfix worker was dead. No harm - always re-verified with the broad form before acting. Lesson: never trust the per-agent grep for liveness; use the broad `... grep 'claude.exe --agent-id' | grep -v grep` the teardown protocol already specifies, and kill only PIDs read from THAT list.
type: feedback
relates_to: [session_2026-07-27_teammate-panes-in-process-fallback.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: observed live (broad grep found workers the per-agent grep missed)
confidence: high
---

Collaborator: Jonah. Self-analysis per the mandatory protocol after a near-miss.

## What happened
Coordinating five teammates as improv-pm, I checked teammate liveness with a per-agent loop: `ps -Ao pid,command | grep "claude.exe --agent-id $a" | grep -v grep`. It returned "gone" for clearfix, livecheck, and codexwrap in one pass, and "clearfix GONE" in another - every time, the RELIABLE broad grep (`ps -Ao pid,command | grep 'claude.exe --agent-id' | grep -v grep`) immediately showed those same agents ALIVE with real PIDs. clearfix (the URGENT clear-all fixer) was falsely reported dead twice while it was actively working (uncommitted ws-server.ts + test changes + a new beat).

## Why it happened (root cause)
The per-agent single-name grep is unreliable for these processes - almost certainly `ps` command-field truncation of the enormous inline `--settings` blob (the cmux launch passes a multi-kB settings JSON on argv), so `claude.exe ... --agent-id <name>` does not consistently survive in the captured field for a name-specific match, plus snapshot timing. The broad grep matches the shorter, earlier `--agent-id` token and survives.

## The rule (reinforced - CLAUDE.md teardown protocol already says this)
- Liveness / identification ALWAYS via the broad form: `ps -Ao pid,command | grep 'claude.exe --agent-id' | grep -v grep`, then read the specific name+PID from that output. NEVER conclude an agent is dead from a per-agent `grep '<name>'`.
- Before killing, take the PID from the broad list, confirm it is your named target and NOT a justify process, then kill. A false-negative liveness read must never trigger a kill or a "the worker died" conclusion.
- No harm this time only because I re-verified with the broad grep before acting on every false negative. The failure mode to prevent: acting (killing by elimination, re-dispatching a live unit, or telling the user a worker died) on the per-agent grep's word.

## Files
- this beat + MEMORY.md pointer (no code change; operational discipline)
