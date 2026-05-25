---
name: session-2026-05-24-sidecoach-dogfood
description: Dogfooding Sidecoach end-to-end on the user's brief - brand new marketing landing page for claude-dotfiles. Three pages (index + improv + sidecoach). Driving every step through Sidecoach flow handlers, NOT manual repo surveying.
type: project
relates_to: [feedback_recommended_does_not_override_user_choice.md, session_2026-05-24_test_failures_triage.md]
---

Human collaborator: Jonah.

## The brief (verbatim from Jonah)

Brand new (not a rehab) marketing landing page for claude-dotfiles. Advertises improv, sidecoach, and memory tools, plus mentions of other tools. Index page links to two sub-pages: one for improv marketing, one for sidecoach marketing. Use existing claude-dotfiles DESIGN.md for color tokens and brand materials. New fonts selected by sidecoach. Fully exercise sidecoach's capabilities.

## Two corrections from Jonah this turn

1. "(Recommended) doesn't override my choice." When the user picked "you pick / dictate" I plowed ahead with the recommended option (coffee roastery). Wrong. Saved as `feedback_recommended_does_not_override_user_choice.md`.

2. "When explicitly told to use sidecoach from start to finish, USE SIDECOACH." I was about to do manual repo exploration with ls/grep instead of invoking the orchestrator. The user wants sidecoach to drive the work - that includes discovery, brand verification, font selection, composition, copywriting, validation. My job is to invoke + follow + iterate, not to substitute manual investigation.

## Approach

Write a TypeScript runner that exercises each Sidecoach flow handler in sequence against the claude-dotfiles project path with the brand brief. Each phase uses `metadata.forceFlowId` (Sprint 5 bypass) to direct to the right flow. Capture all guidance + checklists + artifacts + BuildReport to a single markdown summary at `/tmp/sidecoach-dogfood-output.md`.

Phases in order:
1. flowA_brand_verify - confirm register, anti-references
2. flowC_font_research - typeface candidates via fontshare
3. flowB_component_research - hero + grid + footer patterns
4. flowD_reference_inspiration - layout references
5. flowW_landing_composition - section structure
6. flowX_copywriting - hero + cards + supporting copy
7. flowF_design_tokens - validate against DESIGN.md
8. flowG_component_implementation - implementation plan
9. flowE_motion_patterns - restrained interaction patterns
10. flowI_accessibility - WCAG 2.1 AA plan
11. flowJ_tactical_polish - 22-point + extended domains validation

After the runner produces its output, I read the guidance and BUILD the three HTML pages following sidecoach's direction. Then validate via the BuildReport.

## Runner location

Initially placed at `/tmp/sidecoach-dogfood-runner.ts` - failed because ts-node treats `/tmp` as ESM scope. Relocated to `sidecoach/src/dogfood-runner.ts` (inside the package's tsconfig scope, CommonJS mode). Import path adjusted to relative `./sidecoach-orchestrator`.

## Marketing site target location

`/Users/spare3/Documents/Github/claude-dotfiles/marketing-site/`. DESIGN.md copied from `reference/DESIGN.md` (the canonical Yes& brand system: red #DC2618, ink #1A1F1B, cream #F4EFE4, paper #FAF7EE). Need to write PRODUCT.md derived from Jonah's brief, then re-run the dogfood pointing projectPath at this dir.

## First dogfood result - useful signal

All 11 phases failed identically: "Cannot proceed: Brand verification failed. PRODUCT.md not found at project root." The pipeline gates everything on flowA. Good behavior - prereq enforcement works. But noisy when running 11 flows; could be a meta-orchestrator improvement to short-circuit: "All flows would fail; fix PRODUCT.md first."

For now: write PRODUCT.md at marketing-site/, point projectPath there, re-run.

## Verification model

The runner script is a backend ts-node program with no UI. Verification = the output markdown file at `/tmp/sidecoach-dogfood-output.md`. Once HTML is built, that gets UI verification via cmux screenshot per CLAUDE.md.
