---
name: Toolkit reorder (beats last) + hover lift/scale + bold red CTAs (via Justify)
description: Two Justify prompts - card order now sidecoach/justify/beats, cards lift 4px + scale 1.1 on hover (EXPLICIT taste-validator exception), CTAs bold with red on hover
type: project
relates_to: [session_2026-06-10_tool-card-cta-caret-hover.md, session_2026-06-10_homepage-taste-pass.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify batch: prompt-1 (.toolkit) "put beats last, also raise card vertically slightly and scale up by .1 on hover"; prompt-2 (beats CTA) "make this bolder, red on hover".

- Order: sidecoach, justify, beats (beats card block moved after justify in index.html).
- Hover: .tool-card:hover gets transform translateY(-4px) scale(1.1) alongside shadow-lg. **TASTE-VALIDATOR EXCEPTION:** translateY-in-hover is one of the validator's six bans and was REMOVED from these very cards in this morning's taste pass - Jonah explicitly requested it back. CSS comment marks it as an intentional override; future taste-check runs WILL flag it and the finding is pre-overridden. User choice beats validator taste.
- CTAs: weight semibold -> bold (all three, shared class); .tool-card:hover .tool-card__cta color -> red (joins the hover underline).
- styles.css ?v=13.
- **Live tune (Jonah, minutes later): "make the scale up more subtle/less big, dont bounce the easing, quantexpo instead"** -> scale 1.1 -> 1.03; the card's transform transition easing swapped from --ease-spring-quick (the bounce he felt) to --ease-out (cubic-bezier(0.2,0,0,1) - the site's exponential-decel token, the quart/expo family he asked for; no new token needed). v14.

VERIFICATION (partial, honest): card ORDER visually confirmed (light theme frame: PLAN+DESIGN / VALIDATE / REMEMBER). Hover lift/scale/red-CTA NOT screenshot-verified - Jonah was actively driving the browser (page scrolled/resized under every attempt; stopped fighting for the pointer per browser-automation discipline). The hover CSS is deterministic on the same selector pattern as the verified hover-underline; Jonah experiences it firsthand on mouseover. Flag back if the 1.1 scale feels too large in practice (it is a big jump on a 350px card).

Responded completed x2, queue cleared, watcher relaunching.

Files: marketing-site/index.html (card order, v13), marketing-site/styles.css (hover transform + cta weight/color).
