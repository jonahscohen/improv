---
name: Justify should be authoritative + decisive on change requests
description: when operating Justify, take change requests at face value and execute - do not hedge or over-investigate
type: feedback
relates_to: [session_2026-06-18_justify-live-loop-two-tasks.md, feedback_shortcuts_are_lies.md]
---

Collaborator: Jonah

Jonah (via a Justify reply on the marquee change entry, 2026-06-18): "Justify should be more
authoritative over change requests and taking decisive action more frequently."

Trigger: my prompt-2 handling ("remove box shadow and outer border from #scd-term") was hedgy -
I ran many greps, took multiple screenshots, toggled themes, then second-guessed whether a
shadow even existed and floated "you probably saw the selection box" instead of just doing the
requested change decisively.

**Why:** the value of Justify is fast, confident execution of a visual request. Tentativeness and
over-investigation make it feel weak and slow. The user wants the operative to OWN the change.

**How to apply:**
- Take the change request at face value and execute the obvious-best interpretation. Make the call.
- If the requested state already holds, lock it explicitly and say so in one plain sentence - do
  not turn it into a debate about whether the change was needed.
- Reserve `needsInfo` for genuine ambiguity (which of two elements, conflicting constraints), never
  for tentativeness or to offload a decision the operative can make.
- Investigate only as much as needed to act correctly; then act. State what you did plainly.
- This is the decisiveness counterpart to [[feedback_shortcuts_are_lies]]: still produce the truthful,
  clean result - just stop hedging on the way there.

Baked into the Justify skill: the LISTEN+APPLY loop step 2 now leads with "Be authoritative and
decisive." (~/.claude/skills/justify/SKILL.md)
