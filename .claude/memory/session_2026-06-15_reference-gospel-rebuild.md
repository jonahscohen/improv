---
name: Reference page rebuild (gospel) - IA + agent-team plan
description: Rebuilding marketing-site/reference.html into the comprehensive Improv reference - hero + component subnav (Justify/Sidecoach/Beats/Foundation) + per-component chapter sidebar + content; using sidecoach + a cmux agent team
type: project
relates_to: [reference_dev_servers_ports.md]
---

Jonah: rewrite the marketing-site reference section (http://localhost:4830/reference.html,
NOT the standalone 4831 site). New IA:
- Hero section.
- Subnavigation after the hero: pages between COMPONENTS (justify, sidecoach, beats;
  + a Foundation bucket for everything else - matches the marketing narrative
  "three tools that earn their place, a foundation underneath").
- Below: LEFT SIDEBAR = chapters for each section of content under the active
  component; CONTENT at right = the reference material. (Two-level nav: subnav
  switches component -> sidebar+content swap; sidebar = chapters, scroll-spy.)
- "Spare no details - gospel for every single part of the improv package."
  Consolidate + interlink between components/sections.
- Explicitly asked to use sidecoach + agent teams.

APPROACH:
- sidecoach loaded (design front door); design system from marketing-site/DESIGN.md
  (cream #F4EFE4 / ink #1A1F1B / red #DC2618, Source Serif display, Hanken body,
  JetBrains mono, CSS custom-property tokens, editorial, shades-not-flips section
  alternation, shadows over borders).
- Workflow tool is BLOCKED inside cmux (agent-teams enabled) -> must use the visible
  named-teammate flow (TeamCreate -> Agent named teammates -> SendMessage/TaskList ->
  TeamDelete). Team "reference-gospel" created.
- 8 author agents, each reads REAL source and writes
  /tmp/ref-gospel/<label>.json = {component, chapters:[{id,title,group?,contentHtml}]}:
  justify, sidecoach, beats, foundation:install, foundation:hooks,
  foundation:terminal-voice-discord, foundation:design-stack, foundation:discipline.
  Content contract: defined class vocabulary (ref-h3, ref-table, ref-callout,
  ref-xlink data-component for interlinks), real commands/paths only (no fabrication),
  no emoji/em-dash.
- Team lead (me) assembles the single coherent reference.html + new CSS (matching
  tokens) + JS (subnav component switch + sidebar chapter scroll-spy + xlink jump),
  then QA via sidecoach audit/critique/polish + browser verify, then TeamDelete.

PROGRESS: New reference CSS appended to marketing-site/styles.css (the .ref-* system:
.ref-subnav sticky component switcher, .ref-layout grid 250px+1fr, .ref-sidebar sticky
chapter nav with .ref-group headings + .ref-chapter-link scroll-spy active state,
.ref-panel per-component content, .ref-chapter typography, .ref-h3/.ref-h4, .ref-table,
.ref-callout, .ref-xlink; reuses global pre/code which already flip via dark-theme
tokens). Old .reference* CSS left in place (dead once reference.html is rewritten;
cleanup later). Tokens: --color-ink is #02272B teal, --font-display is MADE Awelier
(use CSS vars, not DESIGN.md literals). 8 authors spawned; collecting JSON in
/tmp/ref-gospel/. Next: assemble reference.html (hero + subnav + sidebar + content) +
JS (component switch + chapter scroll-spy + xlink jump), then QA + browser verify.

DONE + VERIFIED (2026-06-15): reference.html rebuilt with the new two-level IA.
- 8 author teammates each read real source and wrote /tmp/ref-gospel/<area>.json.
  Notable self-corrections (source-grounding worked): infra author found cmux/voice/
  discord live under claude/ not top-level dirs; install author found the real
  bootstrap URL is raw.githubusercontent.com/jonahscohen/improv/main/bootstrap.sh
  (no get.improv.dev) and that the minimal preset includes reflect (6 components).
- Assembled via /tmp/assemble-reference.js (reads the 8 JSON, merges foundation in
  group order Install/Hooks/Terminal&Voice/Design stack/Discipline, emits hero +
  .ref-subnav component switcher + .ref-layout sidebar+content + the page JS).
- Final: 60 chapters - justify 9, sidecoach 9, beats 8, foundation 34. styles.css?v=32.
- JS: component switch (subnav, swaps sidebar+panel, updates #hash), chapter
  scroll-spy (IntersectionObserver, single-active), ref-xlink cross-component jump,
  honors #component and #component-chapter on load.
- VERIFIED in browser (dark + light themes): hero, sticky subnav, grouped sidebar
  with scroll-spy, content prose/code/tables/inline-code/subsections/cross-links all
  render; HTML well-formed (no unclosed tags, 1 h1, no dup ids, skip-link+main);
  sidecoach audit run (5 dimensions: a11y semantic structure + roles/aria-current,
  theming all-tokens, responsive grid collapse at 880px, no anti-patterns, static
  perf). make-interfaces principles applied (tabular-nums on tables, text-wrap
  balance/pretty, 40px hit areas, no transition:all, scale-on-press subnav).
- NOT pixel-verified: narrow/mobile viewport (grid->1fr at 880px is standard, built
  but not screenshotted) - flag for a follow-up if needed.
- Old .reference* CSS in styles.css is now dead (superseded by .ref-*); left for a
  later cleanup pass.

Collaborator: Jonah.
