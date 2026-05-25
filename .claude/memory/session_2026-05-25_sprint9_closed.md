---
name: session-2026-05-25-sprint9-closed
description: Sprint 9 (3 dogfood bug fixes) closed. PRODUCT.md parser reads teach v2 format, designTokens auto-loaded from DESIGN.md, chain continues past errored flows. 72/72 tests green. Dogfood re-run confirms all 3 fixes work.
type: project
relates_to: [session_2026-05-25_sprint9_design.md, session_2026-05-25_dogfood_retry.md, session_2026-05-25_sprint8_closed.md]
---

Human collaborator: Jonah.

## What this sprint landed

4 task commits + close on `main` since Sprint 8:

- T1 `9ad589d` - PRODUCT.md parser recognizes teach v2 section-header format. parseMarkdownFrontmatter extended with a post-processing pass that reads `## Register / ## Primary Users / ## Brand Personality / ## Anti-References / ## Strategic Principles` sections. Backwards compatible.
- T2 `897342b` - designTokens auto-load at top of engine.process(). buildProjectContext is called; if parsedDesignTokens exist and caller hasn't pre-staged metadata.designTokens, the parsed tokens are copied in. Implementer also extended flow-prerequisites.ts to consult context.metadata as a fallback (necessary for the fix to work end-to-end). Soft-fails on parser failure.
- T3 `76f796e` - chain executor wraps each flow's execute in try/catch. On error, push error-status FlowExecutionResult and continue the loop. On canExecute=false, push skipped-status. Top-level success aggregation already used `.some()` semantics so no change needed there.

## Test count

72 PASS, 0 FAIL. tsc --noEmit exit 0.

- 69 baseline from Sprint 8 close
- +3 new Sprint 9 tests: sprint9-product-md-parser (6 assertions), sprint9-design-tokens-autoload (5 assertions), sprint9-chain-continues-past-errors (5 assertions)
- No pre-existing test assertion adjustments needed (top-level success already used `.some()`)

## Behavior contract changes

- ContextLoader.load() now recognizes PRODUCT.md in teach v2 section-header format. Existing YAML-style or key:value-style PRODUCT.md files still parse via the existing path.
- engine.process() auto-stages context.metadata.designTokens from DESIGN.md when DESIGN.md is present and caller hasn't pre-staged. Explicit caller metadata wins.
- flow-prerequisites.ts::validateContextRequirements now consults `context.metadata[req]` as a fallback when `context[req]` is absent.
- Chain executor (for impeccable verb commands) does NOT halt on a flow error. Errored flows produce error-status FlowExecutionResults; downstream flows still attempt.

## Dogfood comparison (Sprint 8 -> Sprint 9)

**Sprint 8 dogfood result:** `/sidecoach craft marketing-site` showed 4 flowResults, flowA register empty, flowF errored "Missing context: designTokens".

**Sprint 9 dogfood result (`/tmp/sidecoach-craft-output.md`, 544 lines):**
- Top-level: success=true, "Executed craft flow chain (4/4 flows successful)"
- flowA: "Brand register detected: brand. Design laws cached." Register=brand correctly parsed. Users field correctly extracted from teach v2 section.
- flowF: success, "Design tokens validated: 20 sections across all 7 domains". Reads real DESIGN.md values: Brand red #DC2618, brand ink #1A1F1B, border-radius 4px/8px, cubic-bezier motion easing, Source Serif 4 display family.
- flowG: success, component implementation with 8 interaction states.
- flowJ: success, tactical polish 16-point checklist.
- 4 of 4 flows successful (vs 3 of 4 in Sprint 8).

All 3 targeted bugs are demonstrably fixed.

## Bug surfaced during dogfood verification (filed for Sprint 10)

The impeccable registry's craft entry declares 5 flowIds: `[flowF, flowG, flowH, flowI, flowJ]`. Sprint 9's dogfood + T3 test both observe only 4 flows actually running: `[flowA prereq, flowF, flowG, flowJ]`. flowH (motion-integration) and flowI (accessibility) are missing from the chain output.

Possible causes (Sprint 10 should investigate):
- Handlers for flowH or flowI may not be registered in the engine's handlers map
- A filter before the chain loop may be excluding them
- The `canExecute` prerequisite check may fail silently for those handlers

Sprint 9 T3's continue-past-errors fix means even if flowH/I error, they'd appear in results with status='error'. They're NOT appearing at all - which means the chain executor never even reaches them. Different bug from what T3 targeted.

This is a HIGH-confidence bug to investigate first in Sprint 10. The fact that both Sprint 8 dogfood AND Sprint 9 dogfood showed only 4 flows means it's not a recent regression - it's been latent since Sprint 8.

## Out of scope / future (Sprint 10 + beyond)

- Investigate why flowH and flowI aren't appearing in the craft chain (filed above)
- BuildReport verdict shows "(none)" for impeccable verb chains - metadata.emitBuildReport may not propagate through the chain executor path
- Refactoring ContextLoader (in project-context.ts) and buildProjectContext (in context-loader.ts) into a single context system - they currently duplicate
- Dependency-aware chain execution (e.g. flowG declares "requires designTokens"; if flowF errored, flowG skips automatically)
- flowA still shows "Personality: " empty in output even though PRODUCT.md has the Brand Personality section - parser captures `brandpersonality` lowercased key but flowA reads a different key. Minor parser/consumer mismatch.

## Local main state

Local main +6 commits ahead of origin since Sprint 8 close (Sprint 8 close was at `2f3d749`; Sprint 9 adds spec + plan + 3 task commits + close = 6). To push after the close commit lands.

## Next on the queue

The marketing-site dogfood NOW produces a useful end-to-end run. Resume the original task: write the 3 HTML pages (index, improv, sidecoach) following the sidecoach guidance from flowG (component implementation rules) + flowJ (tactical polish 16-point checklist) + DESIGN.md tokens. Then run `/sidecoach audit` + `/sidecoach polish` + `/sidecoach critique` on the built pages. Sprint 10 (flowH/I investigation) can wait OR run before the build if motion + a11y guidance is needed up front.
