---
name: sprint3-process-path resolved - reference DESIGN.md fixture lint fix
description: The pre-existing red sprint3-process-path test was a feature/data regression (reference/DESIGN.md failed lint, silently blocking flowF), NOT a stale test; fixed the fixture, citation restored, ready to gate.
type: project
relates_to: [session_2026-07-26_tail-cleanup.md, session_2026-07-25_routing-consolidation.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + independent-claude-review. LEAD-INTEGRATED 2026-07-26: re-verified the 1-line fixture fix (reference/DESIGN.md none "0"->"0px") + sprint3-process-path PASS; gated it (167 suites); ALSO aligned the 4 latent benchmark fixtures A flagged (benchmarks/fixtures/{brand-studio,form-stress,saas-dashboard,scroll-landing}/DESIGN.md none "0"->"0px") to prevent the same silent-block if they're ever linted. Committed + pushed.
confidence: high
---

Resolved the one pre-existing red test `sidecoach/src/__tests__/sprint3-process-path.test.ts` end to end. It was deferred (ungated) as a feature-vs-test call in the tail-cleanup pass; this closes that call.

## Determination: FEATURE/DATA-SIDE REGRESSION, not a stale test

The citation SHOULD appear; it stopped because the canonical reference fixture drifted out of lint-compliance and silently tripped an intentional gate. The test's expectation is correct and was NOT weakened. No product code and no test file changed - the fix is a one-line data correction in the fixture.

## Root cause (traced, evidence-backed)

The test drives `engine.process('lint design.md', { projectPath: reference/, projectContext: { register: 'brand' } })` and asserts the aggregate guidance contains `/Source: DESIGN\.md L\d+/`.

1. That citation is emitted by flowF (`flow-handler-design-tokens.ts` ~L52-58): `cite()` -> `findTokenLine(designContent, dottedPath)`, emitted only when line > 0.
2. Routing is correct: `'lint design.md'` -> flowF_design_tokens (confidence 0.85). Enrichment works: `designContent` loads (8634 chars), `findTokenLine` returns valid line numbers (colors.brand.red=L4, rounded.sm=L65, motion.ease.out=L98, typography.display=L26). The citation MECHANISM was never broken.
3. BUT flowF was SKIPPED with message `"Validation failed: 1 blocking issue"`. `DeterministicValidator.validate` Gate 3 (`deterministic-validator.ts` L128-190) shells out `npx @google/design.md lint <projectPath>/DESIGN.md` via execFileSync; on a non-zero exit that is NOT timeout/tool-missing/tool-internal-error it pushes a `severity: 'blocking'` violation. In the orchestrator natural-language chain (`sidecoach-orchestrator.ts` L1379-1415) a blocking validation sets status='skipped' and `break`s the chain BEFORE `handler.execute()` runs -> flowF never emits its citation.
4. `npx @google/design.md lint reference/DESIGN.md` (v0.3.0) exited 1 on ONE error: `{ path: "rounded.none", message: "'0' is not a valid dimension." }`. `reference/DESIGN.md` had `rounded.none: "0"`.

Why nobody noticed: the test was never gated, so flowF getting silently blocked went unobserved. The sibling GATED test `sprint3-orchestrator-enrich-before-canexecute.test.ts` drives the same utterance but only asserts flowF is NOT *canExecute*-skipped - it explicitly tolerates the lint-gate skip, so it stayed green while the citation quietly disappeared.

## The fix

`reference/DESIGN.md`: `rounded.none: "0"` -> `"0px"` (single line; `border-radius: 0` == `0px`, semantically identical). This makes the canonical reference lint-clean, which unblocks flowF, which surfaces the real citation feature.

**Why the fixture, not the test or the gate:**
- The gate blocking tier-2 flows on a DESIGN.md lint FAILURE is intentional. Its severity design is deliberate: tool-missing/timeout/tool-internal-error DEGRADE to warning (L152-175); only an actual content lint failure stays blocking (L176-190). Weakening it would defeat its purpose.
- The reference IS the canonical exemplar (used by sprint1-integration, design-md-parser, sprint2-rolling-citations too) and the project's own standard (CLAUDE.md) is "DESIGN.md must pass `@google/design.md lint` with zero findings." A reference that fails its own lint is the defect.
- Independent corroboration: `palette-recipe.test.ts:230` (GATED, required, run-tests.ts:106) asserts the project's own DESIGN.md generator emits `none: 0px`, message "rounded.none must be a real dimension 0px, never bare 0". `palette-recipe.ts:538` hard-codes `'  none: 0px'`. So `0px` is the already-codified correct value from a different subsystem.

## Verification (all green)

- `npx @google/design.md lint reference/DESIGN.md` -> exit 0 (errors:0; 1 warning remains - top-level `colors.primary` undefined - which is non-blocking and out of scope).
- TARGET `sprint3-process-path.test.ts` -> exit 0, "sprint3-process-path PASS", `process()-path citations found: 11` (e.g. `Brand red: #DC2618 (Source: DESIGN.md L4)`).
- SIBLING `sprint3-orchestrator-enrich-before-canexecute.test.ts` -> exit 0 (flowF now runs to success; message is not the canExecute-skip string, so still passes).
- 14 reference-consuming gated tests all exit 0: palette-recipe, sprint2-rolling-citations (typo=4/comp=4/motion=5), sprint9-design-tokens-autoload, sprint1-integration, design-md-parser, domain-validation-coverage, orchestrator-slash-command, slash-command, sprint2-context-loader-typing, sprint2-integration, sprint5-disambiguation-prompt-path + silent-tiebreak, sprint4-build-report-composite, sprint4-build-report-single-opt-in.
- `npm run build` -> exit 0, no generated-file drift.
- Review gate: Codex (0.142.5) was probed and available but TIMED OUT twice (2min then 8min) - unreliable in this env (matches prior beats). Per the fallback, deployed an independent Claude reviewer (feature-dev:code-reviewer, fresh context, not the producer): verdict SOUND, confirmed the trace line-for-line, confirmed fixing the fixture is the correct layer, confirmed no consumer depends on bare `"0"` or on reference failing lint, and confirmed no real product bug is masked (the test's cited paths do not include rounded.none - the fix only unblocks Gate 3).

## For the lead

Add to `scripts/run-tests.ts` (near the routing block ~L200, was documented there as the pre-existing red):
`{ rel: 'src/__tests__/sprint3-process-path.test.ts', required: true },`

## Follow-ups flagged (NOT fixed - out of scope)

- **Benchmark fixtures with the same bare-`"0"` defect:** `sidecoach/benchmarks/fixtures/{brand-studio,form-stress,saas-dashboard,scroll-landing}/DESIGN.md` still use `rounded.none: "0"`. They are consumed ONLY by the opt-in `benchmarks/runner/run-all.ts`, which does NOT invoke DeterministicValidator or the lint CLI, and are not gated - so no active breakage, purely latent/consistency. Lead's call whether to align them to `0px`.
- **flowL ProjectPersonaEngine auth error (benign, pre-existing):** now that flowF is unblocked, the chain runs further and flowL (design critique) invokes an LLM API with no key in the test env, logging `ProjectPersonaEngine extraction failed: Could not resolve authentication method`. It is caught per-flow (test exits 0). Not introduced by this change (it is a consequence of the chain running to completion) and not a blocker, but the chain surfacing a raw auth error to stderr may be worth a graceful-degrade guard later.

## Files touched
- `reference/DESIGN.md` (1 line: `rounded.none` `"0"` -> `"0px"`)
(scripts/run-tests.ts and dist/ deliberately untouched - lead owns integration. Nothing committed.)
