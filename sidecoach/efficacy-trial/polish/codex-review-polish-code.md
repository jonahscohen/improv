Here’s the adversarial review, ranked by severity.

## [high] `sidecoach-present.js` now hard-depends on `dist/polish-craft` for report quality; on machines without a built `dist/`, polish guidance silently regresses

The comment says this is intentional fallback, but per your review criteria this is still a runtime break on machines where `dist/` is not built: the executive report loses all craft content for polish rules.

### Failure scenario
- Source checkout only, no `npm run build`
- Run anything that hits `bin/sidecoach-present.js` and renders a polish executive report
- Finding:
  ```js
  { rule: 'polish-standard:rule-1', message: '...', severity: 'warning' }
  ```
- `require('../dist/polish-craft')` throws, is swallowed, `_craft = false`
- `ruleFix()` falls through to template
- `ruleWhy()` falls through to template unless in `RULE_WHY`

### Wrong output
Instead of real remediation like `scale: 0.96`, report prints:
- After: `resolve the polish standard:rule 1 issue on the affected element` or equivalent humanized variant
- Why: `it undercuts the finished result`

This is not just graceful degradation; it recreates the exact defect this change claims to fix, whenever `dist` is absent.

## [high] The tests depend on built JS in `bin/sidecoach-present.js` but the normal test runner entry only adds the TS test file; there is no guarantee `dist/polish-craft` exists when the test suite runs

`run-tests.ts` adds `src/__tests__/polish-craft.test.ts`, but that test requires the bin script, and the bin script lazily requires `../dist/polish-craft`. If the harness does not build first, section 5 of the new test can fail spuriously or behave differently from TS-side assertions.

### Failure scenario
- CI or local test run executes `sidecoach/scripts/run-tests.ts`
- It launches `ts-node src/__tests__/polish-craft.test.ts`
- `dist/` absent
- Test reaches:
  ```ts
  const polishRendered = renderExecutiveReport(...)
  ```
- JS renderer cannot load craft corpus

### Wrong output
Executive report assertions fail for reasons unrelated to source correctness:
- `contains(polishRendered, 'scale: 0.96', ...)` fails
- `absent(polishRendered, FIX_TEMPLATE, ...)` fails

This is a real runtime/test-environment coupling issue.

## [medium] `registryPolishRules()` can silently collapse to `[]`, which causes false “unknown rule” handling and drops craft selection/ranking across the feature

The lazy `require('./product-rule-registry')` is wrapped in a blanket catch that returns `[]`. That preserves process liveness but can degrade the feature broadly and invisibly.

### Failure scenario
- Any transient/module-init problem while loading `product-rule-registry`:
  - pathing error
  - circular import causing incomplete export shape
  - runtime error inside registry module init
- `registryPolishRules()` catches everything and stores `[]`
- Then:
  - `polishRuleKeyForNumber(1)` returns `undefined`
  - `normalizeCraftKey('polish-standard:rule-1')` returns `undefined`
  - `craftNote(1)` returns `undefined`
  - `selectCraftNotes([1,8,...])` drops all numeric polish rules

### Wrong output
In flow guidance:
- `craftBriefLines(craftSubjects)` can become empty even when polish rules failed
- `polishFindingLines` labels fall back to `rule-1`, `rule-8`, etc. instead of canonical keys
- fixes fall back to `r.remediation || ''`; if no remediation, no fix text at all

In executive report:
- `craftRemediation('polish-standard:rule-1')` and `craftReason(...)` return `undefined`
- templated After/Why reappear

The swallow makes this hard to diagnose.

## [medium] Same silent-degradation problem for dynamic ban craft: `absoluteBans()` catches all loader failures and turns every ban into “unknown”

Again, catch-all fallback to `[]`.

### Failure scenario
- `reference-loader` throws at import/load time
- Render a finding:
  ```js
  { rule: 'anti-patterns:ban-side-stripe-borders', ... }
  ```
- `banCraftNote()` cannot resolve the ban because `absoluteBans()` cached `[]`

### Wrong output
Executive report falls back to generic template for named bans rather than prescribed rewrite options.

This directly violates the intended “new ban needs no edit here” claim under loader failure.

## [medium] Possible circular-import fragility remains; lazy require reduces but does not eliminate partial-initialization hazards

You called this out explicitly; I don’t see a definitive cycle proof from the diff alone, but the risk is real because:
- `flow-handler-tactical-polish.ts` statically imports `./polish-craft`
- `polish-craft.ts` lazily requires `./product-rule-registry`
- registry check modules import from `./polish-standard-validator`
- `flow-handler-tactical-polish.ts` imports `PolishStandardValidator`

Even if this doesn’t form a hard cycle today, it is structurally close enough that partial exports are plausible.

### Failure scenario
- Registry module init indirectly re-enters something depending on `polish-craft`/validator ordering
- `require('./product-rule-registry')` returns partial/incomplete export, e.g. `RULES` undefined
- `.map(...)` throws, catch returns `[]`

### Wrong output
Same as above: no craft mapping for numeric polish rules, empty/incorrect brief, templated report output. Because of catch-all, this manifests as degraded content instead of a visible failure.

## [medium] Findings are mostly preserved, but one path can weaken them: failed polish rules without `r.remediation` and without registry lookup lose the new per-rule fix text entirely

The detector half is still present in the guidance array, so the core findings are preserved. But the new additive per-rule lines are not robust if registry resolution fails.

### Failure scenario
- `polishReport.results` contains failed rule:
  ```ts
  { ruleId: 1, passed: false, message: 'Missing press feedback', remediation: '' }
  ```
- `polishRuleKeyForNumber(1)` fails due to registry issue
- `craftNote(1)` returns undefined
- line becomes:
  ```ts
  - [rule-1] Missing press feedback
  ```

### Wrong output
You lose the promised “measured message and its fix” on the per-rule line, despite the feature text claiming each failing rule is named with message and remediation.

Not detector loss, but a partial regression in the newly added reporting surface.

## [low] Precedence between measured remediation and corpus is correct in the renderer, but not fully mirrored in the flow guidance text

In `sidecoach-present.js`, precedence is:
1. explicit finding `fix`
2. craft corpus
3. audit map
4. template

Good.

In `flow-handler-tactical-polish.ts`, per-rule lines use:
```ts
const fix = r.remediation || note?.fix || '';
```
Also fine, but only for polish findings in handler output. No issue there. I do **not** see a precedence bug in the diff itself.

So explicitly: **no high/medium severity precedence bug found**.

## [low] `craftBriefLines()` disclosure message reports the post-slice count, not the configured cap

Minor wording bug:
```ts
(distinct > notes.length ? `, capped at ${notes.length} taught here` : '')
```
If caller passes `limit: 3`, message says capped at 3. Fine.
If selection returns fewer than limit for other reasons, it won’t claim capping. Also fine.
But semantically this is “capped at selected count,” not “capped at limit.” Not wrong enough to break functionally.

## [low] Test has vacuous assertions / assertions weaker than the comments claim

A few stand out.

### Vacuous/weak: “rule key has words to compare against”
```ts
ok(keyWords.length > 0, `${tag}: rule key has words to compare against`);
```
This never tests implementation behavior, only fixture shape. It can fail only if authors write a weird key. It does not support the stated claim that fix text adds substance beyond the rule name.

### Weak: “fix carries more than the rule name”
```ts
ok(fixWords.length >= 15, ...)
```
This is easy to satisfy with verbose garbage. It does not actually compare overlap between key words and fix words, despite the comment claiming that.

### Weak/vacuous mutation target
In mutation script:
```sh
mutate src/polish-craft.ts "the taught-note cap is removed" \
  "export const MAX_TAUGHT_NOTES = 8;" \
  "export const MAX_TAUGHT_NOTES = 100;" \
  "all 24 failing caps at 100" \
```
This is theatre-ish because the expected failing assertion text itself changes with the mutated constant:
```ts
`all 24 failing caps at ${MAX_TAUGHT_NOTES} ...`
```
The mutation is only “caught” because behavior and assertion message both move together in a convenient way. It does detect the length mismatch, but the named assertion string is partly parameterized by the mutation itself, which weakens the control.

### Weak mutation-control premise about frozen `dist`
The script explicitly declares section-5 executive-report assertions are outside blast radius for `src/polish-craft.ts` mutations because `dist` is frozen. That means a large portion of the newly claimed end-to-end behavior is intentionally not exercised for source mutations to the corpus. If the source corpus changes but built corpus stays stale, section 5 tells you nothing. That is useful for speed, but it is absolutely not full mutation coverage of the feature.

So: **not wholly fake, but partially theatre**. It proves some source-level logic and some bin-level wiring, but not the integrated source-to-built report path per mutation.

## [low] Maintainability: duplicated fallback logic and hidden degradation paths

Both `sidecoach-present.js` and `polish-craft.ts` use lazy require + blanket catch + fallback. This keeps things running, but creates multiple silent-degradation paths where the exact bad old templates reappear. At minimum:
- log once on fallback
- or expose a sentinel warning
- or make tests explicitly cover “dist missing” mode if that behavior is accepted

## Preservation of findings

On your priority #2: **mostly yes, findings are preserved.**
- `absoluteBanGuidance` still included
- `linguisticGuidance` still included
- polish summary still included
- `validationResults` / checklist appear untouched by the diff

I do **not** see a path in this diff where the working detector is replaced wholesale by prose in production code.

The closest concern is degradation of the new per-rule polish fix lines when registry/craft lookup fails, as noted above. That is not detector loss, but it does weaken the added “which rule failed and what to do” output.

## Anything that would break at runtime without `dist/`

Yes, explicitly:
- `bin/sidecoach-present.js` loses corpus-backed remediation/reason for polish rules when `../dist/polish-craft` is absent
- tests that exercise the bin renderer can fail in source-only environments

No outright crash because of the catch, but user-visible functional regression.

## Summary by severity

### High
1. `sidecoach-present.js` silently regresses to old templated polish output when `dist/polish-craft` is missing.
2. New test/report path is environment-coupled to built `dist`, but `run-tests.ts` does not itself guarantee a build.

### Medium
3. `registryPolishRules()` blanket catch can silently disable numeric polish rule mapping, craft selection, ranking, and report enrichment.
4. `absoluteBans()` blanket catch can silently disable dynamic ban craft.
5. Circular-import / partial-init fragility likely remains; failures are hidden by catch-all fallback.
6. New per-rule handler lines can lose fix text if registry/craft lookup fails and remediation is absent.

### Low
7. No substantive precedence bug found; measured remediation still wins.
8. `craftBriefLines()` cap wording is slightly misleading.
9. Some test assertions are weak/vacuous.
10. Mutation-control script is only partially sound; the frozen-`dist` argument intentionally excludes integrated coverage for source mutations, so it is not full evidence of end-to-end robustness.
11. Silent fallback behavior hurts diagnosability/maintainability.

If you want, I can turn this into a PR-style review with inline comments per file.