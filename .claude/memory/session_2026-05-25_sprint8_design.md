---
name: session-2026-05-25-sprint8-design
description: Sprint 8 (Sidecoach Impeccable parity + Teach rebuild) brainstorming + design spec. Surfaced by dogfood failure 2026-05-24 - sidecoach claimed full impeccable replacement but teach was a stub and 20+ impeccable verb commands had no slash routes.
type: project
relates_to: [session_2026-05-24_sidecoach_dogfood.md, feedback_recommended_does_not_override_user_choice.md, sidecoach_followup_queue.md]
---

Human collaborator: Jonah.

## The trigger

Late 2026-05-24, during the marketing-site dogfood, all 11 sidecoach flows refused with "PRODUCT.md not found at project root." Investigation found:

1. `/sidecoach teach` exists but is a hardcoded stub. The source code literally comments `// Simulate interactive walkthrough responses (in real impl, would be user input)` and writes the same boilerplate every time.
2. Sidecoach has 15 slash commands using a PHASE vocabulary (research, craft, implement, review, etc), not impeccable's 23 verb vocabulary (animate, colorize, polish, audit, document, etc).
3. Prior session memories (`session_2026-05-23_sidecoach_100_complete.md`, etc) claimed sidecoach fully replaced impeccable. That claim was inaccurate.

Jonah was rightly furious. He'd spent significant time and money expecting the system to be what its memories claimed. Directives:

- Fix all the gaps; make sidecoach BETTER than impeccable
- No building anything real / no dogfooding until sidecoach is actually complete
- All implementation work via Opus only (no haiku or sonnet on this)

## Scope decisions resolved during brainstorming

- **Vocabulary strategy:** ADD impeccable's 22 verb commands alongside sidecoach's existing 15 phase commands. Both vocabularies remain valid. No breaking changes.
- **Teach mode:** hybrid - parse brief first, ask follow-up questions only for fields the brief did not answer with confidence.
- **Acceptance bar:** parity-plus per command. Each must include impeccable's checklist items PLUS at least one sidecoach-specific addition (validator, BuildReport hook, memory tracking).
- **Architecture:** registry + thin verb-handlers. Matches existing sidecoach patterns (PRESET_COMPOSITE_FLOWS, FLOW_DETECTORS).
- **Execution:** one mega-sprint, single accountability point, subagent-driven-development with Opus only.

## Spec location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/specs/2026-05-25-sidecoach-sprint8-impeccable-parity-design.md`

## Plan size

10 tasks estimated:
- T1: Registry skeleton + types + 5 prototype entries
- T2: Slash-router branch + tests for 5 prototype routes
- T3: Teach V2 handler + 7-scenario test
- T4: Document command handler + lint test
- T5: Remaining 17 registry entries
- T6: Parameterized parity test for all 22 verbs
- T7: Orchestrator guidance-append callback
- T8: list + help command expansion
- T9: Documentation sync (SKILL.md, README, install.sh)
- T10: Sprint close

## Risk flags

- High: impeccable source path locally available so parityChecklist can be derived from real skill files.
- Medium: `live` verb depends on Improv MCP - may need to ship as stub-with-error if integration is incomplete.
- Medium: 22 entries × parity-plus = many literal strings to maintain. Mitigation: registry entries reference `impeccableSkillPath` for future drift-audit.
- Low: `@google/design.md` lint may not be installable in CI; document command degrades to structural-validity check if so.

## Two corrections I'm carrying into this work

1. (Recommended) does not override the user's explicit selection. From `feedback_recommended_does_not_override_user_choice.md`.
2. When explicitly told to USE sidecoach end to end, USE it - don't fall back to manual surveying. Captured in `session_2026-05-24_sidecoach_dogfood.md`.

## Next step

User reviews the spec file, approves or requests changes, then writing-plans skill writes the 10-task implementation plan.

## Plan written (2026-05-25)

Implementation plan saved to `/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/plans/2026-05-25-sprint8-impeccable-parity.md`.

10 tasks: T1 registry skeleton + 5 prototype entries; T2 slash-router branch; T3 teach V2 + 7-scenario test; T4 document handler + lint-pass test; T5 remaining 17 registry entries; T6 parameterized parity test for all 22 verbs; T7 orchestrator guidance-append callback; T8 list + help command expansion; T9 docs sync; T10 sprint close.

Each task has TDD steps with concrete code blocks, exact commands, and four-bash-call commit pattern. All implementer dispatches must use `model: "opus"`.

Plan size estimate: ~1500 lines, comparable to Sprint 6/7 plans. Sprint completion expected to add ~70 tests to the suite (from 64 baseline to 70).

Ready for execution via subagent-driven-development with Opus only.
