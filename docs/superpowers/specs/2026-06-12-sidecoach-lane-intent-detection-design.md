# Sidecoach Lane Intent Detection - Design (v2)

Date: 2026-06-12
Collaborator: Jonah
Status: revised after independent review
(`docs/superpowers/reviews/2026-06-12-sidecoach-lane-intent-detection-design-review.md`);
v1 findings resolved per the decisions below.

## Problem

The six sidecoach mode words (forge, kiln, bloom, canvas, trim, ralph) fail the
say-it-out-loud test. They were optimized for hook detectability, which pushed
them toward pottery-metaphor nouns nobody naturally types. Jonah's verdict
(2026-06-12, `feedback_mode_words_unnatural.md`): "I hate all of those mode
words. They're unnatural conversationally." The vocabulary forces keyword
recall and a glossary instead of letting the user speak plainly.

The verb chains behind the words are good. The names are the problem.

## Decisions already made (with Jonah, this session)

1. **Mode words are removed entirely.** No hidden aliases, no deprecation
   window. The chains survive as unnamed lanes.
2. **Confident classification routes and announces.** One conversational
   sentence naming the read and the verbs, then work starts immediately.
3. **Architecture is hybrid: hook scores, model decides.** Deterministic
   lexical scoring in the hook; final call in-session. Murky cases run one
   AskUserQuestion interview. Interviewing is a pathway to specificity, not a
   failure mode.
4. **Thresholds start conservative** and are calibrated against a labeled
   corpus (see Testing) - "conservative" must be an observed property.
5. **Review decisions (Jonah, 2026-06-12):** `lane_converge` is WIRED in this
   release (not deferred); `/sidecoach <phrase>` is a REAL ENGINE FEATURE
   (parser fallback + structured resolution); `runLane()` IS BUILT NOW as the
   structured execution entry point.

## Constraints

- The model-router-guard (non-negotiable, 2026-06-11) forbids routing to
  another model. Classification is deterministic hook code plus in-session
  judgment by the main model. No LLM calls from hook code.
- Sidecoach scope (SKILL.md): design/UI work only - never backend logic,
  infrastructure, or non-UI refactors. The lane tier must enforce this, not
  assume it.

## 1. Lane model

Six lanes replace six modes. A lane is an internal routing target with a
plain-English label; internal ids never surface in conversation.

| Internal id | Plain label (user-facing) | Verb chain | executionKind |
|---|---|---|---|
| `lane_build` | a ground-up build | shape, craft, polish | sequence |
| `lane_ship` | a release-readiness pass | audit, critique, harden, adapt, polish | sequence |
| `lane_delight` | a personality pass - color, motion, delight | colorize, delight, animate, polish | sequence |
| `lane_live` | live in-browser iteration | live, colorize, polish, critique | sequence |
| `lane_calm` | a tone-down pass - quiet it to essentials | quieter, distill, clarify, polish | sequence |
| `lane_converge` | iterate-until-it-passes looping | polish, audit, critique | loop |

Canonical lane record (in `sidecoach-lanes.json`):

```json
{
  "lane": "lane_ship",
  "label": "a release-readiness pass",
  "description": "Audits, critiques, hardens errors and i18n, validates responsive, finishes with polish.",
  "interviewLabel": "Get it ship-ready",
  "executionKind": "sequence",
  "verbChain": ["audit", "critique", "harden", "adapt", "polish"],
  "flowChain": ["flowK_multi_lens_audit", "flowI_accessibility", "flowL_design_critique", "flowV_all_seven_qa", "flowM_responsive_validation", "flowJ_tactical_polish"],
  "lexicon": [
    { "pattern": "production[- ]ready", "weight": 3, "group": "release" },
    { "pattern": "ready (?:for|to) (?:ship|launch|release|production|prod)", "weight": 3, "group": "release" }
  ]
}
```

`flowChain` is the DEDUPED union of the verbs' FlowIds in execution order
(same contract `modes.ts` documents today); verb-specific guidance still
applies via the orchestrator's verb-parity layer. `interviewLabel` is the
short AskUserQuestion option text (1-5 words). FlowId chains carry over from
`modes.ts` verbatim.

## 2. Canonical registry - one source of truth, enforced

`claude/hooks/sidecoach-lanes.json` owns everything: ids, labels,
descriptions, interview labels, execution kind, verb chain, FlowId chain,
lexicons, scoring config, and a `schemaVersion`. Every other surface is a
generated or validated mirror:

- `sidecoach/src/lanes.ts` loads/generates typed data from the JSON. NO
  silent TypeScript fallback: if the JSON is missing or invalid, lane
  features fail loudly (see Operational behavior) rather than serving stale
  data.
- SKILL.md and CHEATSHEET.md lane tables are generated from the JSON (build
  script), not hand-maintained.
- A parity test fails the build when any mirror (TS, MCP registry, skill
  tables) drifts from the JSON.

This kills the mirror-drift problem the mode system had instead of
re-creating it.

## 3. Lexicons and evidence-group scoring

Lexicon entries are `{pattern, weight, group}`. Patterns are regex fragments
matched with the existing hyphen-aware word boundaries against the sanitized
prompt. Weights: 3 strong, 2 medium, 1 weak.

**Score per lane = sum over groups of (max matched weight in that group).**
"ready for production" + "production-ready" is one `release` idea and scores
3, not 6. Distinct evidence dimensions (e.g. release language + edge-case
language) remain additive.

Representative starting lexicons stand as in v1 (build: "from scratch",
"ground-up"; ship: "production-ready", "before we launch"; delight: "feels
flat", "bring it to life", "more personality"; live: "tweak it live", "while
I watch"; calm: "calm it down", "too busy", "strip it back"; converge: "keep
iterating until", "don't stop until ... passes"). Implementation calibrates
against the labeled corpus and reports precision, false-route rate, interview
rate, and fallthrough rate before thresholds are final.

Sanitization (code fences, backticks, URLs, XML bodies, transcript markers)
applies unchanged. Informational-framing suppression becomes
OCCURRENCE-AWARE: informational spans are removed from the sanitized text
first, then remaining occurrences score. "What does production-ready mean?
Make this page production-ready." scores the second occurrence. (Today's
helper suppresses the whole prompt if the phrase appears in any frame - and
the live false-fire during this session, where a pasted review document
routed the `shape` verb, is the same family of bug: quoted/discussed text
treated as intent.)

## 4. Design-eligibility gate (new - resolves review P0 #1)

Lane scoring only ROUTEs or CLASSIFYs when the prompt is design work:

```text
lane_eligible =
  substantive design target matches (reuse sidecoach-intent.json targets)
  OR standalone design signal matches (reuse sidecoach-intent.json standalone)
```

`/sidecoach <phrase>` bypasses the gate (explicitly addressed to sidecoach).
Cooldown state NEVER grants eligibility. Without eligibility, lane evidence is
ignored entirely: "build the API from scratch", "get this migration
production-ready", "don't stop until unit tests pass" stay normal requests no
matter how strongly they score. A large negative corpus (backend, tests, CI,
release engineering, infrastructure, data, prose) enforces this.

## 5. Decision flow and outcome table

```text
1.  Sanitize prompt; validate registries (schema + regex compile).
2.  Known explicit /sidecoach command: route that exact command. Always wins.
3.  Determine design eligibility (section 4).
4.  Score lanes using grouped evidence (section 3).
5.  Detect explicit natural-language verb (existing verb tier match).
6.  Route-grade lane (top >= route_floor AND top - second >= route_margin),
    eligible, AND no explicit-verb conflict -> ROUTE.
7.  Route-grade lane + explicit verb in the same prompt -> CLASSIFY. An
    inferred chain never silently expands an explicitly requested verb; the
    interview offers the verb, the lane, and "just handle it directly".
8.  Explicit verb (no route-grade lane) -> verb route (existing behavior).
9.  Eligible AND top >= 1 -> CLASSIFY (weak signal still interviews - this
    replaces v1's classify_floor and resolves the dropped-signal
    contradiction).
10. Advisory intent nudge fires per its existing rules -> NUDGE.
11. Otherwise -> SILENT.
```

Outcome table, eligible prompts, `route_floor 3`, `route_margin 2`:

| (top, second) | Outcome |
|---|---|
| (0, 0) | no lane action; nudge rules apply |
| (1, 0) | CLASSIFY |
| (2, 0) | CLASSIFY |
| (3, 0) | ROUTE (CLASSIFY if an explicit verb also matched) |
| (3, 1) | ROUTE (margin 2 met; CLASSIFY on verb conflict) |
| (3, 2) | CLASSIFY (margin not met) |
| (n, n) tie | CLASSIFY |

Ineligible prompts: always "no lane action" regardless of scores.

Failure-proofing invariant (now consistent): on an ELIGIBLE prompt, detected
lane evidence (top >= 1) always reaches ROUTE or CLASSIFY; nothing detected is
silently dropped. Ineligible prompts are out of lane scope by design.

Cooldown: ROUTE and CLASSIFY touch the cooldown state file (as verb/mode
routes do today); neither is ever cooldown-suppressed.

## 6. Directives

Both directives carry registry-owned evidence descriptions (stable ids +
short labels from the lexicon groups), NEVER raw matched user substrings; at
most 3 evidence items; total directive size capped (~1500 chars).

ROUTE shape:

> Lane read: this prompt reads as {label} (evidence: {group labels}). Invoke
> runLane("{lane}", target) semantics: announce the read in ONE conversational
> sentence naming the work and the verbs, then begin immediately - execute
> {verbChain} in order via the lane execution contract (section 7). Do not
> ask for confirmation. If conversation context makes this read clearly
> wrong, downgrade to a single AskUserQuestion interview instead. If the user
> corrects or cancels at any point, stop the lane immediately and follow
> their direction.

CLASSIFY shape:

> Lane read: design-shaped prompt without a single confident lane. Scores:
> {per-lane scores + evidence group labels}. Lane table: {labels,
> descriptions, verb chains}. Protocol: if conversation context makes one
> candidate obviously right, announce and run it. Otherwise ask ONE
> AskUserQuestion: top 2-3 candidates (interviewLabel + description), plus
> any explicitly-matched verb as its own option, plus "Just handle it
> directly". Never chain a second question.

## 7. Lane execution contract - runLane() (resolves review P0 #2)

New engine entry point on `FlowExecutionEngine`
(`sidecoach/src/sidecoach-orchestrator.ts`):

```text
runLane(laneId: string, target: string, context?: FlowExecutionContext)
  -> SidecoachResult
```

- `executionKind: "sequence"`: executes the lane's deduped `flowChain` in
  order as ONE engine operation, reusing the existing composite machinery
  (`runCompositeLoop` path) - so prerequisites, failures, BuildReports, and
  checkpoints behave exactly as composite flows do today, and an interrupted
  lane resumes via the existing checkpoint mechanism
  (`runCompositeFromCheckpoint`). Verb-specific guidance applies via the
  verb-parity layer. Repeated FlowIds across verbs run ONCE (deduped chain).
- `executionKind: "loop"`: wraps `runRalphLoop` (renamed; see section 8).
- Lane selection appears in structured output: `SidecoachResult` gains
  `lane?: { id, label, executionKind, status }`.
- The model's job after a ROUTE is: announce, then drive the lane through the
  engine operation - not hand-interpret the chain.

## 8. lane_converge - wired for real (resolves review P0 #3)

`sidecoach/src/ralph-loop.ts` renames to `sidecoach/src/convergence-loop.ts`
(identifiers `Ralph*` -> `Convergence*`; algorithm untouched), and gains its
first production caller:

- `runLane("lane_converge", ...)` invokes the loop with `runFlow` wired to
  the engine's single-flow execution and `applyFixes` wired to the engine's
  fix-application path, so iterations actually make progress instead of
  stalling on repeated findings.
- Exit statuses (`converged | stalled | capped | error`) surface truthfully
  in `SidecoachResult.lane.status` and in the model's closing summary. The
  lane never claims convergence it did not achieve.
- End-to-end tests cover convergence, stall, cap, error, and user
  interruption.

## 9. /sidecoach <phrase> - real engine feature (resolves review P1)

`sidecoach/src/slash-command-router.ts` gains an unknown-command fallback:
when the first token after `/sidecoach` is not a known verb, phase command, or
setup command, the full argument string runs through the shared lane
classifier (same scoring module the hook mirrors) and returns a structured
resolution:

```text
{ isCommand: true, kind: "phrase", decision: ROUTE | CLASSIFY,
  laneScores, evidence, lane? }
```

ROUTE dispatches `runLane`; CLASSIFY produces the interview. The eligibility
gate is bypassed (explicit address) but ambiguity and conflict rules still
apply. Parser unit tests + end-to-end tests included. SKILL.md documents the
behavior the engine actually has.

## 10. MCP migration (resolves review P1 - full public contract)

Treated as an intentional API migration, kept in lockstep with the hook:

- `registries.ts`: lane types, loads `sidecoach-lanes.json`, imports lanes
  from the compiled parent package; NO silent TS fallback (missing/invalid
  JSON = explicit error state in tool responses).
- `keyword-resolver.ts`: weighted grouped-evidence regex scoring replacing
  literal-escape matching - MUST produce identical decisions to the hook
  classifier from the shared fixture corpus (parity test).
- `tools/resolve-keyword.ts` -> `sidecoach_classify_intent` (or versioned
  result shape): returns decision, lane scores, evidence ids, winning lane,
  and verb match.
- `tools/list-modes.ts` -> `list-lanes.ts` (`sidecoach_list_lanes`);
  `schemas.ts`, `tools/index.ts`, `tools/get-cheatsheet.ts` ("modes" section
  -> "lanes"); README.md, DESIGN.md; unit, integration, fault-injection,
  smoke tests and checked-in transcripts; `mcp-server/dist/*` rebuilt.

## 11. Hardening (resolves review P2s)

- `schemaVersion` field + registry validator; every regex compiled at hook
  startup and in tests; per-pattern compile failures are caught and skipped
  (verbs and the nudge tier keep working); unsafe/unbounded constructs
  rejected by the validator; sanitized prompt length capped before scoring.
- Structured debug logging (stderr, picked up by hook logs): decision, lane
  scores, evidence ids, fallthrough reason - every prompt, one line. This is
  also the privacy-safe false-route collection mechanism: the log contains
  registry ids, never prompt text.
- User override: any correction/cancellation mid-lane stops the lane (stated
  in both directive shapes and SKILL.md).

## 12. Operational behavior

- AskUserQuestion unavailable (non-interactive client): ask the interview as
  one concise plain-language question instead. Same one-question contract.
- Lane registry missing/invalid: lane tier disabled with a loud stderr line;
  verb tier and advisory nudge continue working; MCP tools return explicit
  error states. Never stale fallback data.
- Model non-compliance with directives is mitigated by acceptance transcripts
  in the test suite (directive in, expected behavior shape out) and the
  announce-always rule, which makes deviations visible to the user.

## 13. Blast radius (corrected per review)

Hook layer: `sidecoach-keyword.sh`, `sidecoach-lanes.json` (new, replaces
`sidecoach-modes.json`), `sidecoach-intent.json` (eligibility reuse),
`test-sidecoach-keyword.sh`, `install.sh` lines 1048 + 2613.

Sidecoach engine: `modes.ts` -> `lanes.ts` (JSON-driven), `ralph-loop.ts` ->
`convergence-loop.ts` + `t20` test rename, `sidecoach-orchestrator.ts`
(`runLane`, `SidecoachResult.lane`), `slash-command-router.ts` + tests, a
shared lane-classifier module, `types.ts` if FlowId/lane types need it,
`sidecoach/dist/*` rebuild.

MCP server: `registries.ts`, `keyword-resolver.ts`, `tools/resolve-keyword.ts`,
`tools/list-modes.ts` -> `list-lanes.ts`, `schemas.ts`, `tools/index.ts`,
`tools/get-cheatsheet.ts`, README.md, DESIGN.md, all test tiers + transcripts,
`mcp-server/dist/*` rebuild.

Docs/skill/marketing: SKILL.md + CHEATSHEET.md (generated lane tables,
phrase-routing docs, mode words removed), `marketing-site/cheatsheet.html`
(12 hits) + `sidecoach.html` (5 hits) - marketing copy goes through the
normal visual verification gate.

Explicitly OUT of scope (false-positive grep hits, do not touch):
`claude/skills/visual-effects/*` "bloom" (shader term);
`claude/settings.json` `ralph-loop@claude-plugins-official` (official CC
plugin); `sidecoach/reference/_extracted/*` (vendored); beat files under
`.claude/memory/` (historical record).

## 14. Testing - the gate that actually runs everything

Exact required commands (an aggregate runner `sidecoach/test-all.sh` wraps
them so future specs can name one command):

```text
bash claude/hooks/test-sidecoach-keyword.sh
cd sidecoach && npm run build && npm test
cd sidecoach && npx ts-node src/__tests__/t20-convergence-loop.test.ts
cd sidecoach/mcp-server && npm run build && npm test
bash sidecoach/test-all.sh        # aggregate, added by this work
```

Corpus (shared fixture table, run against BOTH the Python hook classifier and
the TS MCP classifier):

- One strong-signal prompt per lane -> ROUTE with the right lane.
- Non-design strong-signal NEGATIVES for all six lanes (backend, tests, CI,
  release engineering, infrastructure, data, prose) -> never ROUTE/CLASSIFY.
- Explicit verb + route-grade lane conflicts for every lane and every verb in
  its chain -> CLASSIFY, never silent expansion.
- Overlapping same-group evidence -> scores max-per-group, not the sum.
- Mixed informational + imperative occurrences of the same lane phrase ->
  the imperative occurrence scores.
- Equal-score ties and near-ties -> CLASSIFY.
- Old mode words as plain English ("trim the whitespace", "canvas element",
  "bloom effect") -> never lane-route.
- Invalid lane JSON, invalid regex, missing JSON, extreme prompt length ->
  graceful degradation per section 12.
- Cooldown behavior after ROUTE, CLASSIFY, "Just handle it directly", and
  failed interview tooling.
- `/sidecoach <phrase>` parser + end-to-end behavior.
- `lane_converge` end-to-end: fixes applied, truthful exit status for
  converged/stalled/capped/error/interruption.
- Install wiring + checked-in dist verification; registry mirror parity.

Release acceptance targets:

- Zero confident lane routes in the non-design negative corpus.
- Zero lane overrides of explicit `/sidecoach <verb>` commands.
- Every ROUTE/CLASSIFY decision identical between hook and MCP classifiers.
- Every lane registry mirror validated against the canonical JSON.
- `lane_converge` demonstrably loops and converges in tests.
- Calibration report (precision, false-route rate, interview rate,
  fallthrough rate) on the labeled corpus before thresholds are final.

## 15. Out of scope

- The 22 verbs stay as direct triggers (they pass say-it-out-loud).
- No new magic keywords of any kind.
- The advisory intent-nudge tier keeps its current firing behavior (its
  lexicons are REUSED read-only by the eligibility gate).
- Lane membership and verb chains are not redesigned; trigger + execution
  plumbing only.
