# Independent Review: Sidecoach Lane Intent Detection v3

Date: 2026-06-12  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: v3 design plus current hook, lane predecessors, verb registry, execution handlers, prerequisite/history systems, checkpoint store, convergence loop, monitor CLI, MCP server, and test commands.

## Executive verdict

v3 is a substantial improvement. It resolves the central v2 architecture error by making lanes model-driven stepped operations, keeps explicit phrase routing inside the design scope gate, defines a callable monitor/MCP surface, preserves verb ownership, chooses a generation strategy, and adds the missing phrase outcomes.

The design is now **close, but still not implementation-ready**. Four contracts remain blocking:

1. The stepped state machine does not define how model work becomes a validated successful step, how retry/skip/stop transitions are requested, or how a checkpoint becomes `interrupted`.
2. Stepped convergence does not persist the state required for stall/cap detection and can falsely report convergence when validators fail or emit no machine-readable findings.
3. The scope policy is still prompt-global and two-state. It cannot distinguish unknown scope from positive out-of-scope evidence, and it can bind UI evidence from one sentence to backend lane evidence in another.
4. Existing flow prerequisites are incompatible with several lane chains and are read from a global default-session history that can be empty for a real project or contaminated by unrelated projects.

Recommendation: **conditional approval after the P0 and P1 findings below are specified**. The classifier and product direction are sound; the remaining work is concentrated in execution truthfulness and state ownership.

## Disposition of the v2 review

| v2 finding | v3 disposition | Assessment |
|---|---|---|
| Borrowed eligibility gate false-routes ambiguous targets | Dedicated lane scope policy added | **Partially resolved:** scope still lacks unknown state and target/evidence binding |
| `runLane()` conflates planning with implementation | Model-driven stepped state machine selected | **Resolved in architecture; transition semantics incomplete** |
| No callable lane dispatch | Monitor lane subcommands + MCP tool defined | **Resolved in intent** |
| Composite path has stale prerequisite history | Lane path explicitly refreshes per step | **Partially resolved:** refresh does not solve missing/out-of-order prerequisites or global-history contamination |
| Dynamic lane resume/interruption unsupported | Checkpoint v2 and between-step interruption proposed | **Partially resolved:** checkpoint state and interrupt transition are incomplete |
| Sequence status and verb guidance underspecified | Status mapping and verb ownership added | **Partially resolved:** step success and status precedence are undefined |
| Phrase fallback lacks unknown/out-of-scope | Four-outcome phrase union added | **Resolved** |
| MCP eligibility and API choice unresolved | Scope loader and clean API rename selected | **Mostly resolved:** classifier result union is incomplete |
| Registry generation strategy unspecified | Generated TS/docs and `--check` selected | **Resolved in intent** |
| Informational suppression algorithm vague | Length-preserving span blanking defined | **Resolved in intent** |

## Prioritized findings

### P0. The stepped state machine has no complete transition contract

The design correctly states that the engine serves guidance and validates while the model performs work between calls (`spec:223-226`). However, the proposed API is:

```text
startLane(laneId, target, context) -> LaneStepResult
advanceLane(checkpointId, stepReport?) -> LaneStepResult
laneStatus(checkpointId) -> LaneState
```

`stepReport` is optional and has no schema (`spec:230-234`). The sequence section says the model and user can retry, skip, or stop (`spec:257-258`), but none of those actions exists in the API. The interruption section says the model simply stops advancing and the checkpoint is preserved with status `interrupted` (`spec:271-274`), but stopping calls cannot mutate an `in_progress` checkpoint into `interrupted`.

This leaves core behavior undefined:

- What exact event marks a step successful?
- Is success the flow handler returning `success`, the model asserting completion, required checklist items passing, or a post-work validator result?
- What happens when `advanceLane` is called without a report?
- How does the model request `retry`, `skip`, `interrupt`, or `stop`?
- How are multiple flow results within one verb step aggregated?
- Does `interrupted` override `partial`, or does a lane with completed steps become `partial` when stopped?
- What does the currently undefined `LaneState` contain?

Current handlers cannot answer this implicitly. `FlowExecutionResult.status: 'success'` means the handler successfully produced its output, while checklist items are created with `completed: false` (`sidecoach/src/flow-handler.ts:15-39`, `sidecoach/src/flow-handler.ts:115-120`). That is not proof the model performed the requested work.

**Recommendation**

Define a discriminated transition API, for example:

```text
advanceLane(checkpointId, {
  action: 'complete' | 'retry' | 'skip' | 'interrupt' | 'stop',
  report?: StepReport,
  expectedRevision: number
}) -> LaneStepResult
```

Define `StepReport`, required evidence, per-flow aggregation, validation behavior, and status precedence. Make `interrupt` an explicit state transition. Require a valid report for `complete`, or explicitly document that completion is model-attested rather than engine-validated.

### P0. The convergence contract can lose state and falsely report success

The design moves convergence into separate `advanceLane` calls (`spec:276-293`). That is the correct action boundary, but stall/cap detection requires state across calls. The proposed checkpoint v2 only names `operationKind`, `laneId`, and `stepReports` as additions (`spec:264-270`). It does not define persistence for:

- current iteration;
- previous finding signatures;
- no-progress count;
- max-iteration and no-progress caps;
- per-iteration validator errors;
- remaining findings and finding identity schema.

Without those fields, separate monitor or MCP processes cannot truthfully determine `stalled` or `capped`.

There are also two direct correctness gaps:

1. `LaneStepResult.status` is defined as `in_progress | completed | partial | failed | interrupted` (`spec:236-239`), but convergence claims `converged | stalled | capped | error` in that same status (`spec:278-290`).
2. The current convergence algorithm treats validator failure as zero findings and can declare convergence. `runRalphLoop` catches a runner error, records no findings, then declares convergence when total findings are zero (`sidecoach/src/ralph-loop.ts:265-303`). Its test explicitly expects an audit throw to still return `converged` (`sidecoach/src/__tests__/t20-ralph-loop.test.ts:256-277`).

Machine-readable finding extraction is also unspecified. The existing helper reads only `result.validationResults` (`sidecoach/src/ralph-loop.ts:166-193`), while audit and critique primarily store validation results in `result.memory`; critique is explicitly a framework initializer rather than an automated validator (`sidecoach/src/flow-handler-design-critique.ts:109-153`). A zero-finding result can therefore mean clean, unsupported, skipped, or failed.

**Recommendation**

Define a loop-specific checkpoint state and result type:

```text
convergence: {
  status: 'running' | 'converged' | 'stalled' | 'capped' | 'error' | 'interrupted',
  iteration,
  signatures,
  consecutiveNoProgress,
  limits,
  findings,
  validatorErrors
}
```

Define one canonical `FlowExecutionResult -> ConvergenceFinding[]` adapter that includes memory validations and structured validator results. A skipped, failed, unsupported, or unparseable validator must block convergence and produce `error` or `inconclusive`, never count as clean. Add an acceptance test proving validator failure cannot converge.

### P0. Scope needs an unknown state and target-local evidence binding

The dedicated scope policy is safer than v2, but the decision flow reduces scope to `in-scope | out-of-scope` (`spec:159-177`). That conflates two different cases:

- **positive out-of-scope evidence:** `build the API from scratch`;
- **no domain evidence in a short contextual follow-up:** `make this production-ready`.

The hook receives only the current prompt text, not conversation history (`claude/hooks/sidecoach-keyword.sh:59-75`). Therefore natural follow-ups central to this feature, such as `bring it to life`, `calm it down`, or `/sidecoach make this production-ready`, have lane evidence but may have no `ui_evidence`. Under the current two-state contract they become `OUT_OF_SCOPE`, even when the conversation is clearly about UI.

Prompt-global matching also allows evidence to bind to the wrong target:

```text
The landing page is done. Make the migration production-ready.
```

`landing page` supplies UI evidence. `production-ready` supplies ship-lane evidence. The `migration` negative filter is not in the same sentence as the matched UI target, so the described veto rule (`spec:135-141`) does not clearly prevent a route.

Some listed "unambiguous" signals are themselves ambiguous outside UI work: `interface`, `header`, and `layout` can mean a TypeScript interface, packet header, or memory layout. Look/feel phrases can also overlap lane evidence, allowing one weak occurrence to prove both scope and lane intent.

**Recommendation**

Use a three-state scope result:

```text
IN_SCOPE | OUT_OF_SCOPE | SCOPE_UNKNOWN
```

Bind lane evidence, UI evidence, and negative evidence to the same sentence/clause or resolved target. For natural prompts, `SCOPE_UNKNOWN` should not auto-route; it can stay silent or inject a context-check directive for the main model. For explicit `/sidecoach <phrase>`, allow no-negative `SCOPE_UNKNOWN` to proceed to CLASSIFY or ROUTE because the user explicitly selected Sidecoach, while positive negative evidence still returns `OUT_OF_SCOPE`.

Add cross-sentence and ambiguous-signal fixtures, including TypeScript `interface`, packet `header`, memory `layout`, and UI-evidence/backend-target prompts.

### P1. Lane prerequisites cannot rely on refreshed global flow history

Refreshing history at every step fixes the stale-snapshot bug, but it does not make the preserved lane chains executable.

Examples from the current contracts:

- `lane_ship` begins with audit: `flowK_multi_lens_audit` requires prior `flowJ_tactical_polish`; accessibility and responsive validation require prior `flowG_component_implementation` (`sidecoach/src/flow-prerequisites.ts:78-112`).
- `lane_delight` begins with design tokens, which requires brand verification, then motion integration requires motion-pattern research (`sidecoach/src/flow-prerequisites.ts:54-76`).
- `lane_converge` begins with tactical polish, which requires component implementation (`sidecoach/src/flow-prerequisites.ts:87-99`).

Those prerequisites are not present earlier in several lane chains. An existing UI can be perfectly valid for a ship or convergence lane without having prior Sidecoach flow history.

The current history store also lives globally at `~/.claude/sidecoach-flow-history.json`, keyed by `SIDECOACH_SESSION_ID` or the shared default `"default"` (`sidecoach/src/flow-history.ts:10-12`, `sidecoach/src/flow-history.ts:270-283`). Separate monitor calls can therefore see no relevant history or accidentally satisfy prerequisites from another project.

This conflicts with the acceptance case that every sequence lane runs from a clean project/history (`spec:423-428`).

**Recommendation**

Define a lane-specific prerequisite policy. Prefer checkpoint-local completed steps plus project-state preflight over global historical execution. For each flow in each lane, decide whether to:

- include required prerequisite flows in the lane;
- satisfy prerequisites from verified project state;
- waive history-only prerequisites for validation/refinement lanes; or
- fail the lane preflight with a clear, actionable result.

Make history project-scoped if it remains an input. Add per-lane expected-outcome tests from both a fresh build fixture and an existing-UI-with-no-Sidecoach-history fixture.

### P1. The MCP classifier result cannot be decision-identical to the hook

The decision flow contains `ROUTE`, `CLASSIFY`, `OUT_OF_SCOPE`, `NUDGE`, and `SILENT`, plus explicit verb and known-command routes (`spec:159-191`). The decided MCP result union contains only:

```text
ROUTE | CLASSIFY | OUT_OF_SCOPE | UNKNOWN | VERB
```

(`spec:323-327`)

`NUDGE` and `SILENT` are absent, and `UNKNOWN` is defined for an explicit `/sidecoach <phrase>` with no lane evidence rather than ordinary silent natural-language prompts. Therefore the full hook/MCP "decision-identical" acceptance target (`spec:398-443`) is not implementable without inventing a mapping.

**Recommendation**

Either include every hook outcome in the classifier result union or narrow parity explicitly to a shared lane-classification sub-result. Keep phrase-parser `UNKNOWN` separate from natural classifier `SILENT`.

### P1. Canonical ownership of verb flow mappings remains split

The canonical lane JSON stores each verb and its `flowIds` (`spec:46-72`), while `verb-command-registry.ts` separately owns each verb's flow IDs and guidance. The sample lane record already encodes first-owned/deduplicated flows rather than each verb's complete current mapping: current `critique` includes both design critique and multi-lens audit, and `polish` includes tactical polish and responsive validation (`sidecoach/src/verb-command-registry.ts:88-148`).

That may preserve the current flat lane sequence, but it is not the verb-to-flow mapping described by the field name. A future verb registry change can silently diverge from generated lane data and guidance behavior.

**Recommendation**

Choose one:

- store only `verbChain: string[]` in lane JSON and derive owned/deduplicated flows from the canonical verb registry during generation; or
- rename the field to `ownedFlowIds` and add a parity validator proving its derived flat sequence matches the verb registry's deduped chain.

The generated-artifact `--check` should validate this cross-registry relationship, not only JSON-to-generated-file drift.

### P1. The named test gate still does not run the proposed lane suites

The aggregate command list includes `cd sidecoach && npm test` plus the convergence test (`spec:386-396`). Today `sidecoach/package.json` defines `npm test` as only `ts-node src/intent-detector.test.ts`; it does not run the 87 standalone files under `src/__tests__`, including future lane execution/checkpoint suites.

The design lists extensive execution acceptance tests (`spec:423-437`) but does not add `sidecoach/package.json` or an execution-test runner to the blast radius. Unless that script changes, the gate can be green while the new state machine tests never run.

**Recommendation**

Make one authoritative command actually enumerate and run the intended suites. Add the package test runner/configuration to the blast radius, and include a self-test that fails if a required lane test file is omitted.

### P2. Public checkpoint/report inputs need operational hardening

The new CLI and MCP surfaces expose checkpoint ids and `--report <path|json>` (`spec:242-248`). Checkpoints are stored under a project-specific directory, but `advanceLane(checkpointId, ...)` does not carry a project path. A new monitor/MCP process needs a defined way to locate the correct checkpoint; relying on current working directory should be explicit and tested.

The report input also needs a schema, size cap, and path policy. If report paths are accepted, restrict them to the project root or remove path loading and accept structured JSON only. Add checkpoint revision/compare-and-swap semantics so two advances cannot execute the same step concurrently.

### P2. A few surface contracts remain internally inconsistent

- Decision 5 still says `runLane()` is built now (`spec:21-22`), while the actual API is `startLane` / `advanceLane` / `laneStatus`.
- The monitor has `lane list`, while the MCP mirror lists only start / advance / status (`spec:242-248`, `spec:328-329`).
- The supposedly exact generation check command remains `node ...generate-lanes.js --check (or ts-node)` (`spec:388-396`).

These are small, but resolving them prevents implementers from choosing incompatible surfaces.

## Required design changes before implementation

1. Define the full lane state machine: transition actions, `StepReport`, step success, per-flow aggregation, status precedence, and explicit interruption.
2. Define and persist convergence state across calls; make validator failure/inconclusive output block convergence.
3. Add `SCOPE_UNKNOWN` and bind lane/scope/negative evidence to the same target or clause.
4. Replace global-history prerequisite assumptions with a lane-specific, project-scoped prerequisite policy.
5. Reconcile loop statuses with `LaneStepResult.status`.
6. Complete the MCP outcome union or narrow the parity claim.
7. Make verb-to-flow derivation/parity part of canonical generation.
8. Ensure the aggregate test command actually runs every new lane suite.
9. Define checkpoint location, concurrency, and report-input hardening.

## Minimum acceptance additions

- `make this production-ready` and `/sidecoach make this production-ready` exercise `SCOPE_UNKNOWN` behavior rather than false `OUT_OF_SCOPE`.
- Cross-target prompt: `The landing page is done. Make the migration production-ready.` never routes a lane.
- Ambiguous scope signals: TypeScript `interface`, packet `header`, memory `layout`.
- Calling `advanceLane` without a valid completion report cannot silently complete a step.
- Explicit retry, skip, interrupt, resume, and stop transitions persist and return the documented status.
- Two concurrent advances against one checkpoint cannot run the same step twice.
- Convergence state survives a new process for every iteration and still detects stall/cap.
- Any validator error, skip, unsupported result, or missing finding adapter prevents `converged`.
- Ship, delight, live, calm, and converge lanes have defined behavior on an existing UI with no prior Sidecoach history.
- Hook and MCP parity covers every declared shared outcome.
- The aggregate runner proves it executed the lane state-machine, checkpoint, scope-binding, and convergence suites.

## Final assessment

v3 has crossed the important architectural threshold: it no longer assumes the engine edits code, and its classifier design is mostly coherent. The remaining gaps are not a reason to redesign the feature again; they require making state transitions, scope binding, convergence evidence, and prerequisite ownership explicit.

After those contracts are added, the design should be implementation-ready. Current status: **close, but blocked on execution truthfulness and state ownership**.
