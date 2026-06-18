---
name: Stats hero-metric ban cleared (editorial ledger) + taste-gate hook registered
description: Closed the "Yes and yes" directive - rebuilt the homepage "By the numbers" section from a 6-up SaaS metric-card grid (the hero-metric-template absolute ban) into a single-column ruled ledger, and registered sidecoach-taste-gate.sh in settings.json so the full ban+taste sweep fires on every UI edit.
type: project
relates_to: [feedback_taste_failure_auto_gate.md, session_2026-06-15_sidecoach-proof-of-concept.md]
---

Jonah said "Yes and yes" to: (1) fix the two findings the FULL sidecoach sweep
surfaced on the index (the .tool-card translateY hover + the hero-metric-template
stats grid), and (2) build the blocking gate so this class of taste failure is
caught automatically before it reaches him. This beat records the stats rebuild +
gate registration. (.tool-card translateY -> shadow-only was done earlier this
session; the detector regex namespaced-class fix + the gate build are in
feedback_taste_failure_auto_gate.md and the proof-of-concept beat.)

THE BAN: scanHeroMetricTemplate fires on 3+ consecutive sibling
<div|article|section|li> whose class carries a whole-word stat|metric|kpi|number|count
token. The old markup was <dl class="stats"> with 6x <div class="stat"> in a
repeat(3,1fr) grid - the textbook SaaS hero-metric template the ban names, and the
.stat class tripped the detector at index.html:272.

THE FIX (shape, not regex-dodging): rebuilt it as a ruled LEDGER. Single column of
rows; each row is a 2-col grid - a large serif figure in a right-aligned left rail
(grid-row 1/span 2, align-self center) and the label (semibold) + note (secondary)
stacked in the right column, hairline rules (border-soft) between rows. Reads like an
index / annual-report figures page, not floating KPI cards. New class names carry no
banned token: .ledger / .ledger__row / .ledger__figure / .ledger__label / .ledger__note.
Renaming alone would have gamed the detector; the point was to break the multi-column
identical-tile SHAPE, which the ledger does (one column of rows, not a 3-wide grid).
- Real numbers + anti-vanity captions preserved verbatim (26/30/51/17/27/22).
- Count-up JS rewired: container .stats -> .ledger, class stats--animate -> ledger--animate,
  el.closest('.stat') -> .ledger__row. Dropped the per-row red --count-progress border
  fill (that was a stat-card affordance; a ledger has no progress border). Kept the
  count tween + staggered row fade-up, both still gated behind reduced-motion + JS-on.
- styles.css cache-buster bumped v=31 -> v=32 (index.html).

THE GATE (now registered): added ~/.claude/hooks/sidecoach-taste-gate.sh to the
Write|Edit|MultiEdit PostToolUse block in claude/settings.json (timeout 30). Symlink
verified, settings.json re-validated as JSON. The hook (built/symlinked/tested earlier)
runs scanForAbsoluteBans(project) + sidecoach-taste-check on any .html/.css edited under
a DESIGN.md project and injects findings as a must-fix directive. This converts "I should
run sidecoach" into "every UI edit auto-runs the full sweep" - the durable fix for the
recurring failure where I declared UI done without running the evaluators.

VERIFIED:
- scanForAbsoluteBans('./marketing-site') -> 0 findings across 7 files (was 1:
  hero-metric-template at index.html:272, now cleared). All 6 named bans clean.
- sidecoach-taste-check on index.html + styles.css -> 0 violations.
- End-to-end gate test: piped a synthetic Edit PostToolUse event for index.html into
  the registered sidecoach-taste-gate.sh -> returned {} (silent). Earlier it correctly
  injected "anti-pattern ban|index.html:272|P1"; now silent = page clean AND gate not
  false-positiving.
- Browser (Chrome MCP, localhost:4830, fresh cache-busted tab): all 6 ledger rows render
  in BOTH light and dark themes. Figures (26/30/51/17/27/22) large serif, right-aligned in
  the left rail so their right edges line up (tabular-nums); labels semibold; notes muted;
  hairline rules between rows; bottom rule closes the last row. Count-up shows final values.
  In dark theme figures+labels are cream on the dark canvas (high contrast), notes muted but
  readable. No side-stripes, no red-as-text, no metric-card grid in either theme.
- One render note: the existing homepage tab's renderer froze on screenshot (CDP timeout x2);
  a fresh tab loaded and screenshotted fine. Not related to the edits (CSS/HTML only).

Files touched:
- marketing-site/index.html (stats markup -> ledger, count-up JS, CSS version bump)
- marketing-site/styles.css (.stats/.stat block -> .ledger block)
- claude/settings.json (registered sidecoach-taste-gate.sh in PostToolUse)

Collaborator: Jonah.
