---
name: design-build skill - the pipeline orchestrator
description: New skill that runs the design pipeline as ONE coordinated build, addressing the empirical finding from 2026-05-20 that individual design skills did not auto-trigger reliably and the QA triad never fired without orchestration. Triggers only on explicit invocation - no generic UI keyword auto-trigger.
type: project
relates_to: [session_2026-05-20_marketing-site-retrospective.md, session_2026-05-20_marketing-site-pipeline-test.md]
---

## What shipped (2026-05-20)

A new bundled skill at `claude/skills/design-build/SKILL.md` (symlinked to `~/.claude/skills/design-build/`). Single-command orchestrator for the design pipeline.

Jonah picked option (b) from my retrospective conclusion: "Build a design-build routing skill that explicitly invokes all the layers in sequence when starting a UI build."

## Why this skill exists

The 2026-05-20 marketing-site build was the first time the design pipeline ran on a real UI task. Retrospective showed:

1. Of 8 documented pipeline steps, only 2 fired as skills (fontshare-reference's reject list, motion-reference's canonical snippets)
2. component-gallery-reference, design-references, icon-source never auto-triggered
3. The QA triad (/impeccable audit + critique + polish) never ran
4. make-interfaces-feel-better only fired because I'd read it recently, not via auto-trigger

The keyword-auto-trigger mechanism is unreliable for orchestration. The QA triad needs explicit invocation. This skill solves both.

## What design-build does (10 phases)

| Phase | What runs |
|-------|-----------|
| 0. Pre-flight | PRODUCT.md (required) + DESIGN.md (nudge-once if missing) |
| 1. Strategy | Compose brief direction. **GATE CHECKPOINT 1** via AskUserQuestion. |
| 2. Research | component-gallery-reference workflow per component |
| 3. References | grep ~/.claude/design-references/ catalog |
| 4. Typography | fontshare-reference workflow IF type decisions in scope |
| 5. Motion | motion-reference patterns IF animation/scroll in scope |
| 6. Icons | icon-source protocol IF icons needed |
| 7. Build | apply make-interfaces-feel-better's 14 rules DURING construction |
| 8. **QA triad (MANDATORY)** | /impeccable audit + critique + polish |
| 8b. **GATE CHECKPOINT 2** | AskUserQuestion on QA findings |
| 9. Verification | cmux browser, screenshots, real-input testing |
| 10. Memory | session memory with phases fired/skipped + friction |

## Key design decisions

1. **Explicit trigger only.** Description lists only the canonical invocations (`/design-build`, "run the design pipeline for X", etc.) AND explicitly warns NOT to auto-trigger on generic UI words ("build a button"). Avoids the over-triggering problem the other skills had.

2. **Read-and-apply, not auto-coordinate.** This skill READS the other design skills (component-gallery-reference, fontshare-reference, etc.) and applies their workflows inline. Doesn't rely on them auto-triggering alongside.

3. **Two gate checkpoints, not 10.** Strategy gate (after Phase 1) and QA findings gate (after Phase 8). Other phases flow automatically so the build doesn't death-by-AskUserQuestion.

4. **QA triad is non-skippable.** If impeccable can't run, the skill must record "QA triad SKIPPED because <reason>" in memory explicitly. No silent skipping.

5. **Failure modes named upfront.** Skill includes a "Failure modes to expect" section pulled from the marketing-site retrospective: data-reveal brittleness, CDN ESM imports (use esm.sh not skypack), Lenis + cmux scroll conflict, hero entrance race with Lenis init.

## Trigger language (explicit only)

- `/design-build` (with or without arg)
- "run the design pipeline for X"
- "design-build this"
- "kickoff a design build"
- "walk the pipeline on X"
- "run the full design pipeline"
- "use the design stack on X"

Explicit NEGATIVE list in the description: do NOT trigger on "build a button" / "add a hover state" / "fix this layout" / pure copy or motion or tactical changes - those route to individual skills directly.

## Wiring TODO (not yet done in this session)

- install.sh - 5 spots (header comment, picker description, file list, deactivate, install block)
- claude/CLAUDE.md - add to design stack diagram between Design and Tactical layers

The skill is already symlinked from `~/.claude/skills/` so it's live for this machine. Cross-machine portability requires install.sh wiring.

## Verification note

Skill files are markdown - no UI to screenshot. The hook fires "CODE DEPLOYED/BUILT, verify before reporting" but for a markdown skill the verification is reading the file content, which is in context. No screenshot mandate applies.

## Files touched

- `claude/skills/design-build/SKILL.md` (canonical)
- `~/.claude/skills/design-build/SKILL.md` (active)

## Collaborator

Jonah
