# Dotfiles tasks

<!-- Managed by /task-list skill. Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0038 -->
<!-- Completed tasks are removed once done; full detail lives in .claude/memory/ beats + git history. -->

## dotfiles
### Active
- [ ] T-0001 [P2] 2026-05-25 research QuiverAI implementation methods

## marketing-site
### Active
- [ ] T-0038 [P2] 2026-05-29 We're going to delete the current website and rebuild a brand new one through sidecoach, using the existing design and product md files. same fonts, same colors, and watch your contrast values. but what i want is a more disciplined user experience, leveraging liberal use of actual components, not just walls of text. this is a responsive, accessible marketing website with sensible developer jumpoff points (perhaps a functional combination of a subnav and breadcrumb system would help). we'll need a deep comprehensive walk through of every single component of the entire claude-dotfiles suite. flat out. the developer-based subpages should give a high level explanation of things followed up with how-tos, deeply technical walkthroughs, cheat sheets, etc. reminder: justify is a microadjustment prompting tool, prompt mode allows for immediate dispatch of offers for claude to play by, hot reload when changes are finished with a review layer. manipulate mode allows for real time in-browser results, which get sent off to claude to be implemented for real, then hot reloaded with a review layer. sidecoach needs to sound sexy, because it is, there's so much going on inside of it, it's the most unique offering of its kind. beats is also the most powerful memory tool around, with varying layers (global claude memory, global rules, project-wide rules and memory, localized memory, reflection) and now has a task list to help track tasks from project to project. the ultimate in memory management. and we have a bunch of customizations that push claude beyond normal conventions of convenience. we want to cover them ALL. lets go! new website!

## sidecoach
### Active
- [ ] T-0007 [P2] 2026-05-28 Codex + Gemini CLI orchestration for sidecoach (large, scope-heavy). OMC's distinctive capability surfaced in the 2026-05-28 research is `omc team N:codex/gemini/claude` spawning real worker panes for different CLIs side-by-side via cmux's tmux-shim. Sidecoach currently spawns only Claude teammates. Adding Codex + Gemini means FULLY accommodating them, not a half-measure: (a) detect which CLI is available on PATH, (b) install/auth flow per CLI (codex login, gemini API key), (c) prompt-format adapter per CLI (each one has its own quirks - tool-use formats, system-prompt conventions, context limits), (d) output parser per CLI (the cmux pane integration sees stdout - need to parse each CLI's progress/completion signals), (e) capability map (which sidecoach flows can run on which CLI - design-domain flows likely Claude-only, generic refactor/research flows could fan out), (f) model-tier routing per CLI (each provider has its own Haiku/Sonnet/Opus analog), (g) cost-tracking per CLI, (h) graceful degradation when a CLI is missing. Start with a design memo before any code - the wrong abstraction here would lock sidecoach into a one-provider-only ceiling. Origin: omc-research team findings 2026-05-28.
