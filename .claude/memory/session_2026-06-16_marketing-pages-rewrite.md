---
name: Marketing component pages rewritten + new Foundation page (sidecoach/justify/beats/foundation)
description: Jonah - rewrite the sidecoach, justify, beats marketing pages and add a new Foundation page covering the rest of the stack, all in the homepage/reference editorial style. Reference + homepage copy approved; these are out of date (modes, flow codenames, "dotfiles", wrong numbers).
type: project
relates_to: [session_2026-06-15_stats-ledger-reverted.md, feedback_mode_words_unnatural.md, reference_dev_servers_ports.md]
---

Jonah (2026-06-16): "copy-wise we're in a great place for reference only. Homepage is
pretty good too. I need the sidecoach, justify, and beats marketing pages fully
rewritten, and a new page that fully covers the rest of the stack, all in the same style."

DECISIONS (asked via AskUserQuestion):
- New page = "Foundation" -> foundation.html, nav label "foundation" (matches the homepage's
  existing "THE FOUNDATION" section).
- New page scope = HIGH-LEVEL OVERVIEW: scannable, one short section per area, leans on
  reference.html for depth (not a dense catalog).

WHY FULL REWRITES (state of the old pages, all confirmed by reading them):
- sidecoach.html: documented the RETIRED modes (forge/kiln/bloom/canvas/trim), used internal
  flow codenames (flowA-flowJ), said "dotfiles", and its numbers ("8 flows, 159 validators")
  contradicted the homepage (26 flows, 30 validators). The exact problems Jonah already raged about.
- justify.html: closer, but said "dotfiles" and referenced a non-real `justify start` command.
- beats.html: structurally fine but said "dotfiles" throughout + a malformed duplicate <title> (line 6).

APPROACH: wrote the pages directly (NOT via fan-out agents - documented failure mode is agents
re-introducing internal jargon). Source of truth for voice + facts = the reference page Jonah
approved (its justify/sidecoach/beats/foundation chapters), re-presented at MARKETING altitude
(persuasive, scannable) in the homepage's editorial layout. Reused existing CSS components only
(page-hero, section/--paper/--ink, feature-row, minor-list, install-block, btn) so ~zero new CSS.
Adopted the homepage's newer header structure (site-header > container > topbar, nav-list ul/li,
lucide icon-source comments, styles.css?v=33). Canonical nav order across the 4 built pages:
justify | sidecoach | beats | foundation | cheatsheet | reference | GitHub.

DONE (all four pages + nav + verification):
- sidecoach.html FULL REWRITE: hero ("Say what you want"), "The one move" (plain-language intent,
  explicit "There are no trigger words" graf killing modes), "Set it up once" (PRODUCT.md/DESIGN.md
  by asking), everyday workflow (build then review/tighten + the 3-stage gate), "The verbs" (22
  verbs grouped Plan/Build/Review/Tone/Document+Live), "What you get back" (build report, real
  checks, records to Beats), "Why it refuses shortcuts", how-to-start. No modes, no flowA-J, no dotfiles.
- justify.html REWRITE: hero ("Tweak the page. Claude writes the code"), "The one move", "Two modes"
  (Prompt/Manipulate + Annotate/Layout), "Hand off and review" (Working/Validating/Review stages +
  the real unified-diff Changes panel: +/- counts, Open With at exact line, Revert, Reply),
  troubleshooting, how-to-start (/justify, justify-serve, justify-init, port 9223). Fixed dotfiles +
  the bogus "justify start" command.
- beats.html REWRITE: hero ("It remembers so you don't have to"), "The whole move", "Reading the
  record" (.claude/memory/ + MEMORY.md index + just ask), "Across machines", "Steering what it keeps"
  (5 note kinds: about you/feedback/project state/decisions/references), "The discipline", how-to-start
  (ampersand --only memory). Fixed dotfiles throughout + the malformed duplicate <title> on line 6.
- foundation.html NEW (high-level overview): hero ("The quiet layer under the three tools"), Install
  (bootstrap curl install-block + the ampersand picker + --only/--preset/--dry-run/--pull), The skills
  (4 peer specialists + reflect), The bridges (cmux/voice/discord), tilt-lab, The guardrails (the hooks,
  + ask-before-override), where-to-go-next. Links to reference for depth.
- NAV: added foundation to index.html (primary nav), cheatsheet.html (nav + footer), reference.html
  (nav + footer). The 4 built pages use canonical order justify|sidecoach|beats|foundation|cheatsheet|
  reference|GitHub on the homepage's newer site-header/nav-list structure.
- cheatsheet.html: added the data-icon-source="lucide:moon"/"lucide:sun" provenance markers to its 2
  theme-toggle SVGs (verbatim lucide paths that were unmarked). The taste-gate flagged them as
  fabricated-svg when I touched the file; they are genuine icons, now labeled. Gate clean after.

VERIFIED:
- sidecoach taste-check: 0 violations on all 4 pages (sidecoach/justify/beats/foundation).
- scanForAbsoluteBans('./marketing-site'): 1 finding total, the ACCEPTED hero-metric at index.html:273.
  The 4 new pages add zero new ban findings.
- Browser (Chrome MCP, localhost:4830, cache-busted): all 4 pages render correctly. sidecoach in dark
  (hero, the-one-move feature-rows, "no trigger words", 3-stage gate, install+CTAs). justify dark hero +
  light "two modes". foundation light (install-block with COPY button, picker, tilt-lab, section--ink
  guardrails - good cream-on-dark contrast). beats light (hero, whole-move, steering + 5 note kinds).
  No CSS added (styles.css?v=33 unchanged) - reused page-hero/section/--paper/--ink/feature-row/
  install-block/btn throughout.
- DELIBERATE non-change: did NOT touch reference/homepage COPY (Jonah said both are good) - only added
  the foundation nav link to them.

Files touched:
- marketing-site/sidecoach.html (full rewrite)
- marketing-site/justify.html (rewrite)
- marketing-site/beats.html (rewrite)
- marketing-site/foundation.html (new)
- marketing-site/index.html, cheatsheet.html, reference.html (foundation nav link; cheatsheet icon markers)

Collaborator: Jonah.
