---
name: endow.html copy rewrite - improv vocab + factually correct tool description
description: Rewrote the endow marketing page after Jonah corrected my mental model. Endow is a microadjustment toolbar with prompt mode + manipulate mode that queues offers for Claude to apply in the background. Not a live editor. Added Coming Soon section for offers mode + sidecoach integration.
type: project
relates_to: [session_2026-05-26_improv_to_offers_rename.md, decision_improv_renamed_to_endow.md]
---

**What I had wrong:** Previous copy said endow "watches your live UI while you change it" with "Pending changes preview live", "Direct manipulation, not synthesized clicks", "two-pane mode pairs a live preview with a property inspector". That was the wrong mental model - the previous improv tool maybe worked that way, but endow doesn't.

**What endow actually is** (per Jonah 2026-05-26):
- A toolbar (not a two-pane editor)
- Has two modes: **prompt mode** (type freeform offers) and **manipulate mode** (point-and-shoot property changes)
- A microadjustment vehicle
- Changes are QUEUED, not applied live
- Claude takes the queue and works in the background
- Browser refreshes when the whole scene is done

**Coming soon (added new section to page):**
1. **Offers mode** - ask Claude for 3 variations of an element, pick the one that lands
2. **Sidecoach integration** - stack offers using sidecoach verbs (`/bolder`, `/quieter`, `/polish`) for flow-oriented tasking

**Improv vocab woven in (subtle, not every sentence):**
- Hero: "endow", "offer", "scene" as the three nouns
- Section 2 title: "Two modes. One queue. One scene."
- Section 4 (Coming soon) title: "Two heightenings on the way." + lede mentions "first beat"
- "Lands the scene" used in feature row body
- Did NOT overdo it - the page reads as straight product copy that happens to use improv-flavored verbs

**Hook false-positive flagged on previous turn:** the multiple-choice violation hook fired on my completion report where I described two bugs I'd fixed and listed three follow-up action items. Neither were options for Jonah to pick between. The hook can't distinguish status reports + action lists from genuine forks. Flagged plainly per the hook's own carve-out.

**Files touched:**
- `marketing-site/endow.html` - title, meta description, hero, section 2 (What it does), section 3 (How to start), NEW section 4 (Coming soon), section 5 (Posture/refuses to do)

**Pending verification:** screenshot of the updated page in browser before reporting done.
