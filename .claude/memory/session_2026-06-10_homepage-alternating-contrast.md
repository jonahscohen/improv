---
name: Homepage alternating contrast system (base/flipped, green-gray + cream-white)
description: Strict section alternation per Jonah - light theme L/D/L/D with darks cycling ink-green and near-black gray; dark theme D/L/D/L with lights cycling cream and pure white; surface-contrast token resolution REVERSED from its first definition
type: project
superseded_by: session_2026-06-11_shade-alternation-system.md
relates_to: [session_2026-06-10_background-3-contrast-surface.md]
supersedes: session_2026-06-10_background-3-contrast-surface.md
---

Collaborator: Jonah. 2026-06-10. "The homepage should alternate background contrasts... light starts light, then dark... darks alternate dark green and dark gray. Homepage dark starts dark, then light... lights alternate cream and white."

**Token reversal:** --surface-contrast is now #1A1A1A in light theme / #FFFFFF in dark (the OPPOSITE of its first definition an hour earlier) - the alternation spec requires the gray to serve light mode's dark slot and the white to serve dark mode's light slot. It now always composes with the inverse section: `.section--ink.section--contrast` (on-inverse text/border rules apply; only the surface differs). DESIGN.md frontmatter + Colors prose updated, alternation rule documented.

**Section parity (hero = position 1):** hero base / mission ink / toolkit paper(base) / loop ink+contrast / stats BASE (was ink) / foundation ink (was paper) / faq base (contrast class removed) / posture ink+contrast (was plain ink) / cta base.

**Supporting CSS:** loop-on-flipped rules (.section--ink .process__* -> border-inverse + on-inverse text; return-label mask bg = surface-inverse, or surface-contrast under .section--contrast); stats recolored for base context (border-firm, text-primary values/labels, text-tertiary captions).

**VERIFIED:** light theme positions 1-6 (cream/green/paper/GRAY/cream/green - the two darks read clearly as different planes; count-up works in new base colors). Dark theme tail 8-9 (WHITE posture, teal cta + cream banner). Jonah's tab flipped theme mid-sweep which covered both ends.

**"You did the opposite" (Jonah, mid-verify):** my fresh-load renders match the spec exactly - prime suspect is STALE styles.css in his tab: the old cached stylesheet carries the ORIGINAL reversed token (white-in-light/gray-in-dark) + ink-colored stats, which against the new HTML displays literally the opposite planes (white where gray belongs) and invisible stats text. Same failure mode as the tilt-runtime module cache earlier today. Fix shipped: styles.css link now versioned (?v=2) like the runtime - BUMP BOTH on re-vendor/structural changes. If a fresh load still reads "opposite" to Jonah, the next suspect is hero parity (whether the hero counts as slot 1) - one-class-per-section flip.

Files: marketing-site/styles.css (tokens x2, .section--ink.section--contrast, process on-inverse rules, stats base recolor), marketing-site/index.html (5 section re-classes + versioned stylesheet link), marketing-site/DESIGN.md (token + prose + alternation rule).
