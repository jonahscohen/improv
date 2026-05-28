---
name: sidecoach-followup-queue
description: Ordered queue of Sidecoach + dotfiles followups after Sprint 6 close. Currently working on the carryover sweep (item 1); items 2-4 are queued.
type: project
relates_to: [session_2026-05-24_sprint6_closed.md, session_2026-05-24_multiple_choice_third_failure_fix.md]
---

Human collaborator: Jonah.

Established 2026-05-24 after Sprint 6 close. Jonah picked the carryover sweep first, with explicit instruction "but please don't forget the other tasks." This file is the persistence layer for that promise.

## Order of operations

### 1. Carryover sweep (DONE 2026-05-27, verified by Jonah)

All three loose ends closed in commits between 2026-05-24 and 2026-05-27. Verified by grepping current code (`main`, commit 128a9c1):

- **Wire flowW + flowX into intent-detector.ts.** DONE. `flowW_landing_composition` at `intent-detector.ts:740`; `flowX_copywriting` at line 754 with triggers `copywriting`, `copy`, `draft copy`, `headline`, `hero copy`, `section copy`, `marketing copy`, `tagline`.

- **Fix composite slash-command parser colon/space inconsistency.** DONE. Parser regex moved to `slash-command-router.ts:38` and now reads `^\/(?:sidecoach\s+)?(\w+)(?::([\w-]+)|\s+(.*))?$` - explicitly accepts both `composite:foo` and `composite foo`. Help text at `sidecoach-orchestrator.ts:873-875` advertises the colon syntax and the parser handles it.

- **Consume unstructured-validator output into BuildReport.** DONE in Sprint 7 T6. `build-report-aggregator.ts:138-160` reads `result.validationResults` (flow-composition ValidationResult shape) from ClaudemdMandate / PolishStandard / Taste validators pushed by the orchestrator. Severity scales by pass rate (>=90% info, 70-89% warning, <70% blocking). The header comment at lines 4-5 still says "out of scope" but is stale - the code below contradicts it. Minor doc-debt to clean up but functionally complete.

### 2. Push local main to origin (DONE 2026-05-24)

92 commits pushed to origin/main (last commit 8db330c). Sprint 7 close included. Initial push required HTTPS workaround (SSH key not configured on this machine). After the push, native git push/fetch were fixed: remote URL switched from SSH to HTTPS via `git remote set-url`, and `gh auth setup-git --hostname github.com` wired gh's keychain-stored token as the credential helper for github.com. Both global config (`~/.gitconfig`) and per-repo remote persist.

### 3. Sync repo claude/settings.json to live state (DONE 2026-05-24, commit 89382ac)

Hooks + permissions + enabledPlugins merged from live. Filters: excluded nyx telemetry, normalized absolute paths, stripped personal-preference top-level keys (mcpServers, voice, voiceEnabled, effortLevel). Decisions: enabledPlugins from REPO (more curated, matches CLAUDE.md); model updated to claude-opus-4-7[1m] (was outdated 4.6); reflect-nudge.sh added to both repo AND live (was in repo only, user authorized adding to both). Result: 27 hooks across 8 events. Fresh-machine installs now get current state.

### 4. Tackle pre-existing sidecoach test failures (DONE 2026-05-24)

Sweep with exit-code-based detection revealed the actual count was 3, not 16 (prior count was a grep artifact). All 3 fixed: 2 outdated test assertions (phase-h-block1-composition expected 3 composites but Sprint 2 added a 4th; validator-integration expected 90 and 112 rules but Sprint C expanded to 137 and 159). 1 real handler bug (design-references / design-tokens / accessibility handlers omitted guidance + checklist in their error-return paths, which would crash downstream consumers - all three now include `guidance: []` and `checklist: []`).

Result: **64 PASS, 0 FAIL.** tsc clean. See session_2026-05-24_test_failures_triage.md for full breakdown.

### 4-original. Tackle 16 pre-existing sidecoach test failures (HISTORICAL)

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
