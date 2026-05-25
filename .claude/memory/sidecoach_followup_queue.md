---
name: sidecoach-followup-queue
description: Ordered queue of Sidecoach + dotfiles followups after Sprint 6 close. Currently working on the carryover sweep (item 1); items 2-4 are queued.
type: project
relates_to: [session_2026-05-24_sprint6_closed.md, session_2026-05-24_multiple_choice_third_failure_fix.md]
---

Human collaborator: Jonah.

Established 2026-05-24 after Sprint 6 close. Jonah picked the carryover sweep first, with explicit instruction "but please don't forget the other tasks." This file is the persistence layer for that promise.

## Order of operations

### 1. Carryover sweep (IN PROGRESS)

Three small loose ends from Sprints 2-4:

- **Wire flowW + flowX into intent-detector.ts.** Currently the landing-composition (flowW) and copywriting (flowX) flows are reachable only via composite presets and direct flowId. Natural-language utterances like "compose landing page" or "draft hero copy" do not route to them. Need to add triggers + confidence rules in `sidecoach/src/intent-detector.ts` and write tests.

- **Fix composite slash-command parser colon/space inconsistency.** Help text in `sidecoach-orchestrator.ts:480-482` advertises `composite:composite_X` syntax. The actual parser regex `^/(?:sidecoach\s+)?(\w+)(?:\s+(.*))?$` uses `\w+` which does NOT span colons. Either update help text to match the working space syntax or update the parser regex to accept colon. Decide during brainstorm.

- **Consume unstructured-validator output into BuildReport.** Today `build-report-aggregator.ts` only reads structured FlowMemoryEntry data (`validationResults`, `metrics`, `gates`). The ClaudemdMandate, PolishStandard, and Taste validators emit guidance lines in `result.guidance` / `result.message`. Parse those into BuildReport findings so they contribute to the verdict.

### 2. Push local main to origin (DONE 2026-05-24)

92 commits pushed to origin/main (last commit 8db330c). Sprint 7 close included. Initial push required HTTPS workaround (SSH key not configured on this machine). After the push, native git push/fetch were fixed: remote URL switched from SSH to HTTPS via `git remote set-url`, and `gh auth setup-git --hostname github.com` wired gh's keychain-stored token as the credential helper for github.com. Both global config (`~/.gitconfig`) and per-repo remote persist.

### 3. Sync repo claude/settings.json to live state (DONE 2026-05-24, commit 89382ac)

Hooks + permissions + enabledPlugins merged from live. Filters: excluded nyx telemetry, normalized absolute paths, stripped personal-preference top-level keys (mcpServers, voice, voiceEnabled, effortLevel). Decisions: enabledPlugins from REPO (more curated, matches CLAUDE.md); model updated to claude-opus-4-7[1m] (was outdated 4.6); reflect-nudge.sh added to both repo AND live (was in repo only, user authorized adding to both). Result: 27 hooks across 8 events. Fresh-machine installs now get current state.

### 4. Tackle 16 pre-existing sidecoach test failures (QUEUED)

Failing since 2026-05-22/23, never fixed. Mix of architectural drift and incomplete refactors:

**From Sprint 5 baseline (always-failing 9):**
- phase-f-integration
- phase-f-integration-full
- phase-g-block4-performance
- phase-h-block1-composition
- phase-h-block7-flow-validator-integration
- phase-i-block3-context-tracking-e2e
- phase3-completion
- task8-list-command-taxonomy
- validator-integration

**Not previously enumerated (7):**
- flows-a-i-memory-integration
- orchestrator-slash-command
- slash-command
- task9-teach-command
- task10-flow-n-improv
- task11-interactive-menu

Need triage: each failure could be a real bug, an outdated test against current code, or test infrastructure rot (e.g. requires real DESIGN.md / PRODUCT.md / Anthropic API key). For each: investigate, classify (real-bug / outdated-test / infrastructure), fix where reasonable, document deliberate-skip where not.

Probably 1-2 sprints depending on what surfaces. Do AFTER pushing to origin so the push isn't blocked on test investigation.

## Discipline

When the user says "what's next" or similar, consult this file first. If the user says "carryover done, next" - move to item 2. If they say "do all of it" - work through 1 -> 2 -> 3 -> 4 in order. If they pivot to something else, this queue holds until they return.
