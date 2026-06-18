---
name: Justify queue - 5 marketing-site tasks from Jonah (DO NOT LOSE) + watch-always-on rule
description: durable capture of the 5 justify in-browser tasks Jonah queued on the marketing site (so a daemon restart cannot lose them) + the rule that justify-watch must ALWAYS run in the background
type: project
relates_to: [session_2026-06-15_justify-on-marketing-site.md, feedback_plain_language_not_phase_codes.md]
---

RULE (Jonah, 2026-06-15): justify-watch must ALWAYS be running in the background -
do NOT pause it. Re-arm it whenever it idles/returns. (I wrongly paused it; corrected.)

5 JUSTIFY TASKS queued on the marketing site (localhost:4830). Icon library for
this project = LUCIDE (verbatim path sourcing per the icon rule). Captured durably
here in case the daemon restarts (the queue is in-memory). Apply each to
marketing-site source, then justify-done with the diff.

- prompt-1 | selector `.tool-card:nth-child(1) > .tool-card__cta` (the "See Sidecoach
  >" span, index.html:121; same caret &#8250; also on Justify:130 + Beats:139):
  "make this caret into an actual icon sourced from one of our libraries" -> replace
  the &#8250; with a Lucide chevron-right SVG (apply to all 3 CTAs for consistency).
- prompt-2 | selector `.section--loop` (index.html:145): "lets make sure this
  section's fx layer is still visible, it's practically nonexistent" -> the loop
  section's fx/background layer is too faint; raise its visibility (opacity/blend/
  z-index in styles.css).
- prompt-3 | selector `.process__step:nth-child(5)` (the 5 process steps,
  index.html:156-188): "let's use icons to represent the term inside the card
  instead of the term itself. pool from our icon library and apply to each instance"
  -> each process step (01 Plan, 02 Design, 03 Build, 04 ?, 05 Remember) gets a
  Lucide icon for its term, applied to ALL 5 steps.
- prompt-4 | selector `.stats` (index.html:267): "update the counts and stats. i
  think we've got new numbers/stats we'd like to show off here" -> the stats (e.g.
  "Design flows 26") need refreshed real numbers (validators, hooks, flows, skills).
  NEEDS the real current counts - compute from the repo OR confirm with Jonah.
- prompt-5 | selector `.faq__item:nth-child(1) p` (index.html:308): "make this max
  width 75% width 100%" -> CSS: width:100%; max-width:75% on that FAQ answer
  paragraph. (Trivial.)

Status: watch re-armed always-on (pid 97794); user browser connected (connections:1).
Fix-agent (justify-fixer) is modifying the justify daemon/core IN PARALLEL - told it
NOT to restart/redeploy the real :9223 daemon while these 5 are live (isolated
testing only) so the queue + session survive.

PROGRESS (2026-06-15): DONE + responded to the panel - prompt-5 (FAQ answer p
max-width 75%/width 100%, verified), prompt-1 (all 3 tool-card carets -> inline
Lucide chevron-right, verbatim path, verified), prompt-2 (loop fx opacity
0.075 -> 0.2, applied; animated-canvas prominence to verify live). OPEN (need
Jonah's call): prompt-3 (process-step icons - ADD an icon + keep the label, vs
REPLACE the label text with an icon-only; + confirm the 5 Lucide icon choices), and
prompt-4 (stats - the real new numbers; will compute current counts and propose).
Queue cleared after handling all 5 (3 completed + 2 needsInfo at the time).

UPDATE 2: prompt-1 + prompt-3 DONE too (icons sourced verbatim from lucide.dev,
verified). So 4 of 5 applied+verified: prompt-1 (CTA chevrons), prompt-2 (loop fx,
now visibly textured), prompt-3 (process labels -> icon-only, carousel JS reads
aria-label), prompt-5 (FAQ width).

prompt-4 RECOUNT (Jonah asked to recount the stats + propose). Findings:
- Design verbs = 22 (sidecoach-verbs.json) -> current 22, UNCHANGED.
- Skills = 17 (claude/skills/*/SKILL.md) -> current 17, UNCHANGED.
- Design flows = 26 (flows.ts flow ids) -> current 26, UNCHANGED.
- Enforcement hooks = 51 raw claude/hooks/*.sh (current says 49). +2, BUT unsure
  the original "49" used the raw-.sh definition vs a curated enforcement subset.
- Validators (218) + Installable components (27): NOT cleanly reproducible from the
  repo. 218 doesn't match any single countable source (product-rule-registry=31,
  POLISH ids=23, checkX fns=10); it traces to a design-review doc, i.e. a curated
  aggregate. install.sh's components are not a simple countable list. Did NOT
  fabricate. Need Jonah's original counting method (or a careful per-source trace)
  before changing these.
PROPOSAL: leave 22/17/26 as-is (verified); optionally bump hooks 49->51; HOLD
validators+components pending methodology. prompt-4 NOT applied yet (it was a
propose-first task).

prompt-4 DONE (2026-06-15): recounted independently and applied. Validators 218 ->
30, Enforcement hooks 49 -> 51; flows 26 / skills 17 / components 27 / verbs 22
verified accurate, unchanged. Full trace + the 30/51 derivation in
[[session_2026-06-15_marketing-stats-recount.md]]. Closed the loop THROUGH the
Validating stage (watch -> apply -> justify-validating -> verify in connected
Chrome -> justify-done); panel entry #8 shows +2/-2 with both selectors. So ALL 5
prompts are now applied + verified. See [[session_2026-06-15_justify-validating-stage-diagnosis.md]].

FINAL STATE + COORDINATION NOTE: 4 of 5 applied+verified. prompt-2 landed at
opacity 0.55 (NOT my 0.2): the justify-fixer agent was ALSO tasked (by Jonah,
direct) with the 5 prompts while I was handling them - a CONCURRENT-EDIT on the same
marketing-site files. It found my 1/3/5 already in source and made one overlapping
edit (.loop__fx 0.2 -> 0.55), which I verified looks good (clear textured backdrop,
content readable) and kept; panel record corrected to 0.55. No destructive conflict
because the fixer built on my edits, but LESSON: one owner per the justify queue -
do not run a separate agent on the same files the live session is editing. WS-fix
team deleted. Watch flag ON (always-on). Only prompt-4 (stats) remains, pending
Jonah's numbers/methodology.

Collaborator: Jonah.
