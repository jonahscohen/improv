---
name: Debugging Protocol added to CLAUDE.md
description: New mandatory section in CLAUDE.md telling future-Claude that the first step when something stops working is to trace the delta between last working state and current failure - reproduce success, identify what changed, hypothesize from the delta. Came directly from a real failure in this session where I dove into source code instead of retracing the chat history that would have shown the cache-eviction pattern in 30 seconds.
type: project
---

Collaborator: Jonah Cohen

# What

Added a new top-level section to `claude/CLAUDE.md`: "Debugging Protocol (MANDATORY when something stops working)". Sits between Verification Protocol and Design Work / Oracle. Six numbered steps and a closing paragraph. The core rule:

> When something that was working starts failing, your FIRST debugging step is to identify what changed between the last working state and now. Do not dive into source code, theorize about architecture, or hypothesize about edge cases until you have answered: when did it last work, when did it first fail, and what is different between those two moments?

The concrete five-step trace checklist:
1. State the last known working call/action.
2. State the first failed call/action.
3. List everything that happened between those two points.
4. Propose one or two candidate causes that fit the delta.
5. Test by reproducing the working state's conditions.

# Why

Came from a live mistake earlier in this session. Discord replies started failing mid-conversation. Instead of retracing the chat history (which would have shown immediately that replies worked during active back-and-forth and started failing after a multi-minute idle window), I went straight to reading `server.ts` source, theorizing about multiple bot processes, and looping on marker-write retries. Burned a lot of context and time.

The user redirected me with "retrace your steps... if something was working before and it doesn't work now, why? what's different?" That trace took 30 seconds and identified the cache-eviction-on-idle pattern that source diving had missed.

The user then said: "make this a global rule." Hence this CLAUDE.md addition. The rule applies to every regression, not just Discord, not just plugins.

# How

Inserted as its own H2 section after Verification Protocol (which is also mandatory, also gates work). The Debugging Protocol gates investigation; Verification Protocol gates completion. Structurally they're peers and they share the "do this BEFORE other instincts kick in" character.

The phrasing names the failure mode by name ("source diving without a trace-grounded hypothesis is theorizing, not debugging") so future-Claude can recognize when they're about to do it.

The closing paragraph explicitly enumerates the kinds of failures the rule applies to (tools, tests, builds, network, UI) so it doesn't get filed away as a Discord-specific note.

# Verification

- `grep -c "Debugging Protocol" ~/.claude/CLAUDE.md` returns 1
- The section sits between "If you cannot verify..." and "## Design Work and Oracle"
- Symlinked deployment confirmed: change to `claude/CLAUDE.md` propagated to `~/.claude/CLAUDE.md` automatically

# Files touched

- `claude/CLAUDE.md` (new H2 section: Debugging Protocol)
- `.claude/memory/session_2026-04-30_debugging-protocol-rule.md` (this file)
- `.claude/memory/MEMORY.md` (index entry, next)
