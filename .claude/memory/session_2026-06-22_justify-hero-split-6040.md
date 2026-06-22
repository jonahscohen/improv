---
name: Justify live task - .hero-split set to 60/40 on sidecoach.html
description: Marketing sidecoach.html .hero-split grid changed from 1fr 1fr to 3fr 2fr (true gap-safe 60/40 split) per an in-browser Justify prompt. CSS applied + curl-verified served; desktop-width pixel verification not possible this session (chrome MCP on a different host, cmux browser only a narrow split pane).
type: project
relates_to: [session_2026-06-19_chrome-host-not-claude-code-host.md]
---

Collaborator: Jonah Cohen

Justify queue prompt-1 (from http://localhost:4830/sidecoach.html, target `.hero-split`): "make the width divisions = 60% 40%".

Change in `marketing-site/styles.css` (.hero-split, ~line 946):
- `grid-template-columns: 1fr 1fr` -> `3fr 2fr`. Updated the stale "Hero 50/50" comment to "Hero 60/40".
- Decisive call: used `3fr 2fr` (3:2 = 60:40 of the track space) NOT literal `60% 40%`. The grid has `gap: var(--space-12)` (48px); literal `60% 40%` = 60%/40% of the 1152px container = 691.2 + 460.8 = 1152, plus the 48px gap = 1200px, overflowing the container by the gap width. `3fr 2fr` gives an exact 60/40 division that respects the gap and never overflows, and matches the file's fr-based idiom. The 880px mobile breakpoint (`grid-template-columns: 1fr`) is unchanged.

Verification:
- `curl http://localhost:4830/styles.css` confirms the no-cache server now serves `grid-template-columns: 3fr 2fr`. The change is live.
- Could NOT capture a desktop-width pixel screenshot of the 60/40 split this session:
  - chrome MCP browser is paired to a DIFFERENT host (navigating it to localhost:4830 returned "Frame is showing error page" - the known split-host condition, [[session_2026-06-19_chrome-host-not-claude-code-host.md]]).
  - cmux browser `open` only yields a narrow split pane (~340 CSS px), which is below the 880px breakpoint, so it renders the mobile single-column stack, not the desktop 60/40. Jonah confirmed mid-task: "you wont be able to verify in cmux." Stopped the cmux verification attempts there rather than rabbit-holing.
- The cmux screenshot DID confirm the page loads from this machine's server and the mobile/stacked layout is intact (no breakage). The 60/40 desktop split is the deterministic result of `3fr 2fr` on the 2-child grid; Jonah's own live tab (justify-connected, 1907px viewport) reflects it on reload (justify hot-refresh reloads project tabs on done).

Files touched:
- marketing-site/styles.css (.hero-split grid-template-columns + comment)
