---
name: sidecoach-stage1-integration-surface
description: Grounded map of the Stage-1 integration seam (rendered scanner -> run-validator registry rules) + the decisive finding that resolves the PLAN's "replace the eval-only scanner call" ambiguity - eval is a SEPARATE SUBPROCESS, so leave it untouched ("one module, two callers" not "one call site").
type: reference
relates_to: [session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, session_2026-06-24_sidecoach-S5-integration-gap-and-plan.md]
---

Collaborator: Jonah Cohen. Grounded by reading the actual code 2026-06-24 (pre-build, while Codex adversarial review runs).

## THE EVAL/LIVE SEPARATION (decisive - resolves a PLAN ambiguity)
`eval/scorecard-collect.mjs:27` does `runDetached('node', [SIDECOACH_SCAN, file, mode])` - it spawns `eval/sidecoach-scan.mjs` as a **detached subprocess**. That script (`process.argv[2]`=file, `[3]`=mode) `import()`s the COMPILED DIST modules (`dist/validators/objective-rendered-scanner.js`, `.../subjective-rendered-scanner.js`) and calls `scanObjectiveRendered(html)` / `scanSubjectiveRendered(html)` directly on an HTML STRING read from a corpus file. FAIL-CLOSED: objective-mode unavailable -> `process.exit(3)` (page's GT counts as FN, never false clean).

**Consequence**: the PLAN's phrasing "ONE memoized scan invoked from run-validator, replacing... the eval-only scanner call" is best read as **one scanner MODULE with TWO callers** (eval subprocess + live run-validator), NOT one shared call site. Rewiring eval THROUGH run-validator would be needless blast radius on a separate process and risks the very eval regression the GATE forbids. SAFEST detection-preserving path: **leave eval/sidecoach-scan.mjs UNTOUCHED**; only ADD a live caller of the same scanner. Zero eval regression by construction. (Pending Codex concurrence.)

**Corollary on the render-identical-to-referee guarantee**: that guarantee validates EVAL numbers, and eval is untouched -> the LIVE render basis does NOT need to match the referee byte-for-byte. It must faithfully detect on the live target. So the live path may relax the scanner's hermetic render (e.g. allow SAME-ORIGIN CSS via the collector's `isSubresourceAllowed`) without touching eval validity. (The hermetic scanner aborts ALL external incl. same-origin CSS - fine for the self-contained inline eval corpus, but a live site with EXTERNAL stylesheets would render UNSTYLED under the hermetic basis = a real live-path concern to handle, flagged for Codex.)

## THE INTEGRATION SEAM (exact)
- Live entry: `run-validator.ts runDetailed()` - after `collectBrowserEvidence(renderUrl)` (which navigates via `page.goto`), it runs each owned registry rule's `checkProduct(ctx)`. The ctx is built by `toCheckContext()`.
- Memoized scan home: do ONE `scanObjectiveRendered` + `scanSubjectiveRendered` in `runDetailed` (after collectBrowserEvidence), store in a local, thread it into `toCheckContext` so rendered-scan rules read it. Keyed per runDetailed call (one target) -> no cross-target leak.
- Thread-through: add an optional field to `ProductCheckContext` (check-context.ts:46), e.g. `renderedScan?: { objective: ObjectiveScan; subjective: SubjectiveScan }`.
- Rule shape: registry rules live in `RAW_RULES` (product-rule-registry.ts) + a verdict fn in `CHECKS` (validators/checks, keyed by `canonicalRuleKey`). `RULES = RAW_RULES.map` attaches the checkProduct wrapper (looks up CHECKS[key], stamps metadata, catches throws as inconclusive/rule_exception).
- Execution path: rendered-scan rules should be NON-statically-satisfiable (like the existing dom/contrast rules: `a11y.min-hit-area` evidenceRequirements ['dom'], `a11y.color-contrast` ['contrast']). `executeRule` routes `isStaticallySatisfiable===false` rules through a branch that runs checkProduct ONCE with the browser/scan context (run-validator.ts:106-118). Add a new EvidenceKind (e.g. 'rendered-scan') that is non-static.
- Codegen + golden: after adding rules, regenerate `validators.generated.ts` (`scripts/generate-validators.ts`), update golden `product-rule-registry.test.ts` (currently asserts `RULES.length===31` at ~line 200).

## THE 6 NEW RULE CLASSES (Stage 1)
Objective (5): broken-image, skipped-heading, low-contrast, gray-on-color, justified-text. Subjective (1): tiny-text (precision-safe-partial; nested-cards stays DEFERRED for a negative top-up).
Dedupe: `a11y.color-contrast` (evidenceRequirements ['contrast'], owner static-a11y, scope component, applicability inconclusive, severity blocker @ product-rule-registry.ts:392) overlaps the scanner's low-contrast -> collapse per PLAN. CARE: this is a behavior change + drops the golden count by 1 unless re-added as the scanner rule; let Codex rule on whether to retire vs re-point.

## Files referenced
- src/validators/run-validator.ts (runDetailed ~231, executeRule ~95, toCheckContext ~24)
- src/validators/objective-rendered-scanner.ts (scanObjectiveRendered ~341, RenderOpts.abortExternal ~319), subjective-rendered-scanner.ts (scanSubjectiveRendered ~198)
- src/validators/browser-evidence-collector.ts (collectBrowserEvidence ~54 goto ~88, isSubresourceAllowed ~33)
- src/validators/check-context.ts (ProductCheckContext ~46), src/product-rule-registry.ts (RAW_RULES, CHECKS import ~4, wrapper ~538), src/validators/checks/* (CHECKS map)
- eval/sidecoach-scan.mjs (~50-75), eval/scorecard-collect.mjs (~27 spawn)
