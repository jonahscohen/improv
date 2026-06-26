---
name: Comprehensive yes&-branded README rewrite with collapsible sections
description: Rewrote README.md as a yes&-focused comprehensive guide using HTML <details> sections for tabbed-feeling navigation. Added the yes& logo at the top via <picture> with light/dark theme switching. Covers components, design stack, memory, workflows, team practices, plugin/connector/MCP/skill distinctions, customization, architecture, troubleshooting, contributing.
type: project
---

Collaborator: Jonah Cohen

# What changed

## README.md - full rewrite

Was ~180 lines of bare install instructions + a few tables. Now ~440 lines structured as 12 collapsible `<details>` sections under a single yes&-branded header. Each section is a chapter that opens/closes independently, addressing GitHub's lack of true tab navigation by using the standard `<details>`/`<summary>` workaround.

Section order:
1. The opinion (why this exists, what it's for)
2. The components (ten of them, with the existing table preserved)
3. The Claude Code brain (CLAUDE.md walkthrough section by section)
4. The three-layer design stack (Oracle + DESIGN.md + make-interfaces-feel-better)
5. Memory: how Claude remembers
6. Day-to-day workflows (ampersand, yesplease, bootstrap, custom locations)
7. For yes& teams (collaboration, attribution, project-level CLAUDE.md, onboarding)
8. Boost an existing Claude Code (no overwrites - additive components only)
9. Plugins, connectors, MCP servers, Skills (the four-tier explanation)
10. Customization (env vars, flags, presets, deep config)
11. Architecture (symlink strategy, hook lifecycle, idempotency model, backup discipline, multi-location)
12. Troubleshooting (10 common issues + fixes)
13. Contributing (for yes& devs adding components, skills, plugins, rules)

Also: License & footer.

## assets/yes-and-logo-light.png

Saved the yes& logo (light-mode variant: navy "yes" + red "&") to `assets/`. README references it via `<picture>` with `prefers-color-scheme: dark` source pointing at `assets/yes-and-logo-dark.png` (placeholder filename; the file doesn't exist yet but GitHub will fall back to the `<img src>` light variant on dark themes). When the dark-mode logo file lands at that path, GitHub will auto-swap based on theme.

## .gitignore

Already covered .DS_Store from earlier; no changes here, but assets/ is now tracked and committed.

# Why

User asked for a "comprehensive (and i MEAN comprehensive) guide" to land at the top of the repo. The previous README was install-focused only and didn't carry yes&'s actual design philosophy, the cross-developer memory story, or the deep architectural rationale (why symlink vs copy, why marker-guarded appends, why the three-layer design stack). New README is the thing a yes& dev (or curious external visitor) reads to understand the whole opinion in one sitting.

`<details>` sections were chosen because GitHub's markdown sanitizer strips JS, so true tabs aren't possible - but `<details>` is the next-best, ships native to GitHub, and gives readers the same "click to expand the chapter you care about" UX without the scroll wall.

# Hook gotcha to remember

The content-guard hook blocked the first Write attempt because the README literally contained one of the forbidden AI-attribution strings twice (when describing what the bash-guard hook blocks, AND in the Code Quality bullet about not taking credit). Paraphrased to "AI-coauthor attribution lines" / "auto-generated credit comments" so the documentation conveys the meaning without containing the forbidden literal. This is a real edge case for content-guard: documenting what it blocks requires not using the literal pattern. Worth flagging in feedback memory if it bites again.

# Files touched

- `README.md` (full rewrite)
- `assets/yes-and-logo-light.png` (new, copied from clipboard temp)
- `.claude/memory/session_2026-04-28_yes-and-readme.md` (this file)
- `.claude/memory/MEMORY.md` (index entry)
