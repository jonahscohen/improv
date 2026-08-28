---
name: interaction model wins over plugin defaults
description: Design-source interaction model overrides a UI plugin's default presentation; side-by-side must cover STRUCTURE, not just per-field styling
type: feedback
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

When building UI from a design source (Figma artboard, screenshot, spec), the interaction model in that source is part of the spec, not a presentation you get to choose. When a UI plugin, form builder, component library, or framework ships a default presentation that diverges from the artboard's interaction model, the artboard wins.

Canonical miss (2026-08-27, ppai / Merch Moves Us project, reported cross-session by ppai-pm at Jonah's instruction): a "Share Your Story" UGC form was built as a Gravity Forms multi-page STEPPER (one page at a time + progress bar) when the Content Hub artboards (node 1725:14235 and siblings) specify an ACCORDION: six section bars stacked and always visible, one open at a time, completing a section collapses it and smooth-scrolls to the next. The build substituted the plugin's default stepper for the artboard's accordion. The spec even said "accordion"; the stepper was the path of least resistance. Jonah: "You ignored the Figma artboards and devised your own presentation. Who gave you that artistic license? Not me."

**Why:** Verification Protocol item 3 ("Side-by-side verification required") listed only per-attribute checks (dimensions, colors, spacing, typography, border radius, states). The overall interaction/structural model was never named, so a side-by-side that passed per-field styling could still ship the wrong structure. The gap was in the rule's coverage, not in one build's diligence.

**How to apply:** Item 3 of the Verification Protocol was amended (2026-08-27, Jonah's direct go-ahead in the improv-pm session). The canonical SOURCE is `claude/RULES.md` in the improv repo (the live `~/.claude/CLAUDE.md` is assembled from `claude/CLAUDE.md` + `claude/RULES.md`); both the live copy and the RULES.md source were edited and the source was committed + pushed to main so teammates inherit it on next pull. The side-by-side is now never per-field styling alone: put the artboard's overall structure and interaction (how sections are grouped, revealed, advanced, collapsed, navigated) next to the rendered build and confirm the STRUCTURE matches before calling done. Placement decision: Jonah chose the global CLAUDE.md rule over scoping it to the sidecoach QA gate, so every project and machine inherits it. A mechanical hook was ruled infeasible here (a hook cannot compare an artboard image to a rendered interaction model); this is a behavioral rule, enforced by the side-by-side step, not a new gate.
