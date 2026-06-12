---
name: lane intent detection design v3 - model-driven action model
description: Second review verified and folded into spec v3; Jonah chose the model-driven lane state machine; engine fix-application fiction removed
type: decision
relates_to: [session_2026-06-12_lane-design-v2-review-revision.md]
supersedes: session_2026-06-12_lane-design-v2-review-revision.md
superseded_by: session_2026-06-12_lane-design-v4-execution-truthfulness.md
---

Spec revised to v3 after the second independent review. All v2 P0/P1/P2
findings verified against the codebase first (all confirmed) and resolved.

**Choice made (Jonah, 2026-06-12): lanes are a MODEL-DRIVEN STATE MACHINE.**
The engine serves guidance and validates; the model performs the work between
steps. `runLane()` becomes `startLane / advanceLane / laneStatus` on
FlowExecutionEngine, dispatched via new `sidecoach-monitor lane` subcommands
and a mirrored `sidecoach_lane` MCP tool.

**Alternatives considered:**
- Engine-owned mutation: rejected - requires building a fix executor,
  permissions model, and cancellation transport that do not exist, and
  inverts the architecture (flows advise/validate; the model acts).
- Planning-only lanes: rejected - walks back the wire-converge-now decision
  and ships the weakest feature (augment-never-nerf).

**Why this one:** matches how sidecoach actually works today (SKILL.md: run
engine, act on output). Convergence stays wired and honest - findings ->
model fixes -> revalidate, with reused stall/cap/signature machinery and
truthful exit statuses. Interruption becomes nearly free: no long-running
engine call exists, the model just stops advancing, checkpoint preserved as
`interrupted`.

**Other v3 changes (review-driven, all claims verified at cited lines):**
- Dedicated lane-scope policy replaces the borrowed nudge registry gate
  (ambiguous targets table/view/form/grid/component/screen admitted "build a
  database table from scratch"); negative_filters veto; OUT_OF_SCOPE outcome;
  scope stays ACTIVE for /sidecoach <phrase>; acceptance = zero ROUTE and
  zero CLASSIFY on negatives.
- Per-step prerequisite history refresh (runCompositeLoop's single stale
  snapshot at sidecoach-orchestrator.ts:194 is the same bug Sprint-12 T4
  fixed for verb chains at :905-918; lanes do not inherit it).
- Checkpoint schemaVersion 2 (operationKind, laneId, stepReports), lane
  resume via registry not PRESET_COMPOSITE_FLOWS, v1 migration shim.
- Truthful status model completed|partial|failed|interrupted (composite's
  "success = any one flow passed" rule at :412-425 explicitly not used).
- verbChain entries keep verb-to-flow mapping; guidance once per verb.
- Phrase resolution union ROUTE|CLASSIFY|OUT_OF_SCOPE|UNKNOWN; typos keep
  suggestion behavior.
- MCP API decided: sidecoach_resolve_keyword REPLACED by
  sidecoach_classify_intent (clean rename, no external clients); scope
  policy included in parity fixtures.
- Canonical strategy decided: generate lanes.generated.ts pre-build +
  --check gate; generated doc sections with markers.
- Occurrence-aware suppression algorithm made concrete: blank informational
  spans (length-preserving), then score; shared Python/TS edge-case corpus.

**Self-analysis (mandatory):** v2 contained "applyFixes wired to the engine's
fix-application path" - a path that DOES NOT EXIST. I had read ralph-loop's
header stating handlers have no fix mode, and still wrote the integration as
if the target existed. Same failure shape as the v1 grep miss: asserting
existence without looking. Rule: every integration point named in a spec must
be either verified to exist (file:line) or explicitly marked as new work to
build. The hook also false-fired TWICE on pasted review documents (shape,
then polish verbs) - live motivation now cited in spec section 3.

**Revisit when:** implementation finds the stepped lane protocol too chatty
in practice (too many monitor round-trips per lane), or checkpoint schema v2
migration proves harder than the shim assumes.

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v3 rewrite)
