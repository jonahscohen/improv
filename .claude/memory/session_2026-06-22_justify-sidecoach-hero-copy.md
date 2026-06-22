---
name: Justify live tasks - sidecoach.html hero title (2-line) + lede shortened
description: Two in-browser Justify copy edits on sidecoach.html hero - title broken onto two lines via <br>, lede cut from ~46 to ~24 words. Verified by served HTML content (desktop pixel verify still blocked per the split-host/cmux constraint).
type: project
relates_to: [session_2026-06-22_justify-hero-split-6040.md]
---

Collaborator: Jonah Cohen

Two prompts arrived together in the Justify queue, both on http://localhost:4830/sidecoach.html hero:

- prompt-2 `.page-hero__title` (h1): "First line: Say what you want. Second line: Sidecoach puts it all together." -> inserted `<br>` after "Say what you want." so it wraps to two lines. The underlined-red `all together` span is preserved unchanged.
- prompt-1 `.page-hero__lede` (p): "Make this a lot shorter." -> replaced the ~46-word lede ("Sidecoach is the design layer of Improv. You describe the task the way you would to a colleague, it recognizes the kind of design work you mean, runs it end to end, and validates the work against your brand, taste rules, and accessibility guidelines.") with a ~24-word version: "Improv's design layer. Describe the work in plain language, and Sidecoach builds it end to end, checked against your brand, taste, and accessibility rules." Dropped the "to a colleague / recognizes the kind of work" filler; kept the brand/taste/accessibility pillars. Avoided echoing the title's "Say what you want" by using "Describe the work in plain language."

These are copy/structural edits -> skipped the heavy sidecoach QA triad (copy tweaks are exempt).

Verification: `curl http://localhost:4830/sidecoach.html` confirms the served HTML now carries the `<br>` title and the shortened lede, and the old long lede string is gone (grep count 0). Desktop-width pixel screenshot still not available this session (chrome MCP on a different host; cmux browser only a narrow split pane below the 880px breakpoint) - same constraint as the 60/40 task; Jonah confirmed cmux can't verify. Copy edits are content-verifiable, and Jonah's live tab hot-refreshes on done.

Responded to both prompt ids via /respond (full panel schema) + id-scoped /prompts/clear.

Files touched:
- marketing-site/sidecoach.html (.page-hero__title <br>; .page-hero__lede copy)
