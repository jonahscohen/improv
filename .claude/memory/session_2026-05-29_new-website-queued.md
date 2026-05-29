---
name: New marketing website rebuild queued (T-0038)
description: Next major initiative - delete the current marketing-site and rebuild it via sidecoach, component-driven, with comprehensive per-feature developer docs for the whole suite
type: project
relates_to: [session_2026-05-29_endow_to_justify_rename.md]
---

Collaborator: Jonah. Queued 2026-05-29 as marketing-site T-0038 (full brief is in TASKS.md).

## The initiative
Delete the current website, rebuild a brand-new one THROUGH sidecoach (run the design pipeline on it). Not a tweak - a ground-up rebuild.

## Hard constraints (must honor)
- Reuse the EXISTING PRODUCT.md + DESIGN.md. SAME fonts, SAME colors. Watch contrast values (WCAG).
- Disciplined UX: liberal use of ACTUAL components, not walls of text.
- Responsive + accessible.
- Sensible developer jumpoff points - explore a functional subnav + breadcrumb system.
- Comprehensive: a deep walkthrough of EVERY component of the entire claude-dotfiles suite. Flat out, cover them ALL.
- Developer subpages structure: high-level explanation -> how-tos -> deeply technical walkthroughs -> cheat sheets.

## Messaging notes (the voice for each pillar)
- justify: microadjustment prompting tool. PROMPT mode = immediate dispatch of "offers" for Claude to play by, hot reload when done + a review layer. MANIPULATE mode = real-time in-browser results, sent to Claude to implement for real, then hot-reloaded + review layer.
- sidecoach: must sound SEXY - the most unique offering of its kind; emphasize how much is going on inside it.
- beats: the most powerful memory tool around - layered (global Claude memory, global rules, project-wide rules + memory, localized memory, reflection) + now a task list spanning projects. The ultimate in memory management.
- customizations: the bunch of harness customizations that push Claude beyond normal conventions of convenience - cover them all.

## Approach when picked up
This is a sidecoach-led design build (PRODUCT.md + DESIGN.md already exist - confirm they pass the setup gate). DESIGN.md must conform to the Google spec; generated UI references tokens, not hardcoded hex. Run the QA gate (audit -> critique -> polish + make-interfaces-feel-better + design.md lint). Component-first per the brief. Likely a multi-section / multi-subpage build -> a design-team or design-build orchestration fits. Big enough to warrant scoping/brainstorm before building.
