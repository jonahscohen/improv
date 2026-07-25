---
name: gap-analysis visual artifact build + em-dash self-analysis
description: Built/verified the 3-tool gap-analysis dashboard; caught + fixed em-dash entities that slipped the content-guard
type: project
relates_to: [session_2026-07-25_three-tool-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: browser
confidence: high
---

Rendered the three-tool gap analysis as a self-contained HTML dashboard (coverage-console treatment: cool-graphite neutrals + single deep-teal accent + semantic tri-state have/partial/gap; heavy system-sans display + mono instrument labels; summary matrix -> per-tool panels w/ stacked-bar coverage meters + status-chipped delta lists -> meta/moat duo -> reconcile flag). Both themes, theme toggle + a "gaps only" filter.

VERIFICATION (browser pane was STUCK - navigate timed out 300s; fell back to the project's own Playwright/chromium in sidecoach/node_modules to render headlessly, which is more reliable anyway): light + dark full-page + top screenshots READ and examined; zero horizontal overflow (scrollW==bodyW both themes); interactive "gaps only" filter tested with a REAL Playwright click (is-have rows 2 -> 0, aria-pressed true) + screenshot confirms only THE GAPS shown. Layout sound, no overlap/clip.

**SELF-ANALYSIS (em-dash violation).** First render shipped 27 `&mdash;` + 4 `&ndash;` HTML ENTITIES -> rendered as literal em/en-dash glyphs. This violates the team's hard em-dash ban AND is self-defeating: the artifact is ABOUT anti-slop tools whose SIGNATURE rule (taste-skill 9G, no-ai-slop) is the em-dash ban. WHY it happened: the content-guard hook matches the literal `-` glyph, not the HTML entity form, so `&mdash;` sailed through with no block; I reached for `&mdash;` as "typographically correct" out of habit without applying the ban to the entity encoding. HOW caught: only by READING the rendered screenshot (the glyph was visible) - a lint on source text would have missed it too. Fixed: perl swap all `&mdash;`/`&ndash;` -> `-` (all were space-surrounded, become clean spaced hyphens), re-rendered, 0/0/0 confirmed.

**FLAG for Jonah (hook coverage gap, NOT an error):** content-guard blocks the literal em-dash glyph but NOT its HTML-entity forms (`&mdash;` `&#8212;` `&#x2014;` and en-dash equivalents). Any generated HTML/markdown can smuggle a banned dash past the guard as an entity. Worth extending the guard's pattern to the entity forms. Did not fix unprompted (guard edit is Jonah's call; no hook ERROR fired, this is a recall gap).

Artifact source: scratchpad/gap-analysis.html (temp). No project code changed.
Files touched: none in-repo (analysis + scratchpad artifact + this beat).
