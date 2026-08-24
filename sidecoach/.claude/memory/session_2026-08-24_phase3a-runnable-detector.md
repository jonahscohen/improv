---
name: Phase 3a - runnable-detector interpreter (advisory, NOT yet blocking)
description: Built the DATA-DRIVEN static-css-regex interpreter, PatternSpec schema, CHECKS resolution wiring, and miner spec/corpus preflight for the self-updating taste pipeline. Everything stays advisory - the enforce/blocking gate is a separate later unit.
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests - Step1 30 assertions, Step3 registry block, Step4 miner 60 assertions, full suite green (audit-history pinned); npm run build exit 0
confidence: high
relates_to: [session_2026-08-24_phase3-design.md]
---

# Phase 3a: runnable-detector machinery (advisory only)

Built the RUNNABLE-DETECTOR half of the Phase 3 design (blueprint:
session_2026-08-24_phase3-design.md). A mined taste rule can now become RUNNABLE via a
data-driven interpreter, but NOT build-blocking - the second consent gate that crosses to
blocking is a separate later unit and was deliberately NOT built here.

## What was built (per step)

- **Step 1 - PatternSpec + interpreter.** New leaf module `src/validators/pattern-spec.ts`
  (types PatternSpec/ExampleRef/ExampleCorpus, the `static-css-regex` engine const, a FIXED
  numeric-predicate allowlist keyed by predicateId - cubic-bezier-overshoot, font-family-count,
  min-source-lines - the STATIC ReDoS screen `screenRegexSource`, `compileGuarded`,
  `sanitizeFlags`, and `screenPatternSpec` for miner reuse). New check
  `src/validators/checks/pattern-interpreter.ts` runs a spec as a CheckFn: applicability regex ->
  defect regex(es) -> optional numeric predicate -> fail. Fail-closed at every gap (unknown
  engine / unknown predicateId / unsafe-or-invalid regex / missing evidence => inconclusive, the
  missingCheck contract).
  - Why data-driven interpreter (not codegen): executes NO authored code - compiles regex DATA
    via new RegExp and selects predicates from a reviewed allowlist. Preserves structural
    inertness; nothing in src/ imports the quarantine.
  - ReDoS: a synchronous JS regex cannot be pre-empted in-process (no re2 installed, no
    worker infra), so the load-bearing defense is the STATIC screen applied BEFORE any execution:
    it rejects nested unbounded quantifiers (star-height >= 2, the `(a+)+$` family), backreferences,
    and over-long/over-complex sources -> inconclusive, never run. Input-length cap bounds the
    rest. The same screen is reused by the miner preflight. Residual (ambiguous-alternation ReDoS
    like `(a|a)*`) is bounded only by the length cap; re2/worker execution is the noted upgrade.
  - Test: `src/__tests__/pattern-interpreter.test.ts` (wired into run-tests) - fires/clean/
    not_applicable/inconclusive(engine)/inconclusive(predicate)/guard-met-vs-not, and the
    catastrophic `(a+)+$` case verified UNDER A HARD TIMEOUT in a child process against dist
    (a regression that removed the screen would hang the child and be killed, not hang the suite).

- **Step 2 - schema.** Added OPTIONAL `patternSpec?` + `exampleCorpus?` to ProductRuleDefinition
  (product-rule-types.ts, type-only import from pattern-spec). Optional => every existing rule +
  validateRegistry unaffected (validateRegistry checks required fields, ignores extras).
  `npm run build` exit 0.

- **Step 3 - CHECKS resolution.** Extracted `resolveCheckFn(def)` + `buildCheckProduct(def)` in
  product-rule-registry.ts: a hand CHECKS entry wins; else a patternSpec-carrying rule resolves to
  `interpreterFor(def)`; else missingCheck (inconclusive - no false pass). Behavior for every
  existing rule is byte-identical (they have no patternSpec). Test block added to
  product-rule-registry.test.ts seeds a spec'd rule and asserts it FIRES via checkProduct, is clean
  on a non-match, and a detector-less rule stays inconclusive.

- **Step 4 - miner.** bin/sidecoach-mine.js carries patternSpec + exampleCorpus through
  normalizeCandidate onto the def (into the quarantine JSON), and preflight now (a) screens every
  spec regex under the ReDoS budget + (b) rejects any predicateId outside the allowlist (both via
  the SAME compiled `screenPatternSpec`), and (c) freezes the example corpus (content sha256 +
  canonical recordHash). Malformed spec/corpus is FILED with its errors, never dropped. Tests added
  to bin/__tests__/sidecoach-mine.test.js (60 assertions) + fixtures
  (findings-patternspec.json, patternspec-examples/{pos-1,neg-1}.html).

## Key decision: corpus-tool freeze is MIRRORED, not runtime-imported

The miner is synchronous CommonJS; eval/corpus-tool.mjs is ESM. Rather than take a runtime
ESM-from-CJS dependency in the miner's hot path, the example-corpus freeze mirrors corpus-tool's
`canonicalRecord`/`recordHash` byte-for-byte (same field order, same trim+lowercase norm, same
sha256-of-JSON) and a PARITY test dynamically imports corpus-tool and asserts identical
recordHashes, pinning the mirror to the source. Flagged to the lead for the Codex review.

## Verification

- Baseline (clean HEAD a4ef8d06): `npm test` exit 0, 187 suites.
- Step 1: `ts-node scripts/run-tests.ts --only pattern-interpreter` -> 30 assertions, exit 0.
- Step 2: `npm run build` exit 0 (validateRegistry + generate-validators --check +
  generate-tool-index --check + tsc).
- Step 3: registry suite block "Phase 3a patternSpec -> interpreter resolution" OK.
- Step 4: `node bin/__tests__/sidecoach-mine.test.js` -> 60 assertions, exit 0; live
  `run --findings` writes a quarantine JSON with a valid spec + frozen corpus, and files the
  bad-regex / bad-predicate candidates with preflight errors.

## Flake NOTE (not my code)

The pre-existing miner assertion `dry-run: 1 strengthen-existing` reads the REAL mutable
data/audit-history.jsonl, which the CONCURRENT scheduled miner/audit process grew during the
session (2 rules crossed the fire threshold -> the representative dry-run saw 1 fixture + 2
measured = 3). Proven by pinning SIDECOACH_AUDIT_HISTORY to an empty file -> 60/60 green. This is a
pre-existing state dependency in the miner test, not a Phase 3a regression. Recommend the
integrator either run the gate while the scheduled miner is idle or pin the representative dry-run's
audit-history.

## Codex folds (2026-08-24, post-build review)

- **Fold 1 (HIGH, ReDoS): re2 for untrusted regexes.** The static screen cannot decide
  ambiguous-alternation ReDoS (`^(a|aa)*$` passed the screen, compiled, and hung native V8 on
  `"a"*40+"b"` inside the write-gate). Fix: added re2 as an OPTIONAL dependency and route EVERY
  untrusted patternSpec regex through it (guaranteed linear time). compileGuarded now compiles via
  re2 and fail-closes (error -> interpreter inconclusive / miner files) when re2 is unavailable or
  rejects the syntax. NO native RegExp is ever built from candidate source - applicability .test(),
  defect scanning, and defect LOCATION all use re2 (execCapped) + the new exported
  source-locator.sourceRegions (locate() builds a native RegExp, so the interpreter scans regions
  itself). screenRegexSource stays as a fast miner-preflight DIAGNOSTIC (still files clear
  "unsafe regex" errors) but is no longer the sole runtime control. OUR predicate regexes stay
  native (trusted/linear). re2 CONSEQUENCE: lookaround + backreferences are rejected by re2 ->
  inconclusive (acceptable; mined tells are plain presence patterns). Test seam
  SIDECOACH_DISABLE_RE2 forces the fail-closed path.
- **Fold 2 (LOW, malformed flags -> false pass): validateFlags rejects.** `flags:123` or an
  unsupported char was silently sanitized to '' (an intended `i` lost -> a defect that should match
  returned pass). New validateFlags REJECTS a non-string or any char outside {i,m,s,u} (and dupes)
  -> error -> filed in preflight / inconclusive at runtime. Replaces the old sanitizeFlags.

Fold verify: pattern-interpreter suite 36 assertions (adds the `^(a|aa)*$` exploit + `(a+)+$` both
bounded under an 8s hard-timeout child, the re2-unavailable=inconclusive path, and both malformed-
flags cases). Miner suite 64 assertions (adds bad-flags candidates filed in preflight). Live
`run --findings` still writes a clean good candidate (frozen corpus) and files bad-regex/bad-
predicate/bad-flags. `npm run build` exit 0. re2 in optionalDependencies (^1.24.0).

## Files touched

- NEW src/validators/pattern-spec.ts
- NEW src/validators/checks/pattern-interpreter.ts
- NEW src/__tests__/pattern-interpreter.test.ts
- NEW bin/__tests__/fixtures/findings-patternspec.json
- NEW bin/__tests__/fixtures/patternspec-examples/{pos-1,neg-1}.html
- src/product-rule-types.ts (optional fields + type import)
- src/product-rule-registry.ts (resolveCheckFn + buildCheckProduct)
- src/__tests__/product-rule-registry.test.ts (Phase 3a block)
- scripts/run-tests.ts (wire pattern-interpreter suite)
- bin/sidecoach-mine.js (loadRegistry screen, freeze helpers, carry-through, preflight, write)
- bin/__tests__/sidecoach-mine.test.js (Phase 3a assertions)
- dist/* rebuilt

NOT mine (concurrent process): data/taste-candidates.json, data/proposed-rules/polish.*.json.
