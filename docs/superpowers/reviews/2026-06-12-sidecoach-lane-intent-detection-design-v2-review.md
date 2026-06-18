# Independent Review: Sidecoach Lane Intent Detection v2

Date: 2026-06-12  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: revised design plus current hook registries, Sidecoach skill, execution engine, composite/checkpoint machinery, convergence loop, slash router, MCP server, and tests.

## Executive verdict

The revised design is materially stronger than v1. It resolves the original contradictions around score thresholds, explicit-verb precedence, canonical lane data, MCP migration scope, phrase routing intent, and the test gate. The overall product direction remains sensible.

It is still **not implementation-ready**. Two release-blocking contracts remain unsound:

1. The proposed design-eligibility gate still admits non-design work because it reuses ambiguous targets such as `table`, `view`, and `form`; `/sidecoach <phrase>` bypasses the scope gate entirely.
2. `runLane()` is specified as if engine flows perform the requested UI work and convergence can call an existing fix-application path. In the current repository, flows primarily emit guidance, checklists, artifacts, and validation findings; no engine fix-application path exists.

The sequence execution design also relies on composite behaviors that do not currently support lane prerequisites, dynamic-lane resume, user interruption, verb-guidance parity, or truthful lane status as claimed.

Recommendation: **conditional approval after all P0 and P1 findings below are resolved in the design**. The implementation should not begin from the current v2 contract because several acceptance claims are impossible under the stated architecture.

## Disposition of the v1 review

| v1 finding | v2 disposition | Assessment |
|---|---|---|
| No design-domain gate | Gate added in section 4 | **Partially resolved:** reused targets and explicit-address bypass still false-route non-design work |
| No lane execution contract | `runLane()` added in section 7 | **Partially resolved:** entry point named, but action boundary and callable dispatch remain undefined |
| `lane_converge` does not converge | Production caller and `applyFixes` claimed | **Unresolved:** referenced fix-application path does not exist |
| Lane-first precedence expands explicit verbs | Conflict now becomes CLASSIFY | **Resolved** |
| Score rules and invariant conflict | Eligible score >= 1 now CLASSIFYs | **Resolved** |
| Single source of truth was not real | Canonical JSON plus generated/validated mirrors | **Resolved in intent:** exact loading/generation strategy still needs a decision |
| MCP blast radius incomplete | Full migration section added | **Mostly resolved:** eligibility-registry parity and final public API remain unspecified |
| `/sidecoach <phrase>` unsupported | Parser fallback and structured resolution added | **Partially resolved:** no zero-evidence/out-of-scope result and scope bypass is unsafe |
| Test gate did not run affected suites | Exact commands and aggregate runner added | **Resolved in intent** |
| Evidence double counting and regex hardening | Grouped evidence and validation added | **Resolved in intent** |

## Prioritized findings

### P0. The eligibility gate still routes non-design work

The design says lane eligibility reuses `sidecoach-intent.json` substantive targets or standalone signals (`spec:132-147`). That registry was designed for a low-authority advisory nudge, not automatic multi-flow routing. Its substantive targets include ambiguous terms:

- `form`, `component`, and `screen` at `claude/hooks/sidecoach-intent.json:21-22`
- `view` at `claude/hooks/sidecoach-intent.json:23`
- `table` and `grid` at `claude/hooks/sidecoach-intent.json:24`

Those targets combine with strong lane phrases to produce confident non-design routes:

| Prompt | Gate evidence | Lane evidence | Unsafe result |
|---|---|---|---|
| `build a database table from scratch` | `table` | `from scratch` | ROUTE `lane_build` |
| `make this database view production-ready` | `view` | `production-ready` | ROUTE `lane_ship` |
| `don't stop until the form validation tests pass` | `form` | converge phrase | ROUTE `lane_converge` |
| `simplify the grid computation before launch` | `grid` | calm + ship evidence | CLASSIFY |

This contradicts the design-only constraint (`spec:42-44`) and the release target of zero lane actions in the non-design negative corpus (`spec:361-363`, `spec:383`).

The explicit phrase rule is broader still: `/sidecoach <phrase>` bypasses the eligibility gate (`spec:142`, `spec:270-272`). Therefore `/sidecoach build the API from scratch` and `/sidecoach don't stop until unit tests pass` are explicitly routed into a design-only system.

**Recommendation**

Separate high-authority lane eligibility from the advisory nudge registry. Define a dedicated lane-scope policy with:

- required UI/design-domain evidence or an explicitly selected design target;
- negative filters for database, API, backend, CI, test, migration, infrastructure, and prose contexts;
- an `OUT_OF_SCOPE` outcome;
- explicit Sidecoach address raising confidence, but never bypassing scope.

Add the ambiguous registry targets above to the negative corpus. Acceptance must assert zero ROUTE **and zero CLASSIFY** outcomes.

### P0. `runLane()` conflates guidance generation with doing the work

The design says a sequence lane executes its deduplicated `flowChain` as one engine operation and that the model should drive the lane through that operation rather than hand-interpret the chain (`spec:228-239`). It also says convergence wires `applyFixes` to the engine's fix-application path (`spec:247-250`).

That does not match the current engine contract:

- The Sidecoach skill explicitly instructs the model to run the engine, then use its output as an implementation plan and act on it (`claude/skills/sidecoach/SKILL.md:38-50`).
- Representative execution handlers return guidance, checklists, and reference artifacts rather than modifying the product (`sidecoach/src/flow-handler-component-implementation.ts:222-269`).
- Tactical polish scans and validates the project; it does not apply fixes (`sidecoach/src/flow-handler-tactical-polish.ts:176-250`).
- The convergence module states that handlers report findings and have no fix mode today (`sidecoach/src/ralph-loop.ts:12-19`, `sidecoach/src/ralph-loop.ts:119-125`).
- Repository search finds no engine fix-application path. `applyFixes` exists only as an optional convergence-loop callback and in its tests.

Running the whole lane inside the engine therefore produces a batch of plans/findings before the model performs the implementation work. Later flows cannot validate or refine changes that have not happened yet. `lane_converge` cannot progress unless a new, concrete mutation mechanism is designed and built.

**Recommendation**

Choose and document one truthful architecture:

1. **Model-driven lane state machine:** `runLane()` returns the next flow's guidance; the model performs the work; a structured continuation validates the result and advances to the next flow. Convergence alternates findings, model/tool work, and validation.
2. **Engine-owned mutation:** define a real fix executor, its permissions, supported change types, failure behavior, and validation boundary before claiming lanes implement or converge.
3. **Planning-only lane:** explicitly state that sequence lanes aggregate implementation guidance and that convergence is not part of this release.

The current phrase "engine's fix-application path" must be removed or replaced with the exact new API and implementation contract.

### P1. The ROUTE directive has no model-callable `runLane()` surface

The directive tells the model to invoke `runLane("{lane}", target)` semantics (`spec:199-206`), but the proposed TypeScript method is not itself a callable model tool. Current documented invocation is the monitor CLI (`claude/skills/sidecoach/SKILL.md:38-50`), which only calls `engine.process(utterance)` (`sidecoach/bin/sidecoach-monitor.js:47-56`).

The spec does not define:

- a CLI/internal command that directly invokes `runLane`;
- an MCP execution tool;
- how a CLASSIFY selection transitions into `runLane`;
- how target and conversation context are serialized into that call.

Without a concrete surface, the natural-language hook can classify correctly while the model cannot reliably dispatch the structured operation.

**Recommendation**

Specify one executable contract, for example:

```text
sidecoach-monitor --lane lane_ship --target "<target>"
```

or a dedicated `sidecoach_run_lane` tool. Define the same dispatch after ROUTE and after a CLASSIFY selection, with end-to-end tests that begin at hook/parser output and observe `runLane()` execution.

### P1. Existing composite machinery does not satisfy the claimed lane behavior

The sequence contract says prerequisites, failures, BuildReports, and checkpoints behave exactly as composite flows do today (`spec:228-234`). Reusing the current composite path without changes is not sufficient:

- `runCompositeLoop` snapshots flow history once before the loop (`sidecoach/src/sidecoach-orchestrator.ts:193-194`) and checks every step against that stale snapshot (`sidecoach/src/sidecoach-orchestrator.ts:203-210`).
- The separate slash verb-chain path was later fixed to refresh history each iteration because the stale snapshot made chain dependencies fail (`sidecoach/src/sidecoach-orchestrator.ts:905-918`).
- Lane chains include prerequisite-dependent flows; for example, design tokens require brand verification (`sidecoach/src/flow-prerequisites.ts:54-60`).

As written, a clean `lane_build` run can skip or fail later steps even after its earlier prerequisites succeed.

**Recommendation**

Make refreshing prerequisite history part of the lane/composite change, and add clean-sandbox tests for every sequence lane. Do not rely only on histories pre-populated by earlier test runs.

### P1. Dynamic lane checkpoint/resume and interruption are not designed

The design claims interrupted lanes resume through the existing checkpoint mechanism (`spec:230-232`) and that user correction/cancellation stops a lane immediately (`spec:205-206`, `spec:254-255`, `spec:303-304`).

Current resume behavior only resolves checkpoint ids against static preset composite flows:

- `SidecoachCheckpoint` stores only a `compositeFlowId: FlowId` (`sidecoach/src/checkpoint-store.ts:9-18`).
- Resume looks up only `PRESET_COMPOSITE_FLOWS` (`sidecoach/src/sidecoach-orchestrator.ts:1117-1126`).
- The preset list contains four static composites, not dynamically constructed lane operations (`sidecoach/src/flow-composition.ts:582-590`).

No cancellation token, `AbortSignal`, or user-input channel exists in the execution or convergence paths. A user message cannot interrupt one in-flight engine call under the current contract.

**Recommendation**

Define:

- checkpoint operation kind (`composite` or `lane`) and stable lane id;
- lane-registry resolution during resume;
- checkpoint schema/version migration;
- cancellation transport, polling points, and an `interrupted` result;
- whether interruption preserves or deletes the checkpoint.

Add `checkpoint-store.ts` and resume dispatch to the blast radius, then test interruption and resume for both sequence and loop lanes.

### P1. Lane status and verb-guidance parity are underspecified

`SidecoachResult.lane.status` is introduced without a status model for sequence lanes (`spec:236-237`). Current composite success means only that at least one flow succeeded (`sidecoach/src/sidecoach-orchestrator.ts:412-425`), so a lane could be reported as successful despite required errors or skips.

The spec also says verb-specific guidance applies via the verb-parity layer (`spec:78-80`, `spec:233-234`). Current parity guidance is appended for one command after a slash verb chain (`sidecoach/src/sidecoach-orchestrator.ts:1023-1038`, `sidecoach/src/sidecoach-orchestrator.ts:1490-1510`). `runCompositeLoop` does not append guidance for every contributing verb, and a deduplicated `flowChain` loses the mapping from flows back to verbs.

**Recommendation**

Define sequence statuses such as `completed | partial | failed | interrupted`, including exact mapping from flow results and required steps. Preserve `verbChain` during execution and append each selected verb's guidance exactly once in chain order. Add status and guidance-parity assertions for every lane.

### P1. `/sidecoach <phrase>` needs zero-evidence, typo, and out-of-scope outcomes

The proposed phrase resolution can return only `ROUTE | CLASSIFY` (`spec:265-268`). That leaves no defined result for:

- `/sidecoach foo`;
- `/sidecoach polsih button`;
- `/sidecoach status`;
- `/sidecoach build the API from scratch`.

The current parser returns a helpful unknown-command result when no known command exists (`sidecoach/src/slash-command-router.ts:102-109`). A universal phrase fallback can turn typos and unsupported commands into unnecessary interviews or unsafe lane routes.

**Recommendation**

Use a result union such as:

```text
ROUTE | CLASSIFY | OUT_OF_SCOPE | UNKNOWN
```

Only CLASSIFY when lane evidence exists. Preserve unknown-command/typo suggestions when it does not. Keep the design-domain scope gate active for explicit phrases.

### P1. MCP parity omits the eligibility input and leaves the public API undecided

The MCP migration requires hook/MCP decision parity (`spec:277-291`, `spec:385`), but the decision now depends on `sidecoach-intent.json`. The current MCP registry loader has verb and mode registry paths but no intent-registry path or eligibility loader (`sidecoach/mcp-server/src/registries.ts:42-48`, `sidecoach/mcp-server/src/registries.ts:60-150`).

The spec's `sidecoach_classify_intent (or versioned result shape)` wording (`spec:285-287`) also leaves the public API choice unresolved. An implementation-ready design must select the tool name/result migration strategy.

**Recommendation**

Add the lane eligibility registry/policy to the MCP blast radius and shared parity fixtures. Decide now whether this is a renamed tool or a versioned result on the existing tool, including compatibility behavior for existing clients.

### P2. Canonical registry loading and generated-doc enforcement need an exact build strategy

The canonical-registry direction is correct, but "`lanes.ts` loads/generates typed data from the JSON" (`spec:91-94`) leaves two materially different approaches open. The JSON lives outside the Sidecoach TypeScript source root, and the MCP server currently depends on the parent compiled package before it builds (`sidecoach/mcp-server/src/registries.ts:17-24`).

The design also does not define generated-section markers, whether generated docs are checked in, or the command/CI check that proves generated content is current.

**Recommendation**

Choose one strategy:

- generate `lanes.generated.ts` from canonical JSON before the parent build; or
- runtime-load and validate JSON from a documented resolved path.

Define build ordering, checked-in artifact policy, generated-doc markers, and a `--check` parity command.

### P2. Occurrence-aware informational suppression needs a concrete algorithm

The desired behavior is clear (`spec:122-130`), but "informational spans are removed" is not yet an implementable rule. Informational frames can overlap imperative text, and Python/JavaScript regex behavior can diverge.

**Recommendation**

Define the span extraction/removal algorithm and put all edge cases in the shared Python/TypeScript parity corpus, including multiple occurrences, punctuation, multiline prompts, quoted text, and mixed informational/imperative phrasing.

## Required design changes before implementation

1. Replace the reused-target eligibility rule with a lane-specific scope policy and keep it active for `/sidecoach <phrase>`.
2. Define the action boundary: model-driven state machine, real engine mutation, or planning-only lanes.
3. Replace the nonexistent "engine fix-application path" with an exact convergence integration or defer `lane_converge`.
4. Define the callable dispatch surface for ROUTE and post-CLASSIFY selection.
5. Extend composite/checkpoint machinery for fresh prerequisite history, dynamic lane resume, cancellation, and truthful sequence status.
6. Define verb-guidance aggregation and preserve the verb-to-flow relationship.
7. Add `OUT_OF_SCOPE` and `UNKNOWN` phrase outcomes.
8. Include eligibility-policy loading in MCP parity and decide the public API migration.
9. Select the canonical JSON loading/generation strategy and generated-artifact check.

## Minimum acceptance additions

Add these cases to the existing test plan:

- Ambiguous-target negatives: database `table`, database `view`, validation `form`, compute `grid`, backend `component`, and non-UI `screen`.
- Explicit-address negatives: `/sidecoach build the API from scratch` and `/sidecoach don't stop until unit tests pass` -> `OUT_OF_SCOPE`.
- Unknown phrase and typo behavior: `/sidecoach foo`, `/sidecoach polsih button`.
- Hook ROUTE -> callable lane dispatch; CLASSIFY selection -> the same callable lane dispatch.
- Every sequence lane from a clean project/history, proving prerequisites refresh during the operation.
- Sequence lane partial/error/interrupted status mapping.
- Dynamic lane checkpoint write, interruption, and resume.
- One verb-guidance block per verb in lane order, with deduplicated flows still running once.
- Convergence with a real mutation step, not a test-only state-changing mock.

## Final assessment

The revisions demonstrate good response to the v1 review and make the classifier portion substantially coherent. The remaining problems are concentrated at the scope and execution boundaries, where incorrect assumptions would produce the most user-visible failures.

Once the P0 and P1 items are specified, the design should be reviewed one more time against the updated execution and checkpoint contracts. Until then, the appropriate status is **promising but not implementation-ready**.
