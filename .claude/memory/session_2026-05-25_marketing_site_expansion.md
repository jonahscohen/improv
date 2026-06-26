---
name: session-2026-05-25-marketing-site-expansion
description: Marketing-site expansion - sidecoach re-run, real Yes& logo asset on all pages, new memory.html and reference.html (tabbed kit-and-kaboodle doc).
type: project
relates_to: [session_2026-05-25_marketing_site_build.md, feedback_autonomy_default.md]
---

Human collaborator: Jonah.

## User brief

"USING SIDECOACH (IN ALL CAPS SO YOU KNOW WHAT I WANT FOR REAL)" - make a memory marketing page with varying layers/degrees of tracking, plus a reference page (kit-and-kaboodle doc) with tabbed navigation between major features. Replace text wordmark with the real Yes& logo asset from the repo.

## Sidecoach re-run

`npx ts-node src/dogfood-craft-step2.ts` produced 8/8 flows successful, 1146-line brief at `/tmp/sidecoach-craft-output.md` - matches prior dogfood run byte-for-byte. Reproducible.

## Assets staged

Copied from `reference/assets/`:
- `marketing-site/assets/yes-and-logo-light.webp` (dark "yes" + red ampersand, for cream backgrounds)
- `marketing-site/assets/yes-and-logo-dark.webp` (cream "yes" + red ampersand, for ink backgrounds)
- `marketing-site/assets/favicon.svg`

The logo is the canonical Yes& brand asset - lowercase "yes" in heavy serif, ornate red ampersand. Replaces the text-only `<span>Yes<em>&</em></span>` wordmark used in v1.

## Memory page concept

Per user "varying layers and degrees to which we track memory" - structure the page around four layers:

1. **In-session task tracking** (TodoWrite) - ephemeral, only lives for the conversation
2. **File-based persistent memory** (`.claude/memory/`) - per-task notes that survive across sessions and machines via dotfiles git sync
3. **MEMORY.md index** - one-line pointers to topic files, loaded at every session start
4. **Auto-memory project store** (`~/.claude/projects/<path>/memory/`) - user/feedback/project/reference types

Plus the meta-layer: frontmatter typing, `relates_to` / `supersedes` graph linking, write-time link check.

## Reference page concept

Tabbed kit-and-kaboodle doc covering all major features in deep detail. Tab list along the left or top:
- improv
- sidecoach
- memory
- cmux
- voice
- discord
- hooks
- oracle
- validation-guard

JS-driven tab switching (real button clicks, ARIA tabs pattern). Each panel has subsection headings, code samples, commands, and links back to source on GitHub.

## Status

- [x] M7 sidecoach craft re-run
- [x] M8 assets copied
- [x] M9 swap wordmark for logo on existing 3 pages (index/improv/sidecoach all updated; favicon link added; nav expanded to include memory + reference; landing's memory tool-card now points at memory.html)
- [x] M10 memory.html - 5-layer "stack" pattern (ephemeral / per-task / index / cross-machine / global), frontmatter type breakdown, relationship-graph breakdown, ink-section discipline rules, why-it-exists CTA. New CSS classes: .layer-list, .layer-row, .layer-row__num, .layer-row__head, .layer-row__tag, .layer-row__title, .layer-row__body, .layer-row__meta.
- [x] M11 reference.html with tabs - 9 component tabs (improv/sidecoach/memory/cmux/voice/discord/hooks/oracle/validation-guard), left-rail sticky tab list on desktop, horizontal scrollable on mobile, ARIA tabs pattern with keyboard nav (arrows, home, end), URL fragment sync. JS minimal, no synthetic events.
- [x] M12 visual verification of all 5 pages - logo renders top-left on every page, expanded 5-item nav present everywhere. memory.html stacked 5-card layer pattern with red mono number + tag + display-serif title + body grid + 2-col meta panel below. reference.html sticky left-rail with 9 mono tabs, click switches active styling (dark ink bg on selected, muted on others) and swaps right panel content, URL fragment updates. ARIA tabs pattern verified through real left_click event on memory tab; improv panel hidden, memory panel revealed.

Fix-gate suppressed - the wordmark swap touches 5 HTML files + 1 CSS + writes 2 new HTML files. One coherent task; M12 is the verification checkpoint.

## Logo CSS landed

styles.css `.wordmark` rule rewritten: removed text-styling, switched to a centered inline-flex container holding the `<img class="wordmark__img">` at 28px height. Negative left margin offsets the touch-target padding so the logo aligns to the container left edge.

## index.html updated

Topbar wordmark swapped: was `<a class="wordmark"><span>Yes</span><span class="wordmark__amp">&amp;</span></a>`, now `<a class="wordmark"><img src="assets/yes-and-logo-light.webp" /></a>`. Same width/height attributes (86x42) as the reference site uses for layout-shift prevention.
