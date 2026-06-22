---
name: Justify follow-up - hero title <br> reverted, real lever was .page-hero__title max-width:16ch -> 19ch
description: User refined the prior <br> title break - keep it one continuous element, no nowrap, just ensure "Say what you want" stays on the first line at desktop. The binding constraint was the title's own max-width:16ch (not the grid column, which is already 60%); removed the <br> and raised max-width to 19ch.
type: project
relates_to: [session_2026-06-22_justify-sidecoach-hero-copy.md, session_2026-06-22_justify-hero-split-6040.md]
superseded_by: session_2026-06-22_justify-hero-title-textwrap-fix.md
---

> CORRECTION: This beat's conclusion was WRONG. max-width was NOT the fix - the title
> wrap was controlled by the global `h1 { text-wrap: balance }`, which ignores width.
> The real fix (text-wrap:wrap) and the visual verification are in
> [[session_2026-06-22_justify-hero-title-textwrap-fix.md]]. The <br> removal here was
> correct; everything about max-width being the lever was a misdiagnosis (it was never
> visually verified - curl "confirmed" the served value, a false positive).

Collaborator: Jonah Cohen

Justify prompt (a reply to the earlier prompt-2 title change): "keep it all on one line, but make sure there's enough room for 'say what you want' to remain on the first line at desktop. as we visually contract the viewport, the text can wrap normally. no need to make a nowrap, just make sure the first column is wide enough."

Diagnosis: the user attributed the wrap to the grid column, but the actual cap was `.page-hero__title { max-width: 16ch }` (styles.css ~2600). "Say what you want." is 18 chars, sitting right at the 16ch cap, so it wrapped mid-phrase. The left grid column at 60% (3fr 2fr) = ~662px is already far wider than the title box, so the column was never the limiter; the title's own max-width was.

Changes:
- marketing-site/sidecoach.html: removed the `<br>` I added in the prior round - title is one continuous element again ("Say what you want. Sidecoach puts it <span>all together</span>."). No white-space:nowrap (per user).
- marketing-site/styles.css `.page-hero__title`: `max-width: 16ch` -> `19ch`. Headroom so "Say what you want." (18ch) holds the first line, while staying below the ~24ch needed for "Sidecoach" to climb onto line 1, so it still naturally breaks after "want." The mobile rule (`.page-hero__title { max-width: none }` inside the breakpoint, ~line 535) is untouched, so narrow viewports wrap normally as the user wanted.
- Kept the 60/40 grid (3fr 2fr) - no column change needed.

Verification: curl confirms served sidecoach.html no longer contains `want.<br>Sidecoach` and styles.css serves `max-width: 19ch`. Desktop-width pixel verification of the actual wrap is NOT available this session (chrome MCP different host; cmux only a narrow split pane; Jonah confirmed cmux can't verify). The ch value is a reasoned estimate - Jonah is the visual check in this live loop and will reply if the wrap needs nudging (one-number tweak). Responded to the prompt id + cleared.

Files touched:
- marketing-site/sidecoach.html (removed title <br>)
- marketing-site/styles.css (.page-hero__title max-width 16ch -> 19ch)
