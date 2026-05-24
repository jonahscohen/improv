---
name: session-2026-05-24-sprint1-plan-approved
description: Sprint 1 plan (Foundation + Quick Wins) drafted via writing-plans skill, approved via ExitPlanMode; 13 tasks ready to execute
type: project
relates_to: [session_2026-05-24_landing_page_built.md, session_2026-05-24_taste_validator_built.md]
---

Following yesterday's landing-page build + retrospective (12 improvement notes), formalized Sprint 1 as an "official plan" via the writing-plans skill. Plan saved at `/Users/spare3/.claude/plans/misty-jingling-plum.md`. Jonah approved via ExitPlanMode.

## Sprint 1 scope: Foundation + Quick Wins

Pairs Phase 1 (auto-inject PRODUCT.md/DESIGN.md context, items 4 + 5) with four quick wins:
- 2.1: Bundle Lucide icon paths in icon-source-reference
- 2.4: `sidecoach artifacts <flow-id>` CLI for flow discoverability
- 4.3: `taste/observer-race` rule catching the IntersectionObserver-stuck-invisible race
- 6.1: Intent detector tie-breaking via existing `recommendation` field

## 13 tasks, TDD throughout

1. Add js-yaml dependency
2. Build design-md-parser (typed DesignTokens from frontmatter)
3. Extend ProjectContext with parsedTokens + TechStack + detectTechStack()
4. Wire context-loader.buildProjectContext() to populate parsed tokens + tech stack
5. Orchestrator auto-injects loaded context into FlowExecutionContext.metadata before handler dispatch
6. Pattern: cite DESIGN.md lines in flow-handler-design-tokens (canonical example for future rollout)
7. Build project-drift-detector (flags net-new CSS tokens not in DESIGN.md)
8. Bundle 50+ verbatim Lucide icon paths via build script
9. Add icon-source-reference.getIconSource(library, name) backed by bundle
10. Build sidecoach-artifacts CLI
11. Add taste/observer-race rule to taste-validator
12. Intent detector tie-breaking
13. End-to-end smoke + drift integration test

## Key ground-truth findings from Explore agent

These shaped the plan and would have been wrong assumptions otherwise:
- TWO ProjectContext types exist (context-loader.ts lightweight + project-context.ts rich) - plan extends both rather than building new
- DisambiguationResult already has a `recommendation` field - tie-break is plumbing not new structure
- `needs_input` status type exists but unused - checkpoint pattern (Sprint 5) can build on it
- No external YAML parser (js-yaml etc.) in the codebase - plan adds it
- Test infra is `ts-node` not jest, tests in `src/__tests__/`
- FlowHistory persists to `~/.claude/sidecoach-flow-history.json`, append-only, no compareToPrevious() yet (Sprint 4 work)

## Hook collision

The CLAUDE.md no-emdashes/endashes rule fired during first plan write attempt. Rewrote with hyphens or rephrased. Worth noting because plan documents naturally invite long-dashes - future plans should be drafted with that constraint in mind from the start.

## Roadmap (5 future sprints, each its own plan)

- Sprint 2: Phase 3 composition + copywriting flows (the headline creation gap, ~12 tasks)
- Sprint 3: Phase 4 stack-aware motion (~4 tasks)
- Sprint 4: Phase 5 graded validation + build report (~10 tasks)
- Sprint 5: Phase 6 checkpoint mechanism + intent disambiguation UI (~8 tasks)
- Rolling: DESIGN.md citation pattern across remaining 25+ flow handlers

## Files

- Plan: `/Users/spare3/.claude/plans/misty-jingling-plum.md`
- Will produce 11 new + 8 modified files in `sidecoach/` when executed