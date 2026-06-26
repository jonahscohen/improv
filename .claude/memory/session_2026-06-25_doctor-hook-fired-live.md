---
name: doctor-hook-fired-live
description: The codex-failure-watcher hook FIRED LIVE this session (exact additionalContext injected) - so the live ~/.claude/settings.json edit activated WITHOUT a restart (corrects the earlier "restart needed" claim). It over-fires slightly on codex-log monitoring greps (worth tightening). It correctly surfaced a transient codex MCP transport error during the v2 labeling, which the harness --resume retries.
type: reference
relates_to: [session_2026-06-25_doctor-live-settings-activation.md, session_2026-06-25_doctor-hooks-verified.md, session_2026-06-25_buzzword-v2-labeling.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## VALIDATION: the cure is LIVE (no restart needed)
The codex-failure-watcher PostToolUse hook injected its exact directive text during a monitoring Bash call = it is ACTIVE in the current session. So editing the live ~/.claude/settings.json took effect IMMEDIATELY (the harness re-reads it per-invocation, OR cmux teams reload hooks) - CORRECTS my earlier "needs a session restart" statement. The codex-rescue-guard (same settings file) is very likely live too.

## WATCHER OVER-FIRE (minor, worth tightening later)
It tripped on `grep ... labeling.log + ps ... codex exec` - a MONITORING command that merely MENTIONS codex and whose OUTPUT contained an error string, not an actual `codex exec` invocation. Harmless (just an injected directive) but a false positive. Tightening: trip only when the COMMAND actually invokes codex (e.g. `codex exec`/`codex review` as a leading token), not when it greps codex logs. Filed for a future refinement of codex-failure-watcher.sh.

## THE REAL SIGNAL (what it caught)
The v2 labeling (dev-subjective-label.mjs) hit a transient codex MCP transport error on one page (rmcp worker quit, http/request failed to 127.0.0.1:29979/mcp), then recovered (labeled airtable right after). TREATMENT here = the harness's built-in bounded-exec + --resume retry (NOT a leaner-prompt re-run; this is the labeling harness, not a review). I will --resume any failed pages after the run.

## Files touched
- (reference beat; no code - validation + over-fire note)
</content>
