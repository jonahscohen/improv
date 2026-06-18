# Independent Review: Sidecoach Lane Intent Detection v4

Date: 2026-06-12  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: v4 design plus current hook, intent registry, verb/lane predecessors, execution handlers, validators, prerequisites, checkpoint store, MCP server, and test commands.

## Executive verdict

v4 resolves the v3 review findings in design intent. The state machine now has explicit transitions and evidence, convergence state is persisted, scope is three-state and clause-bound, prerequisites are no longer delegated to global history, MCP outcomes are separated correctly, verb-flow ownership is derived, and the test gate is finally authoritative.

The design is **very close, but not yet implementation-ready against the current repository**. Two remaining blockers are capability mismatches rather than missing prose:

1. `lane_converge` requires a fully clean run of polish, audit, and critique, but current audit/critique handlers are guidance/framework initializers rather than project validators. Under the proposed adapter, convergence is either impossible or falsely clean.
2. Lane preflight waives historical prerequisites but does not address flow `contextRequirements` and `canExecute` contracts. The accepted no-history refinement paths, especially `lane_delight`, can still error or skip before serving useful guidance.

Recommendation: **approve the classifier and state-machine architecture, but resolve the two P0 capability contracts and the P1 state/parity details below before implementation begins**.

## Disposition of the v3 review

| v3 finding | v4 disposition | Assessment |
|---|---|---|
| State-machine transitions incomplete | Transition union, `StepReport`, validation, status precedence added | **Resolved in intent** |
| Convergence state not persisted; failures could converge | Persisted convergence state and inconclusive rule added | **Partially resolved:** selected flows cannot supply the required clean evidence |
| Scope needs unknown state and local binding | `SCOPE_UNKNOWN` and clause binding added | **Mostly resolved:** segmentation and mixed-clause aggregation still need exact rules |
| Prerequisites rely on global history | Checkpoint-local ordering, waivers, project-scoped history added | **Partially resolved:** context/canExecute requirements remain |
| MCP result union incomplete | Natural and phrase unions separated; full natural union added | **Partially resolved:** NUDGE parity inputs/state are omitted |
| Verb-flow ownership split | Flow sequence derived from canonical verb registry | **Resolved** |
| Test gate omitted lane suites | Enumerating runner and manifest self-test added | **Resolved in intent** |
| Checkpoint/report hardening missing | Project path, size/schema/path restrictions, revision CAS added | **Mostly resolved:** atomic CAS mechanism remains unspecified |
| Surface inconsistencies | API/list/check commands aligned | **Resolved** |

## Prioritized findings

### P0. The selected convergence flows cannot prove a fully clean UI

The v4 convergence rule is correct in principle: every validator must run, validator errors/skips/unsupported output are inconclusive, and only a fully clean iteration can converge (`spec:296-333`).

The current `polish -> audit -> critique` chain cannot meet that contract:

- Tactical polish performs real project scans and emits structured validation results (`sidecoach/src/flow-handler-tactical-polish.ts:350-427`).
- Multi-lens audit initializes a fixed checklist/framework. Its memory always records a warning that manual testing is required, regardless of the target (`sidecoach/src/flow-handler-multi-lens-audit.ts:163-217`).
- Design critique explicitly says it has no automated validator results today. Its memory records only `Design critique: pass - Framework initialized` (`sidecoach/src/flow-handler-design-critique.ts:109-153`).
- The registered domain validators for audit inspect whether the handler output contains performance guidance; they do not inspect whether the product passes (`sidecoach/src/flow-domain-validators.ts:47-76`, `sidecoach/src/flow-domain-validators.ts:219-248`).

The proposed canonical adapter reads memory-stored validations because audit/critique store them there (`spec:307-311`). That creates an unsatisfiable choice:

- Treat audit's permanent warning as a finding: the lane can never reach zero findings.
- Ignore it: audit contributes no product-quality evidence.
- Treat critique's framework-initialized pass as clean: the lane can falsely claim the UI passed critique.
- Mark audit/critique unsupported: every iteration is inconclusive and can never converge.

This conflicts with the release acceptance target that `lane_converge` demonstrably converges against a real fixture mutation.

**Recommendation**

Define an explicit convergence-capability registry. A convergence-required flow must produce target-derived, machine-readable findings with a clean/inconclusive/error distinction.

Choose one before implementation:

1. Upgrade audit and critique handlers to perform actual project validation and emit `ConvergenceFinding[]`.
2. Keep their verb guidance in the lane, but exclude them from the required convergence gate and name the exact deterministic validators that decide clean.
3. Redesign the converge flow membership despite the current out-of-scope statement.

Do not use general memory validation entries or output-shape domain validators as proof that the product is clean.

### P0. Prerequisite waivers do not make lane flows executable

Section 8 correctly removes global history from lane prerequisite decisions and adds generation-time checks for required prerequisite edges (`spec:264-294`). However, current flow executability has three separate gates:

1. flow-history prerequisites;
2. `contextRequirements`;
3. handler `canExecute`.

The v4 policy and generator cover only the first.

Concrete failures remain:

- `flowF_design_tokens` requires `designTokens` in context (`sidecoach/src/flow-prerequisites.ts:54-60`). The existing test explicitly confirms it errors without `DESIGN.md` or pre-staged tokens (`sidecoach/src/__tests__/sprint9-design-tokens-autoload.test.ts:41-55`).
- `flowF_design_tokens.canExecute` requires a project register (`sidecoach/src/flow-handler-design-tokens.ts:37-40`).
- `flowH_motion_integration.canExecute` requires brand personality (`sidecoach/src/flow-handler-motion-integration.ts:44-47`).

`lane_delight` derives both flows. Yet the proposed refinement preflight requires only an existing project with UI source and explicitly says `DESIGN.md` is noted, not required (`spec:278-284`). Waiving history does not satisfy these runtime gates, so the accepted existing-UI/no-history path can still error or skip.

**Recommendation**

Extend lane preflight and generation checks across all three executability layers:

```text
required historical edge
context requirement
handler capability/precondition
```

For every derived flow, declare how each unmet condition is handled: synthesized from project state, explicitly waived with a safe fallback, converted into step guidance, or rejected during preflight. Add a machine-readable capability/precondition registry; do not attempt to statically interpret arbitrary `canExecute` functions.

The per-lane acceptance matrix should state the expected result for projects with UI source but no `PRODUCT.md`, no `DESIGN.md`, and no prior Sidecoach history.

### P1. `prereqWaivers` must identify an exact dependency edge

The sample waiver is:

```json
{ "flowId": "flowJ_tactical_polish", "reason": "refinement lane operates on an existing UI; component implementation history not required" }
```

It is unclear whether `flowId` means:

- waive all prerequisites of `flowJ`;
- waive `flowJ` when another flow requires it; or
- waive one implied prerequisite, `flowG`.

This matters in `lane_ship`: `flowK` requires `flowJ`, while `flowJ` itself requires `flowG`. A broad flow-level waiver can silently waive future prerequisite edges added later.

**Recommendation**

Use an edge-specific schema:

```json
{
  "dependentFlowId": "flowJ_tactical_polish",
  "prerequisiteFlowId": "flowG_component_implementation",
  "reason": "Existing UI satisfies the implementation-history assumption"
}
```

Make `--check` reject unused, duplicate, broad, or no-longer-needed waivers.

### P1. Interrupted lanes have no defined resume transition

The transition union contains `complete | retry | skip | interrupt | stop` (`spec:202-207`). The design and acceptance tests repeatedly describe `resume` as an explicit behavior (`spec:231-233`, `spec:435-436`), but no `resume` action or rule exists.

An implementation must invent whether calling `retry`, `complete`, or any action against an interrupted checkpoint first resumes it. That affects revision changes, audit history, and user-facing status.

**Recommendation**

Either add `resume` to the transition union or state that the first valid non-interrupt transition atomically changes `interrupted -> in_progress` before applying its action. Add the exact revision/status behavior to the transition table.

### P1. Revision checking is not yet an atomic compare-and-swap contract

The expected revision field and exactly-one-wins acceptance test are good (`spec:203-207`, `spec:437-438`). However, the existing checkpoint store writes a temp file and renames it (`sidecoach/src/checkpoint-store.ts:43-51`). Atomic replacement does not make the read-revision/write sequence atomic: two processes can read revision 3, both accept it, and both replace revision 4.

**Recommendation**

Define a checkpoint update primitive with cross-process exclusion, such as:

```text
updateCheckpoint(checkpointId, expectedRevision, mutator)
```

implemented under a per-checkpoint lock file acquired with exclusive creation, with stale-lock recovery and atomic rename after validation. The engine API should never perform a separate unlocked read/check/write sequence.

### P1. Full MCP `NUDGE`/`SILENT` parity omits required registry and cooldown state

The MCP natural-classification union now correctly includes `NUDGE` and `SILENT` (`spec:343-355`). But NUDGE behavior is owned by `sidecoach-intent.json` and is stateful:

- its action/target/standalone/exempt patterns determine whether a nudge fires;
- the cooldown file suppresses nudges (`claude/hooks/sidecoach-intent.json:1-48`);
- the current MCP registry loader has no intent-registry or cooldown integration (`sidecoach/mcp-server/src/registries.ts:35-150`).

Section 11 lists a lane + scope-policy loader but does not add the advisory intent registry or define whether classification reads/mutates cooldown. Therefore “natural-classification result union matches the hook completely” is not yet implementable.

**Recommendation**

Specify one:

1. MCP loads `sidecoach-intent.json` and receives/reads the same cooldown state as the hook; or
2. shared classifier parity stops before delivery-state cooldown, returning a deterministic `NUDGE_ELIGIBLE`, while the hook alone maps it to `NUDGE | SILENT`.

Add the intent registry and cooldown contract to the MCP blast radius and parity fixtures.

### P1. Clause binding needs an exact segmentation and aggregation algorithm

The scope policy correctly requires lane, UI, and negative evidence to interact only within the same sentence/clause (`spec:107-151`). But “clause” is not defined, and the design does not say how multiple occurrences of the same lane across differently scoped clauses aggregate.

Examples needing deterministic outcomes:

```text
Don't make the API production-ready; make the landing page production-ready.
Make the API production-ready, but make the landing page production-ready too.
The deployment dashboard needs to be production-ready.
```

Python and TypeScript implementations can easily disagree on punctuation, conjunctions, abbreviations, and negated clauses.

**Recommendation**

Define a length-preserving clause segmentation algorithm and score/bind evidence per clause before aggregating lane scores. Specify precedence when one lane has both IN_SCOPE and OUT_OF_SCOPE occurrences. Add mixed-scope, negation, conjunction, and abbreviation cases to the shared parity corpus.

### P1. “Engine-validated where possible” needs a validator capability contract

For ordinary sequence steps, v4 says `advanceLane` re-runs validators when flows define them and a hard validation failure blocks completion (`spec:218-227`). The repository has several different validation surfaces:

- handler `validationResults`;
- memory validations;
- automatic domain validators;
- flow-specific validators;
- taste and mandate gates.

Many current validators inspect whether Sidecoach emitted appropriate guidance/checklists, not whether the model's product changes are correct. Re-running the full handler can also produce new guidance and history rather than a pure validation result.

**Recommendation**

Define a validator capability registry per flow:

```text
none | advisory | product_validator
```

For `product_validator`, name the callable validation entry point, required inputs, hard-failure rule, and finding adapter. Only product validators may block model-attested completion or participate in convergence.

### P2. Report-path containment must account for symlinks

Restricting report paths to the project root and capping them at 256KB is sensible (`spec:254-256`). A lexical path-prefix check can still follow a symlink inside the project to a file outside it.

**Recommendation**

Resolve the project and report paths with `realpath`, require the resolved report path to remain under the resolved project root, reject non-regular files, and read with no-follow semantics where supported.

### P2. Terminal checkpoint retention and lane listing behavior are unspecified

The design defines terminal status but not whether completed/stopped checkpoints are retained, deleted, or listed, nor how long interrupted lanes survive GC. Define terminal retention and whether `lane list` shows active, interrupted, and terminal lanes. This is operational rather than architectural, but it affects resume and supportability.

## Required design changes before implementation

1. Define which selected flows are genuinely convergence-capable, then make `lane_converge` clean evidence achievable and truthful.
2. Extend lane preflight/generation checks to context requirements and handler capability gates.
3. Make prerequisite waivers dependency-edge-specific.
4. Define interrupted-lane resume semantics.
5. Specify an atomic cross-process checkpoint CAS primitive.
6. Add advisory intent registry/cooldown behavior to MCP parity or narrow parity before cooldown.
7. Define exact clause segmentation and mixed-occurrence aggregation.
8. Define per-flow validator capabilities and pure validation entry points.

## Minimum acceptance additions

- A clean fixture can converge with every required convergence-capable validator proving clean.
- Audit/critique framework initialization alone can never count as a clean product result.
- Permanent advisory warnings do not make convergence impossible; required unresolved findings do.
- `lane_delight` preflight has a defined outcome with UI source but no `PRODUCT.md`, no `DESIGN.md`, no tokens, and no history.
- Generation fails on an unmet context requirement/capability gate, not only a missing historical prerequisite.
- Waivers identify exact dependency edges and fail when stale.
- An interrupted lane resumes through the documented transition with predictable revision changes.
- A real cross-process race proves exactly one checkpoint update succeeds.
- Hook/MCP NUDGE parity covers both cooldown-active and cooldown-inactive cases.
- Mixed-scope multi-clause prompts produce identical Python/TypeScript outcomes.

## Final assessment

v4 is the strongest revision and the underlying architecture is sensible. The remaining blockers are sharply bounded: make convergence depend on real product validators, and make lane preflight account for all actual execution gates.

After those capability contracts and the P1 details are added, the design should be implementation-ready. Current status: **architecturally approved, implementation blocked on validator capability and executable preflight**.
