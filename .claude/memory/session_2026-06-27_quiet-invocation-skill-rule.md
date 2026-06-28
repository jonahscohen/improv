---
name: Quiet invocation - skill rule (one command, panel only, no narration/greps)
description: The controllable half of "I just want a simple presentation" - tightened the sidecoach skill with a prominent QUIET INVOCATION rule at the top of Invoking the Engine. Also fixed the stale "staged lens progression" descriptions (the audit panel is a final report now).
type: project
relates_to: [session_2026-06-27_quiet-invocation-honest-answer.md, session_2026-06-27_audit-report-panel-built.md]
---

Collaborator: Jonah. 2026-06-27. The behavioral floor of the "simple presentation" ask.

## WHAT WAS DONE
claude/skills/sidecoach/SKILL.md - added a prominent **QUIET INVOCATION** rule at the TOP of
"Invoking the Engine" (where Claude reads first, not buried in Using Output Correctly):
- Run exactly ONE command (the monitor). No greps, file reads, cat/ls, or exploratory/extra
  calls around it - a normal run is a SINGLE call.
- Print ONLY the panel (renderedPanel) VERBATIM. No JSON, no guidance list, no build report,
  no findings recap.
- Do NOT narrate. No "let me run sidecoach", no play-by-play, no postamble explaining the panel.
- guidance/checklist/buildReport drive YOUR execution silently; never surfaced as prose.
- Honest caveat IN the rule: the single monitor call still renders in the transcript (harness
  behavior, not Claude's to hide); everything AROUND it is Claude's to suppress, and must be.

Also fixed two stale descriptions that still said the audit panel "shows the run progressing
through its lenses (render -> a11y -> taste)" - it is a final REPORT now (verdict, grouped
findings, priority fixes).

## WHAT THIS DOES / DOESN'T DELIVER (per the honest answer)
- DELIVERS: no narration, one quiet command, panel-only output. ~90% of "simple presentation".
- DOES NOT: hide the single tool call itself. That needs a HARNESS/CONFIG change (Claude Code
  output styles to collapse tool rendering, or a surface outside the transcript) - a separate,
  Jonah-involved step, not a prompt rule. Flagged, not faked.

## POSSIBLE FOLLOW-UP (not done)
- The skill invokes via the full `node <path>/sidecoach-monitor.js` line; the installed
  `sidecoach` CLI (~/.local/bin/sidecoach) could make the one visible command tidier IF it
  surfaces the panel. Separate refactor.

## Files touched
- claude/skills/sidecoach/SKILL.md (QUIET INVOCATION rule + report-not-staged descriptions)
</content>
