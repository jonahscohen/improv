---
name: Drained the 5 browser-submitted justify prompts on the marketing site
description: Handled the 5 queued justify design prompts (caret icon, loop FX, process icons, stats, faq width). 4 already in source; fixed loop FX; stats need user numbers.
type: project
relates_to: [session_2026-06-15_justify-ws-deterministic-connect.md, session_2026-06-15_justify-on-marketing-site.md]
---

Collaborator: Jonah

## Context
After the WS-connect fix, the justify-watch Stop hook kept firing because 5 design
prompts were queued on the daemon (pendingCount:5). User: "just fix the five things
that got sent from browser, and also fix justify." A concurrent session was also
active on the same files (mtime churn + Edit-tool stale-read), so I verified state
rather than blindly stomping.

## The 5 prompts (marketing site, http://localhost:4830/) and disposition
1. .tool-card__cta "make the caret an actual icon" -> ALREADY DONE in source:
   lucide:chevron-right SVG on all three CTAs. Verified rendering.
2. .section--loop "fx layer practically nonexistent" -> FIXED BY ME: .loop__fx
   opacity 0.2 -> 0.55 in styles.css. Verified: the grain-gradient ripple + dither
   plane now reads clearly behind the arc carousel; content still legible.
3. .process__step "use icons for the term instead of the term" -> ALREADY DONE:
   5 verbatim Lucide icons in process__name (clipboard-list/palette/code/
   circle-check/brain); carousel JS reads the term from the icon aria-label.
   Verified rendering.
4. .stats "update the counts, new numbers to show off" -> NOT CHANGED. Could not
   determine the intended new numbers. Verified flows=26 and verbs=22 match current
   sidecoach reality; validators(218)/hooks(49)/skills(17)/components(27) are curated
   counts with no authoritative source in-repo, and raw counts (46 hook .sh, 19 skill
   dirs) do not map. Did NOT fabricate. Needs the user's specific figures.
5. .faq__item p "max width 75% width 100%" -> ALREADY DONE: .faq__a p { width:100%;
   max-width:75% } (overrides the prior 56ch). Verified: answer wraps at ~75%.

## "Fix justify"
Queue is now drained (pendingCount:0) and the watch is active (my justify-watch.sh
poller is up), so the loop is healthy and the Stop hook no longer fires. The 5
prompts had been responded to / cleared by the concurrent session before I edited;
my loop-FX change is a direct source edit (live on next reload), no /respond needed.

## Verification
Headless playwright screenshots (1481x920 @2x) before/after for toolkit, loop,
process, stats, faq. Loop FX before = near-invisible speckle; after = clearly
textured. FAQ opened to confirm 75% wrap.

## Files touched
- marketing-site/styles.css (.loop__fx opacity 0.2 -> 0.55) - the only edit I made.
  (#1/#3/#5 were already in source from a prior/concurrent session; #4 left for user.)
