# Independent Review: Sidecoach Lane Intent Detection

Date: 2026-06-12  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: design document plus current hook, Sidecoach engine, slash router, MCP server, installer, tests, and related disambiguation design.

## Executive verdict

The direction is sensible: remove unnatural magic words, keep the useful chains, use deterministic hook-time evidence, and interview once when intent is unclear.

The design is **not implementation-ready as written**. The most important missing control is a design-domain gate. Without it, ordinary backend and engineering prompts such as "build the API from scratch", "get the migration production-ready", and "don't stop until tests pass" can confidently route into Sidecoach lanes.

The second major gap is execution semantics. The design specifies how to classify and announce a lane, but not a reliable mechanism that executes a lane as one operation. This is especially serious for `lane_converge`: the proposed directive runs the three verbs once, while the existing convergence algorithm has no production caller and requires an `applyFixes` integration to make progress.

Recommendation: **conditional approval after the P0 and P1 items below are resolved in the design**.

## What is strong

- Removing the six mode words directly addresses the user-experience problem.
- Keeping hook-time classification deterministic respects the model-router constraint.
- Conservative routing plus a one-question interview is the right risk posture.
- The route margin is better than a top-score-only classifier because it recognizes contested intent.
- Sanitization and informational-framing suppression are valuable existing controls to preserve.
- Announcing a confident read gives the user some visibility into automatic scope expansion.
- Keeping "Just handle it directly" in interviews prevents Sidecoach from becoming mandatory.

## Prioritized findings

### P0. Natural lane phrases are not gated to design work

The proposed lexicons contain globally common engineering language:

- `from scratch`
- `production-ready`
- `going live`
- `don't stop until`
- `until ... passes`
- `start fresh`
- `simplify`

The scoring logic routes from lane score alone. It does not require the prompt to be front-end or design work. A single weight-3 phrase is enough to route because `route_floor` is 3.

This conflicts with Sidecoach's stated scope in `claude/skills/sidecoach/SKILL.md`, which excludes backend logic, infrastructure, and non-UI refactors. The current advisory intent tier already has a design-domain test using actions, substantive targets, and standalone design signals, but the proposed lane tier bypasses it.

Examples that must not lane-route:

| Prompt | Unsafe proposed result | Required result |
|---|---|---|
| `build the API from scratch` | ROUTE `lane_build` | normal request |
| `get this database migration production-ready` | ROUTE `lane_ship` | normal request |
| `don't stop until unit tests pass` | ROUTE `lane_converge` | normal request |
| `start fresh on the auth token parser` | CLASSIFY `lane_build` | normal request |

**Recommendation**

Add a design-eligibility gate before lane scoring:

```text
lane_eligible =
  explicit /sidecoach phrase
  OR substantive design target
  OR standalone design signal
  OR active design context explicitly supplied by the hook surface
```

Only ROUTE or CLASSIFY when `lane_eligible` is true. Do not infer active design context from cooldown state alone. Add a large negative corpus covering backend, tests, CI, release engineering, infrastructure, data, and prose-writing uses of every lane phrase.

### P0. Lane classification has no complete execution contract

The hook emits an instruction to "run the verb chain in order", but the design does not define:

- whether the model invokes each verb separately;
- whether repeated FlowIds across verbs run repeatedly or are deduplicated;
- how prerequisites, failures, checkpoints, and BuildReports behave across the lane;
- whether a lane is one engine operation or several independent operations;
- how lane selection is represented in structured output;
- how an interrupted lane resumes.

The design says FlowId chains carry over unchanged, but the sample lane record does not include a FlowId chain, and the directive only carries the verb chain. Current `modes.ts` distinguishes the verb chain from the deduplicated FlowId chain for this reason.

**Recommendation**

Define a structured lane execution API before implementation. Prefer one engine entry point such as:

```text
runLane(laneId, target, context) -> SidecoachResult
```

The canonical lane record should declare:

```json
{
  "lane": "lane_ship",
  "executionKind": "sequence",
  "verbChain": ["audit", "critique", "harden", "adapt", "polish"],
  "flowChain": ["flowK_multi_lens_audit", "..."]
}
```

State explicitly whether `flowChain` is deduplicated and whether verb-specific guidance still applies. The model should announce the lane, then invoke the structured operation rather than manually interpreting how to run it.

### P0. `lane_converge` does not actually converge

The ROUTE directive says to run `polish, audit, critique` in order. That executes one pass, not a convergence loop.

The existing `sidecoach/src/ralph-loop.ts` algorithm is currently test-only: repository search found no production caller. Its own module contract also states that handlers report findings but do not apply fixes unless an `applyFixes` function is supplied. Without that integration, the loop normally stalls on repeated findings.

Mechanically renaming the file and identifiers does not connect the lane to the algorithm or close the fix-application gap.

**Recommendation**

Choose one:

1. Wire `lane_converge` to a real engine operation with `runFlow` and `applyFixes`, then test convergence, stall, cap, errors, and user interruption end to end.
2. Remove `lane_converge` from this release and keep convergence-loop integration as a separate feature.

Do not ship a lane labeled "iterate until it passes" if its implemented behavior is one QA pass or a guaranteed stall.

### P1. Lane-first precedence can silently expand an explicit request

The proposed precedence puts a confident inferred lane ahead of an explicit verb. That can turn a focused request into a much larger chain:

| Prompt | Explicit request | Possible inferred expansion |
|---|---|---|
| `audit this before we ship` | audit | full ship lane |
| `simplify this and make it production-ready` | simplify | full ship lane |
| `polish this until tests pass` | polish | convergence loop |

An inferred chain is higher scope and higher cost than a directly stated verb. The design's statement that the higher-level shape always wins is not conservative enough when wrong routing is considered more costly than interviewing.

**Recommendation**

Define an explicit conflict policy:

- A known `/sidecoach <verb>` always wins.
- A natural-language explicit verb plus a route-grade lane signal does not auto-expand. It becomes CLASSIFY, or the verb wins.
- A lane can override an explicit verb only when a separately defined, tested phrase explicitly requests expansion or looping.

Add conflict tests for every lane and every verb appearing in its chain.

### P1. The scoring rules, examples, and invariant contradict each other

The design requires a real lane signal for CLASSIFY: `top >= classify_floor`, currently 2. However:

- `make this page better` matches no representative lane lexicon, so it falls to the advisory nudge rather than CLASSIFY.
- `maybe simplify?` scores only 1 and does not match the current advisory intent registry, so it can be silent.
- A prompt such as `simplify the settings panel` can similarly detect a weak lane signal and still fall silent because `simplify` is not an advisory action and `panel` is not a substantive target.

That conflicts with the minimum test expectations and the stated invariant that detected lane intent is never silently dropped.

**Recommendation**

Specify one consistent rule:

- Weak score 1 plus design eligibility becomes CLASSIFY; or
- weak score 1 is intentionally ignored and the failure-proofing invariant is narrowed; or
- add an explicit generic "design work but no lane" interview tier separate from lane scoring.

Document expected outcomes for score combinations `(top, second)` including `(0,0)`, `(1,0)`, `(2,0)`, `(3,0)`, `(3,1)`, `(3,2)`, and ties.

### P1. "Single source of truth" is not true

The design calls `sidecoach-lanes.json` the single source of truth, while also requiring lane data in:

- `sidecoach/src/lanes.ts`;
- `claude/skills/sidecoach/SKILL.md`;
- `claude/skills/sidecoach/CHEATSHEET.md`;
- MCP registry types and fallback data;
- marketing copy.

This creates the same mirror-drift problem the current mode system has. Labels, descriptions, chains, lexicons, interview labels, FlowIds, and execution behavior can diverge.

**Recommendation**

Make one artifact canonical and generate or validate every mirror. The simplest fit is:

- `sidecoach-lanes.json` owns ids, labels, descriptions, interview labels, execution kind, verb chain, FlowId chain, lexicon, scoring metadata, and schema version.
- TypeScript imports or generates typed data from the JSON.
- Skill and cheatsheet lane tables are generated.
- CI runs a parity test that fails on drift.

Do not retain a TypeScript fallback that silently serves stale lane data when the canonical JSON is missing.

### P1. The MCP and public-contract blast radius is materially incomplete

The design lists `list-modes.ts` and three tests, but the current MCP server exposes modes across a wider public contract:

- `sidecoach/mcp-server/src/registries.ts` imports `../../dist/modes`, loads `sidecoach-modes.json`, defines mode types, and provides a TS fallback.
- `sidecoach/mcp-server/src/keyword-resolver.ts` returns `kind: "mode"` and implements mode-first precedence.
- `sidecoach/mcp-server/src/tools/resolve-keyword.ts` documents and returns verb-or-mode resolution.
- `sidecoach/mcp-server/src/schemas.ts` registers `sidecoach_list_modes` and exposes a `"modes"` cheatsheet section.
- `sidecoach/mcp-server/src/tools/index.ts` registers the modes tool.
- `sidecoach/mcp-server/src/tools/get-cheatsheet.ts` extracts the modes section.
- MCP README, DESIGN, smoke scripts, integration tests, fault-injection tests, and checked-in transcripts expose the old contract.
- Checked-in `sidecoach/mcp-server/dist/*` also requires rebuilding.

The statement that no TypeScript importers of `MODES` exist is false: `sidecoach/mcp-server/src/registries.ts` imports `MODE_LIST` and `getMode` from the compiled parent package.

There is also a semantic issue: the current TypeScript keyword resolver escapes patterns as literals, while the new lane lexicons are regex fragments and require weighted scoring. Merely renaming mode types will not preserve hook/MCP parity.

**Recommendation**

Treat this as an intentional MCP API migration:

- Decide whether `sidecoach_resolve_keyword` becomes `sidecoach_classify_intent` or gains a versioned result shape.
- Return decision, lane scores, evidence ids, winning lane, and verb match in a structured result.
- Update all schemas, docs, tests, transcripts, and dist artifacts.
- Run one shared fixture corpus against both the Python hook classifier and TypeScript MCP classifier.

### P1. `/sidecoach <phrase>` is not supported by the current command path

The design assigns this behavior only to `SKILL.md`. The current slash parser treats the first word after `/sidecoach` as a command. Unknown commands return `isCommand: false`.

For example, `/sidecoach get this ready to ship` parses `get` as an unknown command. There is no structured lane result, no engine dispatch, and no testable resolution path. A skill instruction may influence the model, but it does not make the existing CLI/orchestrator command surface support the phrase.

**Recommendation**

Define whether `/sidecoach <phrase>` is:

- a real engine/CLI feature, in which case the parser needs an unknown-command phrase fallback and structured lane resolution; or
- a model-only convenience, in which case document that it does not route through the Sidecoach command engine.

Prefer the first option and add parser plus end-to-end tests.

### P1. The stated TypeScript test gate does not run the affected suites

The root `sidecoach/package.json` maps `npm test` only to `src/intent-detector.test.ts`. It does not run `src/__tests__/t20-ralph-loop.test.ts` or the many other standalone suites. The MCP server has a separate package and separate `npm test`.

Therefore, "npm test and the tsc build must pass" is not enough to validate this migration.

**Recommendation**

Name the exact required commands, including:

```text
bash claude/hooks/test-sidecoach-keyword.sh
cd sidecoach && npm run build
cd sidecoach && npm test
cd sidecoach && npx ts-node src/__tests__/<renamed-convergence-test>.ts
cd sidecoach/mcp-server && npm run build
cd sidecoach/mcp-server && npm test
```

Add an aggregate Sidecoach test runner or CI script so future specs can name one authoritative command.

### P2. Score summation can overstate confidence

Each regex pattern counts once, but multiple patterns can express the same semantic evidence. For example, a prompt can contain both "ready for production" and "production-ready", producing a score of 6 from one idea. Similar overlap is likely as the lexicon is tuned.

**Recommendation**

Add `signalGroup` or `evidenceId` to lexicon entries and count only the maximum weight per group. Keep separate evidence dimensions additive, such as release language plus responsive/edge-case language.

Calibrate thresholds using a labeled corpus and report precision, false-route rate, interview rate, and fallthrough rate. "Conservative" should be an observed property, not only a threshold choice.

### P2. Tunable regex and evidence handling need hardening

The design encourages free JSON tuning but does not specify registry validation or regex failure behavior. Current mode/verb matching can throw on an invalid regex. Python's regex engine also has no timeout, so a badly tuned expression can delay every prompt submission.

The proposed directive includes raw matched phrases. Putting arbitrary user-controlled substrings into injected `additionalContext` unnecessarily raises their authority and can make the directive large or confusing.

**Recommendation**

- Add a schema version and registry validator.
- Compile every regex during tests and hook startup.
- Reject unsafe or unbounded constructs and cap sanitized prompt length.
- Catch per-pattern regex failures so verbs and advisory intent still work.
- Put stable evidence ids or short registry-owned descriptions in `additionalContext`, not raw matched user substrings.
- Cap directive size and number of evidence items.

### P2. Informational suppression is occurrence-insensitive

The current helper suppresses a pattern if it appears anywhere in an informational frame, even if another occurrence is an actual request.

Example:

```text
What does production-ready mean? Make this page production-ready.
```

The first occurrence can suppress the second. Natural lane phrases are more likely than magic words to appear in mixed explanatory and imperative prompts, so this existing weakness becomes more important.

**Recommendation**

Evaluate framing per match occurrence, or remove informational spans before scoring and then score remaining occurrences. Add mixed informational-plus-invocation tests for every lane.

### P2. Operational fallback and observability are unspecified

The design assumes `AskUserQuestion` is available and that the model follows injected protocol. It does not define behavior for non-interactive clients, unavailable question tooling, malformed lane registries, or model non-compliance.

**Recommendation**

Define:

- fallback to a concise normal-language question when the choice tool is unavailable;
- behavior when the lane registry is missing or invalid;
- structured debug logging for decision, scores, evidence ids, and fallthrough reason;
- a privacy-safe way to collect false-route and correction examples;
- a correction phrase or explicit user override that cancels a lane before expensive work continues.

## Recommended revised decision flow

```text
1. Sanitize prompt and validate registries.
2. If known explicit /sidecoach command: route exact command.
3. Determine design eligibility.
4. Score lanes using grouped evidence.
5. Detect explicit natural-language verb.
6. If route-grade lane and no explicit-verb conflict: ROUTE.
7. If route-grade lane conflicts with explicit verb: CLASSIFY, do not auto-expand.
8. If explicit verb: route verb.
9. If design-eligible lane evidence meets classify policy: CLASSIFY.
10. If advisory design intent fires: NUDGE.
11. Otherwise: SILENT.
```

For explicit `/sidecoach <phrase>`, bypass the design-eligibility check but still apply lane ambiguity and conflict rules.

## Minimum acceptance corpus additions

Beyond the cases already listed in the design, add:

- Non-design strong-signal negatives for all six lanes.
- Explicit verb plus strong lane conflicts for all lanes.
- Same semantic evidence expressed through overlapping patterns.
- Mixed informational and imperative occurrences of the same lane phrase.
- Equal-score lane ties and near ties.
- Invalid lane JSON, invalid regex, missing lane JSON, and extreme prompt length.
- Cooldown behavior after ROUTE, CLASSIFY, "Just handle it directly", and failed interview tooling.
- `/sidecoach <phrase>` parser and engine behavior.
- Hook classifier and MCP classifier parity from the same fixture table.
- Convergence lane end-to-end proof that fixes are applied and exit status is truthful.
- Install and checked-in dist verification.

Suggested release acceptance targets:

- Zero confident lane routes in the non-design negative corpus.
- Zero lane overrides of explicit `/sidecoach <verb>` commands.
- Every ROUTE and CLASSIFY result reproducible identically in hook and MCP classification.
- Every lane registry mirror validated against the canonical source.
- `lane_converge` demonstrably loops and can converge, or is excluded from release.

## Blast-radius corrections

At minimum, add these areas to the implementation plan:

- `sidecoach/mcp-server/src/keyword-resolver.ts`
- `sidecoach/mcp-server/src/tools/resolve-keyword.ts`
- `sidecoach/mcp-server/src/schemas.ts`
- `sidecoach/mcp-server/src/tools/index.ts`
- `sidecoach/mcp-server/src/tools/get-cheatsheet.ts`
- `sidecoach/mcp-server/README.md`
- `sidecoach/mcp-server/DESIGN.md`
- MCP unit, integration, fault-injection, smoke, and transcript fixtures
- `sidecoach/mcp-server/dist/*`
- `sidecoach/src/slash-command-router.ts` and slash-command tests if `/sidecoach <phrase>` is a real command surface
- an aggregate test command or CI entry point

## Final recommendation

Proceed with the lane concept, but revise the design before implementation.

The minimum blocking changes are:

1. Add a design-domain eligibility gate.
2. Define structured lane execution, including deduplication and failure semantics.
3. Wire or defer `lane_converge`.
4. Define explicit-verb conflict behavior.
5. Reconcile the scoring examples and no-silent-drop invariant.
6. Make the registry genuinely canonical and complete the MCP/public migration plan.
7. Specify a test gate that actually runs every affected surface.

With those changes, the approach should be substantially safer and easier to maintain than the current magic-word system.
