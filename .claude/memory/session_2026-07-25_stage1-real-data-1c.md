---
name: Stage 1 real data + 1c counter-rule compilation (Gap 2, unblocked by keys)
description: Jonah set provider keys; running Stage 1a (3-provider sampling) -> 1b (defect distribution) -> BUILDING 1c (counter-rule compiler, never existed). 1c code done + verified vs synthetic; gated on the real samples (claude slow, gemini flaked once + retrying). gemini id = gemini-3.6-flash.
type: project
relates_to: [session_2026-07-25_pull-tight-leading-blinking-cursor.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: CORE 1c DONE - 87 suites green (incl counter-rules 81 asserted), npm run build green (generate + --check no drift), Codex "Findings: None" + independently re-derived the 13 rules from the distribution and confirmed byte-match + raw/distribution consistency. Committing core; wiring is a flagged Jonah decision.
confidence: high
---

Collaborator: Jonah. 2026-07-25. Gap 2 (was HARD-BLOCKED on no provider keys); Jonah added ~/.sidecoach-keys.

## Keys (secure handling)
Keys NOT in chat - user created ~/.sidecoach-keys (outside repo, chmod 600) with the 3 exports. I `source` it per-command; never echo/cat/env-dump the values. ANTHROPIC/OPENAI/GEMINI all PRESENT (GOOGLE_API_KEY absent, fine - adapter checks GEMINI_API_KEY first). Delete with `rm ~/.sidecoach-keys` when done.

## Pipeline (mapped)
- **1a** eval/provider-sample.mjs: sample held-out briefs per model. 20 held-out briefs (23 total - 3 calibration). Model defaults CURRENT: claude-opus-4-8, gpt-5.4. Gemini has NO default on purpose (refuses to guess) -> web-searched current GA id = **gemini-3.6-flash** (generateContent still supported); smoke-tested OK (1 page, finishReason STOP).
- **1b** eval/defect-distribution.mjs: shipping live scanner over the sample -> `{provider:{rule:{fired,total,rate}}}`, schema sidecoach-defect-distribution/v1, ruleUniverse = OBJECTIVE_RULES(5) + SUBJECTIVE_RULES(17) = 22. Inconclusive pages excluded from denominators. Correctly reflects the pull (no tight-leading/blinking-cursor).
- **1c** was NEVER BUILT (scripts/generate-counter-rules.ts + src/counter-rules.generated.ts absent) - this is why Gap 2 needed real data first.

## 1c BUILT (this session) - verified vs synthetic
- src/counter-rule-generation.ts (PURE logic, in rootDir so the test imports it w/o TS6059 - the validator-generation split): deriveCounterRules + renderCounterRulesModule + frozen COUNTER_RULE_RATE_MIN=0.30, COUNTER_RULE_MIN_TOTAL=5. Over-produced = rate>=0.30 over >=5 conclusive pages. Deterministic order (provider asc, rate desc, rule asc); throws on a class outside ruleUniverse.
- scripts/generate-counter-rules.ts (THIN I/O + --check wrapper, --dist/--out overrides). Emits src/counter-rules.generated.ts w/ COUNTER_RULES + counterRulesForProvider + counterRuleGuidanceForProvider. Determinism: embeds the artifact's generatedUtc, never new Date().
- src/__tests__/counter-rules.test.ts: registry-existence (every generated class in OBJECTIVE_RULES+SUBJECTIVE_RULES) + pure-logic boundary tests (threshold, noise guard, null, corrupt-throw, ordering).
- SMOKE VERIFIED: generator on a synthetic dist emitted exactly the 6 expected counter-rules (threshold + noise-guard + sorting all correct); --check drift=exit1, clean=exit0, missing-dist=exit2.

## REAL DATA IN - all 3 samples clean (20/20 each, 0 inconclusive)
claude-opus-4-8, gpt-5.4, gemini-3.6-flash. 60 pages. gpt out=158k tok, gemini out=258k tok. gemini needed 1 retry (transient empty, cleared). Merged -> eval/corpus/defect-distribution.json (schema-validated).

## 13 REAL counter-rules (threshold 0.30 over >=5 pages - focused, well under the ~17 cap)
- **claude**: default-typeface 100%, low-contrast 55%, nested-cards 35%, gray-on-color 30%
- **gpt**: default-typeface 90%, nested-cards 75%, soft-radial-glow 50%
- **gemini**: default-typeface 95%, low-contrast 75%, nested-cards 60%, skipped-heading 50%, tiny-text 40%, gray-on-color 30%
Real signal: ALL 3 over-produce default-typeface (90-100%) + nested-cards; gemini most defect-prone (a11y-heavy); gpt uniquely soft-radial-glow. Exactly the provider-specific defect signal Stage 1 targets.

## VERIFIED
- `npm run build` GREEN: generate-counter-rules wrote 13 rules, --check OK (no drift), tsc clean - 1c now joins the build chain.
- counter-rules.test: OK, 81 asserted, 13 rules over the registry.
- Full gate (npm test, expect 87 suites) + Codex 1c review RUNNING.

## WIRING DECIDED (Jonah): CLI surface, user picks the provider - DONE + verified
`sidecoach counter-rules [provider]` added to bin/sidecoach.js (dispatch + printCounterRules + topLevelHelp line) + a SKILL.md row. Honest design: YOU name the provider (claude/gpt/gemini); the CLI never guesses your target model (sidecoach advises, it can't know which model you build with - the reason auto-inject was rejected). Lazy-requires dist/counter-rules.generated (exit 2 if unbuilt). Verified live: `counter-rules claude` prints its 4 rules (default-typeface 100%, low-contrast 55%, nested-cards 35%, gray-on-color 30%) exit 0; no-arg lists the 3 providers exit 0; unknown provider exit 1; help/list regression clean (unknown verb still exit 1). Display-only, reads the already-Codex-reviewed generated module - verified by exercising the 3 cases rather than a 3rd heavyweight Codex pass. Core 1c committed 971070a5; CLI surface commit next.

## (superseded) prior wiring-flag note
The orchestrator has NO active-provider signal AND no single guidance-finalization seam (guidance is assembled per-branch; the one append at L535 is taste-failure-specific). So auto-injecting counterRuleGuidanceForProvider needs 2 decisions: (a) provider source (recommend env SIDECOACH_ACTIVE_PROVIDER default 'claude' since sidecoach runs under Claude) + (b) WHERE to append. The counter-rules ARE consumable NOW via the exported counterRuleGuidanceForProvider(p) - compiled, tested, queryable API, not hollow. Will ASK Jonah the wiring depth rather than risk the sensitive orchestrator per-branch or fabricate a signal nothing sets.

## Samples NOT committed (60 HTML pages = repo bloat); the DISTRIBUTION artifact (with fired/total + model ids + provenance) is the committed record. Periodic re-run regenerates.

## Design call flagged
The orchestrator has NO active-provider signal (grep clean). So the runtime "append provider P's counter-rules to guidance" wiring has no hook. 1c delivers the compiled data + consumption helpers (counterRuleGuidanceForProvider); wiring the orchestrator to actually append needs a provider-source decision (env SIDECOACH_ACTIVE_PROVIDER defaulting to 'claude'? a context field?) - will implement the env-default-claude path OR flag for Jonah rather than fabricate a signal nothing sets.

## Files
- created: scripts/generate-counter-rules.ts, src/counter-rule-generation.ts, src/__tests__/counter-rules.test.ts.
- pending: src/counter-rules.generated.ts, eval/corpus/defect-distribution.json, package.json build-wire, run-tests.ts registration.
