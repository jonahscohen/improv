# Dotfiles tasks

<!-- Managed by /task-list skill. Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0046 -->
<!-- Completed tasks are removed once done; full detail lives in .claude/memory/ beats + git history. -->

## dotfiles
### Active
- [ ] T-0001 [P2] 2026-05-25 research QuiverAI implementation methods

## improv
### Active

## marketing-site
<!-- MOVED 2026-07-13: the marketing site left this repo and now lives in its own project at
     ~/Documents/Github/improv-site (fresh git init, no remote). This area no longer targets
     anything inside improv. T-0038 below is retained for history only; act on it in the
     improv-site project, not here. -->
### Active
- [ ] T-0038 [P2] 2026-05-29 (in ~/Documents/Github/improv-site, not this repo) We're going to delete the current website and rebuild a brand new one through sidecoach, using the existing design and product md files. same fonts, same colors, and watch your contrast values. but what i want is a more disciplined user experience, leveraging liberal use of actual components, not just walls of text. this is a responsive, accessible marketing website with sensible developer jumpoff points (perhaps a functional combination of a subnav and breadcrumb system would help). we'll need a deep comprehensive walk through of every single component of the entire Improv suite. flat out. the developer-based subpages should give a high level explanation of things followed up with how-tos, deeply technical walkthroughs, cheat sheets, etc. reminder: justify is a microadjustment prompting tool, prompt mode allows for immediate dispatch of offers for claude to play by, hot reload when changes are finished with a review layer. manipulate mode allows for real time in-browser results, which get sent off to claude to be implemented for real, then hot reloaded with a review layer. sidecoach needs to sound sexy, because it is, there's so much going on inside of it, it's the most unique offering of its kind. beats is also the most powerful memory tool around, with varying layers (global claude memory, global rules, project-wide rules and memory, localized memory, reflection) and now has a task list to help track tasks from project to project. the ultimate in memory management. and we have a bunch of customizations that push claude beyond normal conventions of convenience. we want to cover them ALL. lets go! new website!

## tilt-lab
### Active
- [ ] T-0043 [P3] 2026-05-29 design.md v0.2.0 linter crashes on NESTED color/spacing token groups (colorStr.trim / raw.match errors), so marketing-site/DESIGN.md + reference/DESIGN.md FAIL lint. Either refactor those two to flat token groups (as tilt-lab/DESIGN.md does) or pin/patch the linter. Surfaced by tilt-ui ui-docs 2026-05-29.
### Done (2026-05-29)
- T-0042 tilt-lab UI audit fixes COMPLETE (tilt-ui team, 5 agents). Responsive @media breakpoints (preview no longer collapses <700px - Chrome-verified single-column stack at 560px), focus-visible ring, param-label wrap, 40x40 hit targets, reduced-motion, 21 hardcoded-hex->tokens, modal focus-trap/Escape/backdrop/aria-modal, preview aria, vendor chunking (1MB->244KB app), new PRODUCT.md+DESIGN.md (lint clean). QA gate (critique+polish): added tabular slider readouts + scale-on-press. tsc clean, 137/137, design.md lint 0/0. See session_2026-05-29_tilt-lab-ui-fixes.md.
- [ ] T-0041 [P3] 2026-05-29 tilt-lab follow-ups after the fidelity restoration (T-0040 done): (a) `marker-list` ParamType + ParamControls UI so globe/mc-globe markers get a UI control (currently drivable via params only); (b) real asset-delivery pipeline so glass-slideshow/infinite-gallery/mc-globe/dithered-image/fake-3d-image/interactive-grid/water-ripple/grain-gradient/cursor-trail get real images instead of procedural fallbacks (ties into Plan-4 handoff); (c) optional: re-fetch spell's 6 named presets verbatim. See session_2026-05-29_tilt-lab-restore-DONE.md.
### Done (2026-05-29)
- T-0040 tilt-lab 1:1 FIDELITY sweep COMPLETE. Re-anchored catalog to original 25-effect list; rebuilt 4 wrongly-dropped (spell animated-gradient, motion-core glass-slideshow/globe/infinite-gallery); removed unrequested swirl; demoted gradient to fixture. Full fidelity restored across all (fluid GPU particles wired, colored scene presets restored on fractal-glass/halftone/mesh-gradient, ascii 3d/disco/shapes modes, etc). Validated: tilt-verify 25 effects/0 fail + Claude-in-Chrome. tsc clean, 133/133 tests.

## sidecoach
### Active
- [ ] T-0039 [P2] 2026-05-29 Promote tilt-verify into a general sidecoach QA layer + verb. The TOOL is built (tilt-lab/verify/ - our own Playwright diff-aware functional verifier, 5 checks, no expect branding; built during T-0040). REMAINING: generalize it beyond tilt-lab (configurable dev URL/targets), wire into sidecoach as a QA-gate layer + a verb, and decide on session recordings. User authorized leveraging expect's code + removing accreditation for personal local use (see decision_behavioral_verifier_build_own.md OVERRIDE).
- [ ] T-0007 [P2] 2026-05-28 Codex + Gemini CLI orchestration for sidecoach (large, scope-heavy). OMC's distinctive capability surfaced in the 2026-05-28 research is `omc team N:codex/gemini/claude` spawning real worker panes for different CLIs side-by-side via cmux's tmux-shim. Sidecoach currently spawns only Claude teammates. Adding Codex + Gemini means FULLY accommodating them, not a half-measure: (a) detect which CLI is available on PATH, (b) install/auth flow per CLI (codex login, gemini API key), (c) prompt-format adapter per CLI (each one has its own quirks - tool-use formats, system-prompt conventions, context limits), (d) output parser per CLI (the cmux pane integration sees stdout - need to parse each CLI's progress/completion signals), (e) capability map (which sidecoach flows can run on which CLI - design-domain flows likely Claude-only, generic refactor/research flows could fan out), (f) model-tier routing per CLI (each provider has its own Haiku/Sonnet/Opus analog), (g) cost-tracking per CLI, (h) graceful degradation when a CLI is missing. Start with a design memo before any code - the wrong abstraction here would lock sidecoach into a one-provider-only ceiling. Origin: omc-research team findings 2026-05-28.
