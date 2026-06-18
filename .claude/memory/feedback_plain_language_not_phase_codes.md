---
name: Describe work in plain language for team/external comms - phase codes are internal-only
description: Jonah's directive - internal phase codenames (P4b-2, P4d, P4f, "lane", "collector", "MCP") mean nothing to the team; when reporting what shipped/works, give a plain-English capability description a non-engineer teammate would understand, not the codename
type: feedback
---

Jonah (2026-06-15): "nobody's gonna know what p4b-2 is, like i'm just supposed to
be like 'hey team uhhhh p4b-2 is working'".

**Why:** phase codenames (P1/P2/P4a/P4b-1/P4b-2/P4c/P4d/P4f), and even our working
vocabulary ("lane", "validator", "collector", "MCP", "outbox"), are internal
shorthand for OUR memory/coordination. To the team they are noise. Reporting "P4b-2
is working" gives a teammate nothing actionable.

**How to apply:** when summarizing what shipped/works for the user to relay (or any
team/external audience), lead with a PLAIN-ENGLISH capability sentence - what a
person can now DO and why it matters - not the codename. Keep the codename only as a
parenthetical for our own traceability if useful. Define any necessary term once, in
plain words. Offer the honest-caveat version separately if they're making a careful
announcement.

Plain-language glossary for the lane work (use these, not the codes):
- "lanes" / the whole feature = "ask Claude in plain language to run a design task,
  and it runs it step by step and checks the result."
- P1 = it understands which kind of design task you mean from plain language.
- P2/P4c = the task actually runs, step by step, and can loop until the checks pass.
- P4a = it checks the work against quality rules (polish, accessibility, theming,
  common mistakes).
- P4b-1/P4f = it won't lose or double-apply work if something crashes; it records
  what each step did.
- P4d = all of this is available to Claude as tools it can use in any chat (not just
  the command line).
- P4b-2 = it can open your ACTUAL rendered page in a real browser and catch real
  problems (unreadable contrast, too-small tap targets, inconsistent rounding/
  spacing) - and that browser check runs server-side so it works on phone/desktop/
  IDE, not just CLI.

Collaborator: Jonah.
