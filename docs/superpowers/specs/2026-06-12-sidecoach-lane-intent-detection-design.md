# Sidecoach Lane Intent Detection - Design (v5)

Date: 2026-06-12
Collaborator: Jonah
Status: revised after fourth independent review; selects the truthful
convergence-capability contract (Option A: product validators gate,
audit/critique advise) and resolves the remaining v4-review P0/P1/P2 findings
(three-gate preflight, edge waivers, resume, CAS, NUDGE parity, clause
segmentation, containment, retention). Reviews at `docs/superpowers/reviews/`.

## Problem

The six sidecoach mode words (forge, kiln, bloom, canvas, trim, ralph) fail the
say-it-out-loud test (Jonah, 2026-06-12: "I hate all of those mode words").
The verb chains behind the words are good. The names are the problem.

## Decisions made with Jonah (2026-06-12)

1. Mode words removed entirely; no aliases.
2. Confident classification routes + announces in one sentence, then starts.
3. Hybrid architecture: hook scores deterministically, model decides.
4. Thresholds conservative, calibrated against a labeled corpus.
5. `lane_converge` wired this release; `/sidecoach <phrase>` is a real engine
   feature; the lane execution API (`startLane` / `advanceLane` /
   `laneStatus`) is built now.
6. Action model: model-driven lane state machine. The engine serves guidance
   and validates; the model does the work between steps.
7. **Convergence capability model: product validators gate; advisory flows
   coach.** `lane_converge` keeps polish, audit, and critique in the loop, but
   only target-derived product validators decide clean. Today tactical polish
   is the sole gate; audit and critique remain advisory until each earns
   product-validator capability in a separately reviewed change.

## Constraints

- model-router-guard (non-negotiable, 2026-06-11): no LLM calls from hooks.
- Sidecoach scope: design/UI work only. The lane tier enforces this itself.
- Engine flows emit guidance/checklists/findings/artifacts; they never modify
  the product. Step completion is model work, attested with evidence and
  engine-validated where a flow declares product-validator capability (stated
  plainly; v2's invented "engine fix-application path" remains rejected).
- Guidance/framework initialization is never product-validation evidence.
  Only a declared `product_validator` with target-derived findings may block
  step completion or participate in a convergence gate.

## 1. Lane model

| Internal id | Plain label (user-facing) | Verb chain | executionKind |
|---|---|---|---|
| `lane_build` | a ground-up build | shape, craft, polish | sequence |
| `lane_ship` | a release-readiness pass | audit, critique, harden, adapt, polish | sequence |
| `lane_delight` | a personality pass - color, motion, delight | colorize, delight, animate, polish | sequence |
| `lane_live` | live in-browser iteration | live, colorize, polish, critique | sequence |
| `lane_calm` | a tone-down pass - quiet it to essentials | quieter, distill, clarify, polish | sequence |
| `lane_converge` | iterate-until-it-passes looping | polish, audit, critique | loop |

Canonical lane record (`sidecoach-lanes.json`):

```json
{
  "lane": "lane_ship",
  "label": "a release-readiness pass",
  "description": "Audits, critiques, hardens errors and i18n, validates responsive, finishes with polish.",
  "interviewLabel": "Get it ship-ready",
  "executionKind": "sequence",
  "verbChain": ["audit", "critique", "harden", "adapt", "polish"],
  "prereqWaivers": [
    { "dependentFlowId": "flowJ_tactical_polish",
      "prerequisiteFlowId": "flowG_component_implementation",
      "reason": "existing UI satisfies the implementation-history assumption" }
  ],
  "lexicon": [
    { "pattern": "production[- ]ready", "weight": 3, "group": "release" }
  ]
}
```

**`verbChain` is a plain string list.** The verb-to-flow mapping is NOT
duplicated here (v3's hand-written mapping had already drifted from
`verb-command-registry.ts`, where critique owns [flowL, flowK] and polish owns
[flowJ, flowM]). Generation derives each lane's executed flow sequence from
the canonical verb registry: flows in verb order, each flow run once (first
owning verb), guidance appended once per verb in chain order. `--check`
validates this cross-registry derivation, not just JSON-to-file drift.

## 2. Canonical registry - generation strategy

`claude/hooks/sidecoach-lanes.json` owns ids, labels, descriptions, interview
labels, execution kind, verb chains, prereq waivers, lexicons, scope policy,
scoring config, `schemaVersion`.

- `sidecoach/scripts/generate-lanes.ts` emits `sidecoach/src/lanes.generated.ts`
  (lane records + derived flow sequences + verb guidance map) before the
  parent `tsc` (`npm run build` = generate + tsc). Checked in. Exact check
  command: `npx ts-node sidecoach/scripts/generate-lanes.ts --check` - fails
  on JSON drift, derivation drift against `verb-command-registry.ts`, OR a
  prerequisite violation (section 8). It also fails if a loop lane has no
  declared `product_validator`, or if a declared product validator lacks its
  typed entry point, measured scope, or clean policy.
- SKILL.md / CHEATSHEET.md lane tables live between
  `<!-- lanes:generated:start/end -->` markers, regenerated by the same
  script, verified by `--check`.
- No silent fallback: missing/invalid JSON fails the build; at hook runtime
  it disables the lane tier loudly (section 13).

## 3. Lexicons and evidence-group scoring

Unchanged from v3: `{pattern, weight, group}` entries, hyphen-aware
boundaries, score = sum over groups of max matched weight per group,
calibration report (precision, false-route, interview, fallthrough rates)
before thresholds are final.

Occurrence-aware informational suppression, concrete algorithm: match every
informational-frame regex, blank matched spans with spaces
(length-preserving), score lane/verb patterns against the blanked text;
frames never cross sentence boundaries. Shared Python/TS edge-case fixtures
(multiple occurrences, punctuation, multiline, quoted text, mixed
informational + imperative). Motivation: the keyword hook false-fired twice
during this design's own review cycle (pasted documents routed `shape`, then
`polish`).

## 4. Scope policy - three states, clause-bound

Scope evaluation returns one of THREE states (v3's two-state design conflated
"positive backend evidence" with "no domain evidence", breaking natural
follow-ups like "bring it to life" whose context lives in conversation
history the hook cannot see):

```text
IN_SCOPE      - UI evidence present, bound to the lane evidence
OUT_OF_SCOPE  - negative evidence bound to the lane evidence
SCOPE_UNKNOWN - lane evidence present, no domain evidence either way
```

Registry sections (`scope` in `sidecoach-lanes.json`):

- `ui_evidence`: curated design-domain patterns. Ambiguous tokens
  (`interface`, `header`, `layout`) count ONLY with a design qualifier in the
  same clause (e.g. "user interface", "page header", "responsive layout") -
  bare occurrences (TypeScript `interface`, packet `header`, memory `layout`)
  never prove scope.
- `negative_filters`: backend/infra/data/CI/prose context ("database",
  "\\bapi\\b", "migration", "endpoint", "unit test", "pipeline", "deploy",
  "schema", ...).

**Clause binding - exact algorithm (shared Python/TS, fixture-enforced):**

1. Segment the sanitized prompt length-preservingly: split at sentence
   terminators (`.`, `!`, `?`, newline, `;`) and at clause boundaries formed
   by a comma followed by a coordinating conjunction (`, but`, `, and`,
   `, or`, `, yet`, `, so`). A small shared abbreviation exception list
   (`e.g.`, `i.e.`, `vs.`, `etc.`, `Dr.`, `Mr.`, `Ms.`) suppresses false
   sentence splits. Both implementations use the identical list and rules.
2. Evaluate each lane-evidence occurrence within its own clause only:
   - a negator (`don't`, `do not`, `never`, `not`, `stop`) preceding the
     evidence in the same clause DISCARDS that occurrence entirely (it is
     neither route evidence nor negative evidence);
   - negative-filter evidence in the same clause binds that occurrence ->
     out-of-scope occurrence;
   - UI evidence in the same clause binds that occurrence -> in-scope
     occurrence;
   - neither -> unknown occurrence.
3. Aggregate per lane: out-of-scope-bound occurrences are discarded from the
   lane score. If at least one in-scope occurrence survives, the lane is
   IN_SCOPE and scores from in-scope + unknown occurrences. If ALL
   occurrences were negative-bound, the lane is OUT_OF_SCOPE. Otherwise
   SCOPE_UNKNOWN.

So "The landing page is done. Make the migration production-ready." binds the
ship evidence to `migration` (its own sentence): OUT_OF_SCOPE. "Don't make
the API production-ready; make the landing page production-ready." discards
the negated first occurrence and routes on the second: IN_SCOPE. A look/feel
phrase that doubles as lane evidence cannot also serve as the sole UI
evidence for itself. Mixed-scope, negation, conjunction, and abbreviation
cases live in the shared parity corpus.

Behavior by state:

- Natural prompts: IN_SCOPE proceeds to lane decision; OUT_OF_SCOPE is
  logged, no lane action (verb/nudge tiers proceed on their own merits);
  SCOPE_UNKNOWN never auto-routes - the hook injects a light CONTEXT-CHECK
  directive instead: "lane evidence ({labels}) without domain evidence; if
  the conversation is clearly about UI/design work, classify per the lane
  table; otherwise ignore." The model decides with the context the hook
  lacks. Failure-proof: evidence is never silently dropped.
- `/sidecoach <phrase>`: explicit address. SCOPE_UNKNOWN with no negative
  evidence proceeds to ROUTE/CLASSIFY (the user chose sidecoach);
  OUT_OF_SCOPE (positive negative evidence) still refuses with a one-line
  redirect. `/sidecoach make this production-ready` therefore works;
  `/sidecoach build the API from scratch` does not.
- Cooldown never grants scope.

## 5. Decision flow and outcome table

```text
1.  Sanitize; validate registries (schema + regex compile).
2.  Known explicit /sidecoach command -> route that exact command. Always wins.
3.  Score lanes (grouped evidence, occurrence-aware suppression).
4.  Evaluate scope (section 4) with clause binding against the lane evidence.
5.  Detect explicit natural-language verb (existing verb tier).
6.  OUT_OF_SCOPE + lane evidence -> OUT_OF_SCOPE (logged; no lane action;
    verb/nudge tiers proceed on their own merits).
7.  SCOPE_UNKNOWN + lane evidence -> CONTEXT-CHECK directive (no auto-route).
8.  IN_SCOPE, route-grade lane (top >= route_floor, top - second >=
    route_margin), no explicit-verb conflict -> ROUTE.
9.  IN_SCOPE, route-grade lane + explicit verb -> CLASSIFY (offers the verb,
    the lane, and "just handle it directly").
10. Explicit verb (no route-grade lane) -> verb route (existing behavior).
11. IN_SCOPE, top >= 1 -> CLASSIFY.
12. Advisory nudge per its existing rules -> NUDGE.
13. Otherwise -> SILENT.
```

Outcome table for IN_SCOPE prompts (`route_floor 3`, `route_margin 2`):
(0,0) nudge rules; (1,0)/(2,0) CLASSIFY; (3,0)/(3,1) ROUTE (CLASSIFY on verb
conflict); (3,2)/ties CLASSIFY.

Cooldown: ROUTE, CLASSIFY, and CONTEXT-CHECK touch the cooldown file; none is
suppressed by it.

## 6. Directives

Registry-owned evidence labels only; max 3 evidence items; ~1500 char cap.
ROUTE and CLASSIFY shapes as v3 (announce-then-start; one-question interview;
selected lane dispatches identically to ROUTE), with dispatch via the monitor
lane surface (section 7). CONTEXT-CHECK shape per section 4. User
correction/cancellation always stops the lane (directive text + SKILL.md +
the `interrupt` transition).

## 7. Lane execution - the full state machine contract

**Engine API** (on `FlowExecutionEngine`):

```text
startLane(laneId, target, context) -> LaneStepResult
advanceLane(checkpointId, transition) -> LaneStepResult
laneStatus(checkpointId) -> LaneState
listLanes() -> LaneInfo[]
```

```text
transition = {
  action: 'complete' | 'retry' | 'skip' | 'resume' | 'interrupt' | 'stop',
  report?: StepReport,        // REQUIRED for 'complete'
  expectedRevision: number    // compare-and-swap; stale revision = error,
}                             // two concurrent advances cannot run one step twice

StepReport = {
  verb: string,
  summary: string,                          // what was actually done
  evidence: { kind: 'files' | 'screenshot' | 'validation' | 'note',
              detail: string }[],           // at least one entry
  checklistResults?: { itemId: string, done: boolean }[]
}
```

**Step success is model-attested with evidence, engine-validated by declared
product validators where available** - stated explicitly, not implied. A flow
handler's
`status: 'success'` means the handler produced its guidance, NOT that the
work happened (`flow-handler.ts` creates checklist items `completed: false`).
So: `complete` without a valid StepReport is REJECTED (the step stays
current); where a step's flows declare `capability: 'product_validator'`,
`advanceLane` runs their pure product-validation entry points and a hard
finding converts the attempted `complete` into a step result of
`validation_failed` (step stays current, findings returned). `advisory` and
`none` flows never block model-attested completion. Multiple flows within one
verb step aggregate: all flows' guidance served together at step start;
product validators evaluated together at completion.

**Validation capability registry:** `sidecoach/src/flow-validation-capabilities.ts`
is the canonical per-flow contract:

```text
capability: 'none' | 'advisory' | 'product_validator'

product_validator additionally declares:
  validatorId
  measuredScope[]        // user-facing, concrete claims this validator proves
  cleanPolicy            // exact threshold for status='clean'
  validateProduct(context) -> ProductValidationResult

ProductValidationResult = {
  status: 'clean' | 'findings' | 'inconclusive' | 'error',
  findings: ProductFinding[],
  measuredScope: string[],
  error?: string
}
```

`product_validator` entry points inspect the target/project, not Sidecoach's
own guidance/checklist output. General memory validations, framework-
initialized passes, and domain validators that only inspect result shape are
`advisory`, never product evidence. The capability registry is reviewed and
tested independently from lane membership.

**Transitions:** `retry` re-serves the current step (report optional,
recorded); `skip` records the step skipped-with-reason (report.summary
required) and serves the next; `interrupt` is an EXPLICIT transition that
persists status `interrupted` (resumable - it is how "user said stop" becomes
durable state; a process that dies without calling it leaves `in_progress`,
equally resumable); `resume` is the ONLY action valid against an
`interrupted` checkpoint - it atomically transitions `interrupted ->
in_progress` (revision increments, audit entry recorded) and re-serves the
current step; every other action against an interrupted checkpoint is
rejected with a directive to resume first; `stop` is terminal: lane closes
with `completed` (all steps succeeded), `partial` (some succeeded), or
`failed` (none).

**Checkpoint update primitive (real CAS, not advisory):** the temp-write +
rename in `checkpoint-store.ts` makes each write atomic but leaves
read-check-write racy - two processes can both read revision 3 and both
write revision 4. All lane mutations therefore go through one primitive:
`updateCheckpoint(checkpointId, expectedRevision, mutator)` - acquires a
per-checkpoint lock file via exclusive creation (`O_EXCL`), with stale-lock
recovery (age-based takeover, logged), re-reads and verifies
`expectedRevision` under the lock, applies the mutator, validates, then
atomically renames. The engine API never performs an unlocked
read/check/write sequence.

**Status precedence:** `interrupted` reflects an open, resumable lane
regardless of completed-step count; terminal statuses are only set by `stop`
or by completing the final step. The composite rule "success = any one flow
passed" is NOT used for lanes.

`LaneState` = `{ lane, target, projectPath, currentStep, steps: [{verb,
flowIds, status: 'pending' | 'current' | 'completed' | 'skipped' |
'validation_failed'}], stepReports, revision, status, convergence? }`.

**Checkpoints:** `SidecoachCheckpoint` schemaVersion 2 adds `operationKind:
'composite' | 'lane'`, `laneId?`, `projectPath`, `revision`, `stepReports`,
`convergence?`. Lane resume resolves against the lane registry (not
`PRESET_COMPOSITE_FLOWS`); v1 checkpoints still resolve presets (migration
shim). Checkpoint lookup: ids resolve within the project's checkpoint
directory; monitor/MCP calls accept `--project <path>` and default to cwd -
documented and tested, never implicit-only.

**Report-input hardening:** structured JSON only - inline or a file path;
paths are resolved with `realpath` and the RESOLVED path must remain under
the RESOLVED project root (a lexical prefix check alone follows symlinks out
of the project); regular files only, no-follow semantics where the platform
supports them; 256KB cap; schema-validated before use.

**Retention and listing:** terminal checkpoints (`completed` / `partial` /
`failed`) are retained 30 days, then garbage-collected; `interrupted` and
`in_progress` checkpoints are retained until stopped or 30 days idle, and GC
of a non-terminal checkpoint is logged loudly. `lane list` shows active and
interrupted lanes by default; `--all` includes terminal ones within
retention.

**Dispatch surface:** `sidecoach-monitor lane start|advance|status|list`
(flags: `--lane`, `--target`, `--checkpoint`, `--project`, `--action`,
`--report`, `--revision`); MCP `sidecoach_lane` tool mirrors ALL FOUR
operations. ROUTE directives and post-CLASSIFY selections dispatch through
the identical path, e2e tested from hook output to engine call.

## 8. Prerequisites - lane preflight policy (global history is out)

Verified incompatibilities: `flowK` hard-requires `flowJ`, `flowJ`/`flowI`/
`flowM` hard-require `flowG`, `flowF` hard-requires `flowA`
(`flow-prerequisites.ts:54-112`) - so `lane_ship`, `lane_delight`, and
`lane_converge` cannot start on a clean history. And history is GLOBAL
(`~/.claude/sidecoach-flow-history.json`, session key defaulting to
`"default"`), so separate monitor calls see empty or cross-project-
contaminated history.

Policy:

- **Intra-lane ordering** is satisfied by CHECKPOINT-LOCAL completed steps,
  never global history.
- **History-only prerequisites** at lane entry are WAIVED per lane via
  edge-specific `prereqWaivers` - each waiver names the exact dependency edge
  (`dependentFlowId` + `prerequisiteFlowId` + reason), never a whole flow, so
  a prerequisite edge added later is never silently waived. `--check` rejects
  unused, duplicate, broad-form, or stale waivers. Refinement lanes
  (`lane_ship`, `lane_calm`, `lane_live`, `lane_converge`, and
  `lane_delight`'s brand-verify edge) carry waivers because an existing UI is
  valid input to a validation/refinement pass without prior sidecoach flow
  history. In place of waived history, lane preflight checks PROJECT STATE
  (project path exists, has UI source; DESIGN.md presence noted in the step-1
  guidance, not required).
- **Three executability gates, not one.** Flow executability has three
  layers: historical prerequisite edges, `contextRequirements`, and handler
  `canExecute` preconditions (verified blockers: `flowF` errors without
  `DESIGN.md`/staged tokens and its `canExecute` requires a project register;
  `flowH.canExecute` requires brand personality). Waiving history alone
  leaves lanes that still error or skip at runtime. So
  `flow-validation-capabilities.ts` also carries a machine-readable
  PRECONDITION declaration per flow - the generator never statically
  interprets arbitrary `canExecute` functions. Each declared precondition
  names its handling when unmet:
  `synthesize_from_project_state` (e.g. flowF autoloads tokens from
  DESIGN.md when present) | `convert_to_step_guidance` (e.g. no DESIGN.md ->
  the step's guidance opens with "no DESIGN.md found - extract tokens or run
  /sidecoach document", and the flow runs in its degraded-but-useful form;
  e.g. flowH without brand personality serves general motion guidance and
  says so) | `waive_with_fallback` | `reject_at_preflight` (with an
  actionable message). The per-lane acceptance matrix defines the expected
  outcome for a project with UI source but no PRODUCT.md, no DESIGN.md, no
  staged tokens, and no history - for every lane.
- **Generation-time enforcement:** `generate-lanes.ts --check` FAILS if any
  required prerequisite EDGE of any flow in a lane's derived sequence is
  neither satisfied earlier in the lane nor explicitly waived, OR if any
  declared context/capability precondition of a lane flow lacks a declared
  unmet-handling. No lane can ship unexecutable at any of the three gates.
- **History scoping:** where flow history remains an input (verb-tier
  behavior, advisory uses), it becomes project-scoped (keyed by project
  path, not a global default session). `flow-history.ts` joins the blast
  radius.
- Per-lane expected-outcome tests run from BOTH a fresh-build fixture and an
  existing-UI-with-no-history fixture.

## 9. lane_converge - persisted, truthful convergence

`ralph-loop.ts` -> `convergence-loop.ts` (`Ralph*` -> `Convergence*`), with
semantic fixes and an explicit capability boundary, not just a rename.

**Option A selected for this release: product validators gate; audit/critique
advise.** Lane membership stays `polish -> audit -> critique`, so every
iteration still receives all three verbs' coaching. Only flows declared
`product_validator` decide whether the target is clean.

Initial capability registry for `lane_converge`:

| Flow | Capability now | Role in iteration | Enters clean/stall signature? |
|---|---|---|---|
| `flowJ_tactical_polish` | `product_validator` | Runs the project-derived polish matrix + linguistic-ban + absolute-ban scans | yes |
| `flowK_multi_lens_audit` | `advisory` | Serves the five-dimension manual audit framework and findings guidance | no |
| `flowL_design_critique` | `advisory` | Serves Nielsen/AI-slop/cognitive-load critique lenses | no |

This is deliberately narrow and honest. Audit's permanent "manual testing
required" warning cannot make convergence impossible; critique's "framework
initialized" pass can never manufacture product cleanliness. If either
advisory flow errors, the product-validation gate may still converge, but the
error is surfaced in `advisoryRuns` and in the mandatory closing summary.
Initial `unverifiedScope` names the manual/judgment boundary explicitly:
screen-reader and keyboard testing, rendered responsive/device behavior, Core
Web Vitals/browser performance, theming review not covered by the matrix,
Nielsen heuristic judgment, and cognitive-load/design-director critique.

`flowJ_tactical_polish` gains a dedicated pure product-validation result that
exposes the actual underlying rule/finding identities; the convergence gate
does NOT infer clean from its message, generic memory validation text, or
output-shape domain validators:

```text
measuredScope:
  - tactical polish matrix (22 rules)
  - extended design-domain matrix (90 rules)
  - linguistic-ban scan
  - absolute-ban scan

status: clean only when all required measured checks ran and produced zero
        unresolved findings under the declared cleanPolicy;
        missing/skipped inputs = inconclusive
```

The capability registry is self-widening for lane members: when audit,
critique, or another existing lane member earns `product_validator` capability
in a separately reviewed change, it automatically joins the required gate
without a lane-contract redesign.

Semantic rules:

- **Product-validator failure can no longer converge.** Current behavior
  records a runner throw as zero findings and converges
  (`ralph-loop.ts:265-303`; t20 asserts it). New rule: any required product
  validator error, skip, unsupported/unparseable result, or missing input marks
  the iteration `inconclusive`; convergence requires every required product
  validator to return `clean`. At least one product validator is required.
  The t20 expectation is updated as part of this work.
- **Advisory output never enters the convergence signature.** It informs the
  model's next fixes and is logged/summarized, but cannot block or prove clean.
- **No generic memory adapter.** Convergence consumes only typed
  `ProductValidationResult` values from declared product validators. Framework
  setup, guidance text, checklist presence, and generic memory validations are
  not product evidence.

**Persisted convergence state** (in the checkpoint, so every iteration
survives process boundaries):

```text
convergence: {
  status: 'running' | 'converged' | 'stalled' | 'capped' | 'error' | 'interrupted',
  iteration, signatures[], consecutiveNoProgress,
  limits: { maxIterations, maxNoProgress },
  productValidationRuns[], findings[], validatorErrors[],
  advisoryRuns[],
  measuredScope[], unverifiedScope[]
}
```

Stall/cap detection reuses `computeProgressSignature` + the existing
counters, now fed ONLY by persisted product-validator findings. Advisory
guidance changes never reset the no-progress counter. `LaneStepResult.status`
keeps the lane-level union; convergence detail lives in the `convergence`
sub-state. Stepped iteration: `advanceLane` runs product validators and
advisory flows -> findings + coaching returned -> model fixes (real work) ->
next `advanceLane` revalidates and updates signatures.

Every converged result and closing summary MUST state the boundary:

> Converged (machine-measured): {measuredScope} clean after {N} iterations.
> Not machine-verified: {unverifiedScope}. Advisory audit/critique guidance
> was {completed | partially unavailable}; manual verification remains advised.

E2e tests drive a real mutation on a fixture project and prove: state survives
a fresh process per iteration; stall and cap fire; product-validator failure
yields `error`/inconclusive, never `converged`; advisory warnings do not make
the product gate impossible; framework-initialization passes never count as
clean evidence.

## 10. /sidecoach <phrase> - resolution union

`ROUTE | CLASSIFY | OUT_OF_SCOPE | UNKNOWN` as v3, with scope per section 4
(SCOPE_UNKNOWN + no negatives proceeds; positive negatives refuse). UNKNOWN
preserves unknown-command behavior including near-miss suggestions
(`/sidecoach polsih button` -> "did you mean /sidecoach polish?"). Typos
never become interviews or routes.

## 11. MCP migration

- `registries.ts`: lane + scope-policy loader (eligibility input included in
  parity); no silent TS fallback.
- `keyword-resolver.ts`: full classifier - grouped scoring, clause binding,
  occurrence-aware suppression.
- `sidecoach_classify_intent` REPLACES `sidecoach_resolve_keyword`. Natural-
  classification result union:
  `ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB | NUDGE_ELIGIBLE | SILENT`
  (+ laneScores, evidenceIds, winningLane?, verbMatch?, schemaVersion).
  **Parity stops before delivery state:** the nudge decision is stateful
  (cooldown file) and delivery belongs to the hook alone. The shared
  classifier - both Python hook and TS MCP - deterministically returns
  `NUDGE_ELIGIBLE`; the hook then maps it to `NUDGE` or `SILENT` using the
  cooldown file. The MCP loads `sidecoach-intent.json` (the advisory
  registry joins `registries.ts` and the parity fixtures) but never reads or
  mutates cooldown state. Parity acceptance covers every classifier outcome
  including `NUDGE_ELIGIBLE`; hook-layer tests separately cover the
  cooldown-active and cooldown-inactive mappings. Phrase-parser resolution is
  a separate result kind with its own union (section 10) - parser UNKNOWN is
  never conflated with classifier SILENT.
- `sidecoach_lane` tool mirrors all four monitor lane operations.
- `list-modes.ts` -> `list-lanes.ts`; `schemas.ts`, `tools/index.ts`,
  `get-cheatsheet.ts`; README/DESIGN; all test tiers + transcripts; dist.

## 12. Hardening

As v3 (validator + compiled regexes + per-pattern failure isolation + length
caps + one structured debug line per prompt with registry ids only), plus the
checkpoint/report hardening in section 7.

## 13. Operational behavior

As v3: AskUserQuestion unavailable -> one concise plain question; registry
missing/invalid -> lane tier disabled loudly, verbs + nudge unaffected, MCP
returns explicit errors; model non-compliance mitigated by acceptance
transcripts + announce-always.

## 14. Blast radius

Hook layer: `sidecoach-keyword.sh`, `sidecoach-lanes.json` (new; replaces
`sidecoach-modes.json`; includes scope policy + waivers),
`test-sidecoach-keyword.sh`, `install.sh:1048` + `install.sh:2613`.

Engine: `modes.ts` removed -> `lanes.generated.ts` + `scripts/generate-lanes.ts`;
`ralph-loop.ts` -> `convergence-loop.ts` (+ t20 rename AND expectation fix);
new `flow-validation-capabilities.ts` (canonical capability registry);
`flow-handler.ts` (typed `ProductValidationResult` / finding contracts);
`flow-handler-tactical-polish.ts` (pure product-validation entry point exposing
the matrix + linguistic/absolute-ban findings);
`sidecoach-orchestrator.ts` (lane API, per-step history refresh, status
mapping, verb-guidance aggregation, lane resume dispatch);
`checkpoint-store.ts` (schema v2 + migration); `flow-history.ts`
(project scoping); `slash-command-router.ts` (+ tests); shared classifier
module; `bin/sidecoach-monitor.js` (lane subcommands);
**`sidecoach/package.json`** (`npm test` becomes an enumerating runner over
`src/__tests__/` - today it runs ONLY `intent-detector.test.ts`, so the gate
could pass while every new lane suite never executes); `sidecoach/dist/*`.

MCP server: `registries.ts`, `keyword-resolver.ts`, `resolve-keyword` ->
`classify-intent`, new `lane` tool, `list-modes` -> `list-lanes`,
`schemas.ts`, `tools/index.ts`, `get-cheatsheet.ts`, README, DESIGN, all
test tiers + transcripts, `mcp-server/dist/*`.

Read-only generation input: `verb-command-registry.ts` (derivation source).

Docs/skill/marketing: SKILL.md + CHEATSHEET.md (generated sections, stepped
protocol, phrase docs); `marketing-site/cheatsheet.html` + `sidecoach.html`
via the visual verification gate.

OUT of scope (do not touch): visual-effects "bloom" (shader);
`ralph-loop@claude-plugins-official` (CC plugin); `reference/_extracted/*`;
`.claude/memory/*`.

## 15. Testing

`sidecoach/test-all.sh` wraps (exact commands):

```text
bash claude/hooks/test-sidecoach-keyword.sh
npx ts-node sidecoach/scripts/generate-lanes.ts --check
cd sidecoach && npm run build && npm test     # npm test = enumerating runner
cd sidecoach/mcp-server && npm run build && npm test
```

The enumerating runner self-tests: it fails if a required lane suite file
(state machine, checkpoint, scope binding, convergence) is absent from its
manifest.

Classifier corpus (hook + MCP, identical decisions on every shared outcome):
all v3 cases, plus:

- `make this production-ready` (natural) -> CONTEXT-CHECK, not OUT_OF_SCOPE.
- `/sidecoach make this production-ready` -> proceeds (SCOPE_UNKNOWN, no
  negatives).
- `The landing page is done. Make the migration production-ready.` -> never
  routes (clause binding).
- Bare TypeScript `interface`, packet `header`, memory `layout` -> never
  prove scope; qualified forms ("user interface", "page header") do.

Execution acceptance: all v3 cases, plus:

- `advanceLane complete` without a valid StepReport is rejected; the step
  cannot silently complete.
- Explicit retry, skip, interrupt, resume, and stop transitions persist and
  return documented statuses; status precedence verified.
- Two concurrent advances against one checkpoint: exactly one wins
  (expectedRevision CAS).
- Convergence state survives a fresh process per iteration; stall and cap
  still fire.
- Any REQUIRED PRODUCT-validator error/skip/unsupported result prevents
  `converged` (replacing the current t20 expectation that enshrines the
  opposite).
- Tactical polish's dedicated product-validation result changes after a real
  fixture mutation and can reach `clean`; generic memory/result-shape passes
  cannot enter the product gate.
- Audit's permanent manual-testing warning does not make convergence
  impossible; critique's framework-initialized pass never counts as clean
  evidence; advisory flow errors are surfaced but do not falsify the product
  gate.
- Every converged summary names the measured scope, clean policy, unverified
  scope, and advisory completion/error state.
- Capability-registry checks prove every loop lane has at least one product
  validator and that promoting an existing lane member automatically widens
  the required gate.
- Ship, delight, live, calm, and converge lanes each have defined, tested
  behavior on an existing UI with NO prior sidecoach history (waiver +
  preflight path) AND on a fresh-build fixture.
- `lane_delight` preflight has a defined, tested outcome on a project with UI
  source but no PRODUCT.md, no DESIGN.md, no staged tokens, and no history
  (the hardest precondition case: flowF context + register, flowH brand
  personality).
- `generate-lanes --check` fails on an unmet context/capability precondition
  without declared handling, not only a missing historical edge; and fails on
  unused, duplicate, broad-form, or stale waivers.
- `resume` against an interrupted checkpoint transitions to `in_progress`
  with the documented revision increment; any other action against an
  interrupted checkpoint is rejected.
- A real cross-process race (two concurrent `updateCheckpoint` calls) proves
  exactly one update succeeds via the lock-file CAS; stale-lock takeover is
  exercised and logged.
- Report-path containment: a symlink inside the project pointing outside it
  is rejected (realpath containment), as are non-regular files.
- Hook NUDGE mapping covers cooldown-active (`SILENT`) and cooldown-inactive
  (`NUDGE`) cases over the shared `NUDGE_ELIGIBLE` classifier outcome.
- Mixed-scope multi-clause prompts (negation, conjunctions, abbreviations)
  produce identical Python/TS outcomes from the shared segmentation fixtures.
- Checkpoint resolution with explicit `--project` and with cwd default.

Release acceptance targets: as v3 (zero ROUTE/CLASSIFY on negatives, zero
overrides of explicit verbs, full-corpus hook/MCP parity, `--check` green,
convergence proven against real fixture mutation with a truthful
measured/unverified summary, calibration report), plus: the aggregate runner's
manifest self-test proves the lane suites executed.

## 16. Out of scope

- The 22 verbs stay as direct triggers; the advisory nudge tier unchanged.
- No new magic keywords. Lane membership/verb chains not redesigned.
- Engine-owned mutation remains rejected, not deferred.
- Upgrading audit or critique into product validators is a separate follow-up
  feature, landed dimension-by-dimension with its own evidence and review.
