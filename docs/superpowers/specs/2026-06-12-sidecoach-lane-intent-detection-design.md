# Sidecoach Lane Intent Detection - Design (v9)

Date: 2026-06-13
Collaborator: Jonah
Status: v9 is a SELF-AUDIT REPAIR pass over v8. v8 (the declarative
`ProductRuleDefinition` registry + defined `ProductFinding`/canonical-severity/
evaluation algorithm) resolved the two convergent cross-model P0s; the v8
review then found two contradictions v8 itself introduced (an exactly-once
overclaim - corrected to AT-MOST-ONE COMMITTED LANE TRANSITION with
idempotent/fenced side effects; and a universal source preflight that blocked
`lane_build` - corrected to a phase-aware gate). v9 fixes those AND a full
internal-consistency sweep that caught defects no prior review had: the
registration/rule-registry two-sources-of-truth, the per-rule-vs-global
severity ambiguity, the lease-struct/finalization-identity mismatch, the
lifecycle-vs-outcome status conflict with retention, Flow J's registryScope
overclaiming rules the partition delegates, an undefined rule-level error
status, and clean-with-findings semantics. Architecture (classifier,
model-driven state machine, checkpoint/resume, four-gate preflight, bounded
release floor) has been stable since v3. Reviews at `docs/superpowers/reviews/`.

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
   coach - with a bounded product-validation release floor** (Jonah,
   2026-06-12, fifth review). `lane_converge` keeps polish, audit, and
   critique in the loop, but only target-derived product validators decide
   clean. `lane_converge` is ENABLED only when the release floor is met:
   Flow J hardened into a coverage-aware product validator AND the static
   theming/token-consistency, CSS anti-pattern, and reliable static
   accessibility slices producing target-derived findings as independent
   product validators (section 9). Rendered responsive behavior, Core Web
   Vitals, screen-reader behavior, and Nielsen/cognitive-load critique remain
   advisory until their harnesses and confidence policies exist as separately
   reviewed features. The five sequence lanes and the classifier do not wait
   on the floor.

## Constraints

- model-router-guard (non-negotiable, 2026-06-11): no LLM calls from hooks.
- Sidecoach scope: design/UI work only. The lane tier enforces this itself.
- Engine flows emit guidance/checklists/findings/artifacts; they never modify
  the product. Step completion is model work, attested with evidence and
  engine-validated by the REGISTERED PRODUCT VALIDATORS bound to the step
  (v2's invented "engine fix-application path" remains rejected). Registered
  validators decide clean - flows and lanes only bind validator IDs; a flow's
  `capability` is derived from its bindings (`product_validator` iff it has at
  least one bound validator id, else `advisory`/`none`).
- Guidance/framework initialization is never product-validation evidence.
  Only a registered `product_validator` with target-derived findings may block
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
  prerequisite violation (section 8). It also fails if a loop lane's
  `LaneValidationPolicy` resolves no product validator, or if a registered
  product validator lacks its typed entry point, `registryScope`,
  `ownedRuleIds`, or `cleanPolicy`, or if any of the validator-registration
  rejections in section 7 fire.
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
--- explicit signals are evaluated BEFORE inferred-lane scope outcomes, so a
--- stated verb is never preempted by a CONTEXT-CHECK or an OUT_OF_SCOPE lane ---
6.  IN_SCOPE, route-grade lane (top >= route_floor, top - second >=
    route_margin), NO explicit verb -> ROUTE.
7.  IN_SCOPE, route-grade lane + explicit verb -> CLASSIFY (offers the verb,
    the lane, and "just handle it directly" - the deliberate no-silent-expand
    rule).
8.  Explicit verb present (ANY scope state) -> VERB route. Primary outcome is
    the verb; any lane evidence rides along as a NON-ROUTING diagnostic
    (laneScores + scope state) for the model's awareness, never a route.
9.  IN_SCOPE, top >= 1, no explicit verb -> CLASSIFY.
10. SCOPE_UNKNOWN + lane evidence, no explicit verb -> CONTEXT-CHECK (no auto-route).
11. OUT_OF_SCOPE + lane evidence, no explicit verb -> logged; no lane action.
12. Advisory nudge per its existing rules -> NUDGE.
13. Otherwise -> SILENT.
```

The decision is a primary outcome plus optional non-routing diagnostics, not a
single tag: a prompt with both an explicit verb and SCOPE_UNKNOWN/OUT_OF_SCOPE
lane language resolves to `VERB` (primary) with the lane scope attached as a
diagnostic - satisfying the zero-explicit-verb-overrides acceptance target.

Outcome table for IN_SCOPE prompts with NO explicit verb (`route_floor 3`,
`route_margin 2`): (0,0) nudge rules; (1,0)/(2,0) CLASSIFY; (3,0)/(3,1) ROUTE;
(3,2)/ties CLASSIFY. Any explicit verb present -> VERB (or CLASSIFY only when a
route-grade IN_SCOPE lane competes, step 7).

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
}                             // two concurrent advances cannot both COMMIT one step
                              // (they may overlap in execution - see lease protocol)

StepReport = {
  stepId,                                   // which step this reports on
  iteration,                                // loop lanes: which pass (0 for sequence)
  reportId,                                 // idempotency key; a re-sent reportId is a no-op
  verb: string,
  summary: string,                          // what was actually done
  evidence: { kind: 'files' | 'screenshot' | 'validation' | 'note',
              detail: string }[],           // at least one entry
  checklistResults?: { itemId: string, done: boolean }[]
}
```

`stepId` + `iteration` + `reportId` make reports idempotent and loop-aware: a
`complete` whose `(stepId, iteration)` does not match the lane's current
position is rejected; a duplicate `reportId` is a no-op returning the current
state (so a retried transport call cannot double-advance). `reportId` pairs
with the lease `operationId` (below) - the lease guards execution, the
reportId guards the report.

**Step success is model-attested with evidence, engine-validated by the
product validators bound to the step** - stated explicitly, not implied. A
flow handler's `status: 'success'` means the handler produced its guidance,
NOT that the work happened (`flow-handler.ts` creates checklist items
`completed: false`). So: `complete` without a valid StepReport is REJECTED
(the step stays current); otherwise `advanceLane` runs every product
validator bound to the step (section "Validator registration" below) and maps
the worst result deterministically - the SAME rule in sequence and loop
lanes:

```text
clean        -> completion may proceed
findings     -> validation_failed     (step stays current, findings returned)
inconclusive -> validation_inconclusive (step stays current, coverage gap returned)
error        -> validation_error      (step stays current, error returned)
```

Only an explicit user `skip` or `stop` bypasses an unclean, inconclusive, or
errored required validator (the bypass is recorded with its reason). Advisory
and capability-`none` flows never block model-attested completion; their
output coaches and is logged. Multiple flows/validators in one verb step
aggregate: all guidance served together at step start; all bound product
validators evaluated together at completion, worst-status-wins.

**Validator registration - product validators are first-class, not flow
properties.** v6 declared product-validator capability inline on flows, but
the release-floor slices (theming, anti-patterns, static a11y) are not owned
by any verb-flow, leaving the engine no way to discover or invoke them, and
making release gating accidentally depend on verb-flow ownership. v7 splits
identity from attachment across three registries in
`sidecoach/src/flow-validation-capabilities.ts`:

```text
ProductValidatorRegistration = {     // WHO a validator is (identity)
  // AUTHORED fields (the only hand-written ones):
  validatorId
  label                  // human-facing name for summaries
  validateProduct(context) -> ProductValidationResult   // the entry point
  // GENERATED (read-only) - derived from product-rule-registry.ts, NOT authored:
  ownedRuleIds[]         // = rules whose ownerValidatorId === this validatorId
  registryScope[]        // = union of owned rules' registryScope
  supportedSourceKinds[] // = union of owned rules' per-rule supportedSourceKinds
  cleanPolicy            // = generated per section "Concrete initial clean policies"
}

FlowValidationCapability = {          // how a FLOW relates to validators
  flowId
  productValidatorIds[]  // AUTHORED: validators bound to this flow's step (may be empty)
  capability             // GENERATED: 'product_validator' iff productValidatorIds
                         //   non-empty, else 'advisory'/'none' (never authored)
}

LaneValidationPolicy = {              // what a LANE requires to gate
  laneId
  requiredProductValidatorIds[]       // AUTHORED: resolved + invoked once per iteration
  excludedProductValidatorIds[]       // AUTHORED: member-flow validators intentionally not gating
}
```

Single source of truth: the per-validator derived fields (`ownedRuleIds`,
`registryScope`, `supportedSourceKinds`, `cleanPolicy`) are GENERATED from
`product-rule-registry.ts` and checked in; `--check` fails if an authored copy
diverges from the generated value, so the registration can never drift from
the rule registry.

A lane's required validator IDs resolve DIRECTLY against the registration
table and are invoked once per iteration regardless of which verb-flow (if
any) also references them; the release floor is a lane policy, not a side
effect of `verbChain`.

**Lane policy is explicit; flow capability never silently widens it (both
v7 reviews).** v7 contradicted itself by also saying a promoted lane-member
flow "automatically widens the required gate" - which restores the accidental
verb-flow coupling first-class registration exists to remove. v8 rule:
binding a validator to a flow gates that flow's sequence step; adding a
validator to a `LaneValidationPolicy` gates that lane; promoting a flow's
capability NEVER mutates a lane policy. `--check` FAILS (not warns) when a
loop lane contains a `product_validator` flow whose validator is neither
listed in the lane policy's `requiredProductValidatorIds` nor in an explicit
`excludedProductValidatorIds` - the author must classify it.

**Canonical declarative rule registry - the single source both reviews
require.** The v7 "selection rules" were prose over arbitrary `checkFunction`
bodies; a generator cannot decide whether a check needs a live DOM, contrast
metrics, or only CSS without interpreting TypeScript - which would recreate
the exact mirror-drift the design avoids. v8 introduces
`sidecoach/src/product-rule-registry.ts` as the canonical declarative source:

```text
ProductRuleDefinition = {
  ruleId
  canonicalRuleKey       // SAME key for the same semantic rule across registries
  ownerValidatorId       // exactly one owner per canonicalRuleKey
  severity               // canonical (table below), not the source vocabulary
  findingClass           // e.g. 'a11y' | 'theming' | 'anti-pattern' | 'copy' | 'polish'
  registryScope          // the user-facing claim this rule contributes to
  evidenceRequirements[] // e.g. 'css-rule' | 'computed-style' | 'dom' | 'markup' | 'contrast'
  supportedSourceKinds[] // PER RULE, with a support level (full | partial | none)
  scope                  // 'file' | 'component' | 'page' | 'project' - context the rule needs
  applicability          // when the rule is not_applicable vs inconclusive
  checkProduct(context) -> ProductRuleResult
}
```

`ownedRuleIds`, `requiredRuleIds`, `minimumCoverageByScope`, and every
source-support declaration are GENERATED from this registry; the generator
never inspects function source text. Single-owner identity is by
`canonicalRuleKey`, not raw `ruleId` - so the 22 Polish Standard rules that
the Extended Domain registry repeats as `POLISH_001..022`
(`polish-standard-validator.ts:60-430` vs `extended-domain-validator.ts:174-529`)
alias one canonical key with one gating owner, and `--check` fails on a
canonical key with two owners or a gating `ruleId` lacking required metadata.
This dissolves the v7 rule-ownership collision (Flow J's "all
statically-determinable polish rules" no longer overlaps the theming/
anti-pattern/a11y slices, because ownership is declared per canonical key, not
inferred per validator).

```text
CanonicalSeverity = 'blocker' | 'major' | 'minor' | 'advisory'

ProductRuleResult = {
  ruleId, canonicalRuleKey,
  status: 'pass' | 'fail' | 'not_applicable' | 'inconclusive',
  // NOTE: no rule-level 'error'. A rule's checkProduct() throwing is CAUGHT
  // and recorded as status 'inconclusive' with normalizedErrorCategory set
  // (the rule could not be evaluated). Validator-level 'error' (cannot run at
  // all - unreadable input, registry fault) lives on ProductValidationResult.
  normalizedErrorCategory?,        // set when an inconclusive came from a caught throw
  severity: CanonicalSeverity,     // from the rule definition (per-rule authoritative)
  findingClass,                    // from the rule definition
  evidenceKind, evidenceLocations[],
  message, remediation?
}

ProductFinding = {                 // emitted for every fail/blocking rule result
  validatorId, ruleId, canonicalRuleKey,
  severity: CanonicalSeverity, findingClass,
  evidenceLocations[], message, remediation?
}

ProductValidationResult = {
  status: 'clean' | 'findings' | 'inconclusive' | 'error',
  // 'clean' means ACCEPTED UNDER THE ACTIVE POLICY, NOT "findings is empty":
  // a clean result MAY carry tolerated/non-blocking findings. Downstream
  // consumers must read `status`, not `findings.length`.
  rules: ProductRuleResult[],
  findings: ProductFinding[],
  coverage: {             // RUN-derived, not registry-declared
    inspectedFiles[], skippedFiles[],
    supportedSourceKinds[], unsupportedSourceKinds[],
    ruleCounts: { pass, fail, notApplicable, inconclusive },
    findingCounts: { blocking, tolerated },  // why a clean result can hold findings
    measuredScope[],      // what this run actually proved
    unverifiedScope[]     // registryScope minus what this run proved
  },
  error?: string          // set only when status === 'error' (validator-level)
}

cleanPolicy = {
  requiredRuleIds[],                       // generated from the rule registry
  blockingSeverities: CanonicalSeverity[], // e.g. ['blocker','major']; minor/advisory never block
  toleratedFindingCounts,                  // keyed by (canonicalSeverity, findingClass)
  minimumCoverageByScope,                  // generated from required rules' evidence
  inconclusiveBehavior: 'block',
  notApplicableBehavior: 'exclude_and_report'
}
```

Tolerance is keyed by `(severity, class)`, matching the dimensions the
evaluator counts on; it only ever matters for a `blockingSeverities` entry
(a `minor`/`advisory` finding is non-blocking already, so tolerating it is a
no-op). The default for every blocking `(severity, class)` is 0.

**Canonical severity - per-rule authoritative, table is a generation default
only (v8 review).** The source validators use three incompatible vocabularies
- polish/extended/anti-pattern `critical|high|medium|low`, linguistic/
absolute-ban `P0|P1|P2`, taste `error` (`polish-standard-validator.ts:5-16`,
`absolute-ban-detector.ts:28-38`, `linguistic-ban-validator.ts:33-42`,
`taste-validator.ts:8-19`). The normalization table (`critical`/`P0`/`error`
-> `blocker`; `high`/`P1` -> `major`; `medium`/`P2` -> `minor`; `low` ->
`advisory`) is used ONCE, at registry-authoring time, to seed each rule's
`ProductRuleDefinition.severity`. After that the PER-RULE `severity` is
authoritative - the evaluator reads only it, never the source vocabulary or
the global table. This matters where rule semantics intentionally differ from
the default: the absolute-ban detector emits `P1` (which the table would seed
as `major`/blocking), but its findings are heuristic "pattern shapes, not
certainties" (`absolute-ban-detector.ts:20`), so those rules DECLARE
`severity: minor` in the registry, overriding the default. Because `minor` is
not in `blockingSeverities`, they are non-blocking by construction - no
tolerance entry needed. `--check` flags any rule whose declared severity
differs from the table default WITHOUT a stated override reason, so divergence
is always deliberate and reviewable.

**Deterministic clean-evaluation algorithm** (one ordered function, persisted
inputs so a clean decision is reproducible after serialize/reload):

```text
1. coverage: every required rule's supported-and-discovered source inspected?
   any gap -> that rule is inconclusive.
2. if the validator could not run at all (unreadable input, registry fault)
   -> status = error (validator-level). STOP.
3. block on any REQUIRED rule that is inconclusive (incl. a caught rule throw,
   which is inconclusive + normalizedErrorCategory) -> status = inconclusive.
4. count findings (fail results) by (canonicalSeverity, findingClass).
5. any finding whose severity is in blockingSeverities AND whose
   (severity, class) count exceeds toleratedFindingCounts -> status = findings.
6. else -> clean (MAY still carry minor/advisory or tolerated findings;
   findingCounts.tolerated records them; findingCounts.blocking == 0).
notApplicable rules are excluded from all counts and reported separately.
```

Four-status rule semantics remain mandatory: `clean` requires every required
applicable rule `pass` with NO required rule `inconclusive`; missing, skipped,
unreadable, or unsupported evidence makes affected rules `inconclusive`, never
`pass` (the current absence-passes `undefined !== '0px'` and N/A-as-`passed:
true` conventions are replaced). `measuredScope` is run-derived. The
normalized policy inputs AND the evaluation result are persisted with each
run and included in the closing summary.

`product_validator` entry points inspect the target/project, not Sidecoach's
own guidance/checklist output. General memory validations, framework-
initialized passes, and domain validators that only inspect result shape are
`advisory`, never product evidence. The capability registry is reviewed and
tested independently from lane membership.

**Concrete initial clean policies - GENERATED from the rule registry, not
authored.** v7 wrote per-validator "selection rules" as prose ("rules whose
check is statically determinable") - which a generator cannot evaluate
without reading function bodies. v8 derives each policy mechanically from
`ProductRuleDefinition` metadata, so the policy is concrete and non-vacuous by
construction:

- `requiredRuleIds` = the rules the registry assigns to that validator
  (`ownerValidatorId`) whose `evidenceRequirements` are all statically
  satisfiable (no `dom`/`computed-style`/`contrast`-only requirement); DOM-only
  rules are owned but non-required and surface as `inconclusive` until a
  browser-evidence collector exists.
- `blockingSeverities` = `['blocker','major']` (canonical); `minor`/`advisory`
  never block.
- `toleratedFindingCounts` = 0 for every blocking `(severity, class)`. The
  heuristic absolute-ban rules do not need a tolerance carve-out because they
  DECLARE `severity: minor` (per the per-rule override above), so they are
  reported-not-blocking by construction.
- `minimumCoverageByScope` = generated from the union of each required rule's
  `supportedSourceKinds`, so coverage and support can never disagree (fixes
  the v7 LESS/TSX mismatch where a policy said "all CSS/SCSS" while the matrix
  marked LESS full and TSX partial).

The four floor validators (Flow J static polish/copy/bans; theming/token
consistency; CSS anti-patterns; static accessibility) thus get fully concrete
policies with zero hand-classified rule IDs. `generate-lanes.ts --check`
REJECTS: an empty generated `requiredRuleIds`; a gating rule lacking registry
metadata; a `canonicalRuleKey` with more than one owner; a coverage threshold
that omits a source kind a required rule declares supported; or a missing
clean/findings/inconclusive fixture manifest entry (the generator checks
MANIFEST PRESENCE; the test suite EXECUTES the fixtures - section 15 keeps
these responsibilities separate).

**Transitions** (all phrased in the lifecycle/outcome axes above): `retry`
re-serves the current step (report optional, recorded); `skip` records the
step skipped-with-reason (report.summary required) and serves the next;
`interrupt` sets `lifecycle: interrupted` (resumable - it is how "user said
stop here" becomes durable state; a process that dies without calling it
leaves `lifecycle: in_progress`, equally resumable); `resume` is the ONLY
action valid against an `interrupted` checkpoint - it atomically transitions
`interrupted -> in_progress` (revision increments, audit entry recorded) and
re-serves the current step; every other action against an interrupted
checkpoint is rejected with a directive to resume first; `stop` sets
`lifecycle: closed` with `outcome: stopped`. A lane also reaches
`lifecycle: closed` by completing its final sequence step (`outcome:
completed | partial`) or reaching `converged` (loop, `outcome: converged`).

**Once-only execution under async - lease protocol, not bare CAS (Codex
cross-model finding).** A bare read-check-write CAS is insufficient because
lane work is ASYNCHRONOUS: MCP races handlers against a timeout with
`Promise.race` and a timed-out handler keeps running
(`mcp-server/src/server.ts:65-95`), and no `AbortSignal` reaches handlers
(`mcp-server/src/tools/types.ts`). Holding a lock across an async
`advanceLane` lets a still-live operation's lock look stale (age-based
takeover fires); releasing the lock before validation completes allows a
timed-out caller to retry while the original is still running - duplicate
step execution. v8 uses an operation-lease protocol:

```text
advanceLane:
  1. CLAIM under O_EXCL CAS: verify expectedRevision, write an in-flight lease
     {operationId, stepId, iteration, claimedCheckpointRevision, startedAt,
     heartbeatAt} into the checkpoint, bump revision, release the file lock.
     The lease carries exactly the identity FINALIZE validates (below), and
     `iteration` distinguishes repeated executions of the same loop step. The
     lease - not a held file lock - marks the step in-flight across the async
     body.
  2. EXECUTE the (async) validators with an AbortSignal derived from the
     lease. Refresh heartbeatAt periodically.
  3. FINALIZE under O_EXCL CAS: verify the SAME operationId still owns the
     lease, write the step result, clear the lease, bump revision.
```

The guarantee is AT-MOST-ONE COMMITTED LANE TRANSITION, not exactly-once
execution (v8 review correction). `AbortSignal` is cooperative: a timed-out
handler can ignore it and keep running, so if its heartbeat goes stale a
replacement may reclaim the lease and begin overlapping work. The lease can
only fence which result COMMITS, not prevent two bodies from running. So:

- A second `advanceLane` finding a live lease (heartbeat within the window)
  for the same step is REJECTED. A stale lease (dead heartbeat = crashed or
  runaway) is reclaimable and logged.
- FINALIZE accepts a result only if the SAME lease identity still owns the
  checkpoint - `{operationId, stepId, iteration, claimedCheckpointRevision}` -
  so a superseded operation's commit is rejected even if it finished late.
- Because overlap is possible, validators and flow handlers invoked during
  advancement MUST be pure or idempotent, and any unavoidable persistent
  side effect (flow-history, session memory - which today write OUTSIDE the
  fenced commit) MUST carry the claimed checkpoint revision as a FENCING
  TOKEN, so a superseded operation's writes are rejected downstream too.
- `validateProduct`/handlers receive the `AbortSignal`; the MCP server
  propagates it into tool handlers (today it does not).

Tested: concurrent double-advance, timeout-then-retry (replacement acquires
the lease while the original ignores abort), and crash-mid-advance all yield
AT MOST ONE committed transition and one authoritative set of side effects -
the superseded operation cannot commit state OR persistent side effects after
its lease is fenced. (We do NOT claim exactly-once execution.)
Read-only reads (`laneStatus`, `listLanes`) never take the lock.

**Lifecycle and outcome are SEPARATE axes (v8 review).** v8 conflated them -
mapping a stalled loop to `partial` (which retention treats as terminal) while
also calling it resumable, a contradiction. v9 splits:

```text
lifecycle: 'in_progress' | 'interrupted' | 'closed'   // governs listing + retention
outcome?:  'converged' | 'stalled' | 'capped' | 'error' | 'stopped' | 'completed'
                                                       // the result, recorded separately
```

- `lifecycle` is the ONLY thing retention and listing key off.
- A lane is `closed` ONLY by an explicit `stop` or by completing its final
  step (sequence) / reaching `converged` (loop). `closed` lanes carry a
  terminal `outcome`.
- A loop that `stalls`/`caps`/`errors` stays `lifecycle: in_progress` with the
  matching `outcome` recorded - it is RESUMABLE (a later `advanceLane` re-runs
  validators); it is NOT terminal and NOT GC-eligible as terminal.
- `interrupted` is its own lifecycle (resumable via `resume`).
- The composite rule "success = any one flow passed" is NOT used for lanes.

A sequence lane's `outcome` on close is `completed` (all steps succeeded),
`partial` (some succeeded, some skipped/failed), or `stopped` (user stop). A
loop lane's `outcome` is its convergence result. Listing/retention never read
`outcome`.

`LaneState` = `{ lane, target, projectPath, currentStep, steps: [{verb,
flowIds, status: 'pending' | 'current' | 'completed' | 'skipped' |
'validation_failed' | 'validation_inconclusive' | 'validation_error'}],
stepReports, revision, lifecycle, outcome?, convergence? }`.

**Checkpoints:** `SidecoachCheckpoint` schemaVersion 2 adds `operationKind:
'composite' | 'lane'`, `laneId?`, `projectPath`, `revision`, `lifecycle`,
`outcome?`, `stepReports`, `lease?` (the in-flight `{operationId, stepId,
iteration, claimedCheckpointRevision, startedAt, heartbeatAt}`),
`seenReportIds[]` (idempotency), and `convergence?`. Lane resume resolves
against the lane registry (not `PRESET_COMPOSITE_FLOWS`); v1 checkpoints still
resolve presets (migration shim). Checkpoint lookup: ids resolve within the
project's checkpoint directory; monitor/MCP calls accept `--project <path>`
and default to cwd. **Project identity is canonicalized** (P2): the project
path is resolved with `realpath` and that one canonical path keys the history
store, the checkpoint root, MCP `--project`, and lane state - so the same
project reached by a symlink or relative path is never split across two keys.

**Report-input hardening:** structured JSON only - inline or a file path;
paths are resolved with `realpath` and the RESOLVED path must remain under
the RESOLVED project root (a lexical prefix check alone follows symlinks out
of the project); regular files only, no-follow semantics where the platform
supports them; 256KB cap; schema-validated before use.

**Retention and listing (lifecycle-keyed only).** `closed` checkpoints
(lifecycle, regardless of `outcome`) are retained 30 days then
garbage-collected. `in_progress` and `interrupted` checkpoints - INCLUDING a
loop lane whose outcome is `stalled`/`capped`/`error` (still `in_progress`,
still resumable) - are retained until they close or go 30 days idle; GC of a
non-`closed` checkpoint is logged loudly. `lane list` shows `in_progress` and
`interrupted` lanes by default (with their recorded `outcome`, if any);
`--all` adds `closed` lanes within retention. Nothing reads `outcome` for
retention/listing decisions.

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
- **FOUR executability gates, not three (v7 review).** Flow executability has
  FOUR layers, not the three v7 named: historical prerequisite edges,
  `contextRequirements`, handler `canExecute` preconditions, AND
  EXECUTION-TIME PROJECT-STATE checks that pass `canExecute` then fail inside
  the handler. The verified case: `flowA_brand_verify` returns `canExecute:
  true` UNCONDITIONALLY, then errors when `PRODUCT.md` is absent
  (`flow-handler-brand-verify.ts:33-35`, `:49-61`) - that is none of the first
  three gates. (Also `flowF` errors without `DESIGN.md`/staged tokens and its
  `canExecute` requires a project register; `flowH.canExecute` requires brand
  personality.) So `flow-validation-capabilities.ts` carries a machine-readable
  PRECONDITION declaration per flow covering all four gates, each with a stable
  ID. The handler DECLARES the precondition IDs it enforces in its registration
  (an authored `enforcesPreconditionIds[]` field), NOT inside its function
  body - so `--check` validates the declaration against lane requirements
  without ever parsing handler source (consistent with the
  generator-never-reads-bodies principle). A runtime assertion in the handler
  can self-check the same IDs, but the generator relies only on the
  declaration. Each declared precondition names
  its handling when unmet: `synthesize_from_project_state` (flowF autoloads
  tokens from DESIGN.md when present) | `convert_to_step_guidance` (no
  DESIGN.md -> the step guidance opens with "no DESIGN.md found - extract
  tokens or run /sidecoach document" and the flow runs degraded-but-useful;
  flowA without PRODUCT.md -> guidance to run /sidecoach teach; flowH without
  brand personality -> general motion guidance) | `waive_with_fallback` |
  `reject_at_preflight` (actionable message).
- **The per-lane acceptance matrix is SUPPLIED, not just described** (v7
  review flagged it as promised-not-delivered). For each lane, the expected
  outcome on a project with UI source but no PRODUCT.md / no DESIGN.md / no
  staged tokens / no history:

  | Lane | First flow's binding precondition | Expected outcome |
  |---|---|---|
  | `lane_build` | flowA PRODUCT.md (execution-time) | step 1 runs degraded with a "run /sidecoach teach" guidance banner; lane proceeds |
  | `lane_ship` | flowK/flowI history (waived) | proceeds on existing UI; polish step gates per source support |
  | `lane_delight` | flowF DESIGN.md/tokens + register; flowH brand personality | flowF converts-to-guidance (no tokens), flowH serves general motion guidance; lane proceeds, never errors |
  | `lane_live` | none hard | proceeds |
  | `lane_calm` | none hard | proceeds |
  | `lane_converge` | flowJ source support | proceeds if a supported source exists; else preflight-rejected per the unsupported-source rule (section 9) |

- **Generation-time enforcement:** `generate-lanes.ts --check` FAILS if any
  required prerequisite EDGE of any flow in a lane's derived sequence is
  neither satisfied earlier in the lane nor explicitly waived; if any declared
  precondition (any of the four gates) of a lane flow lacks a declared
  unmet-handling; or if a precondition required by a lane is absent from the
  flow's authored `enforcesPreconditionIds[]` (a declaration check, no source
  parsing). No lane can ship unexecutable at any of the four gates.
- **History scoping:** where flow history remains an input (verb-tier
  behavior, advisory uses), it becomes project-scoped (keyed by project
  path, not a global default session). `flow-history.ts` joins the blast
  radius.
- Per-lane expected-outcome tests run from BOTH a fresh-build fixture and an
  existing-UI-with-no-history fixture.

## 9. lane_converge - persisted, truthful convergence

`ralph-loop.ts` -> `convergence-loop.ts` (`Ralph*` -> `Convergence*`), with
semantic fixes and an explicit capability boundary, not just a rename.

**Capability architecture with a bounded product-validation release floor
(Jonah, 2026-06-12, fifth review).** Lane membership stays `polish -> audit ->
critique`, so every iteration still receives all three verbs' coaching. Only
the REGISTERED PRODUCT VALIDATORS in `lane_converge`'s
`requiredProductValidatorIds` decide whether the target is clean - and
`lane_converge` is ENABLED only once the release floor below is met. Full
Option B (browser harness, CWV, calibrated judgment) is explicitly rejected
as a release dependency; those validators arrive as separately reviewed
follow-ups and widen the gate only by explicit addition to the lane policy.

Release floor for enabling `lane_converge`:

| Validator slice | Capability | Release requirement |
|---|---|---|
| Flow J coverage-aware static polish/copy/bans | `product_validator` | REQUIRED |
| Static theming/token consistency | `product_validator` | REQUIRED |
| Static CSS anti-pattern checks | `product_validator` | REQUIRED |
| Reliable static accessibility checks (source-evidence: semantic markup, label/ARIA presence, focus/reduced-motion) | `product_validator` | REQUIRED |
| `flowK_multi_lens_audit` (manual five-dimension framework) | `advisory` | coaching only |
| `flowL_design_critique` (Nielsen/AI-slop/cognitive-load lenses) | `advisory` | coaching only |
| Rendered responsive/device validation | `advisory` | follow-up feature |
| Browser performance / Core Web Vitals | `advisory` | follow-up feature |
| Nielsen/cognitive-load/design-director judgment | `advisory` | follow-up feature |

The three static slices are independent product validators with their own
`validatorId`, `registryScope`, `cleanPolicy`, and `ownedRuleIds` - NOT
inferred from audit handler output, and bound to `lane_converge` through its
`LaneValidationPolicy.requiredProductValidatorIds`, not through verb-flow
ownership. Their rule logic largely exists today (extended-domain validator,
taste validator, anti-pattern validator); the work is honest evidence
collection feeding them. (A capability inventory mapping each slice to its
existing rule source is kept as an internal engineering note; it is not a
load-bearing spec dependency.)

**Complete derived loop membership and capabilities.** `lane_converge`'s verb
chain `polish -> audit -> critique` derives, after dedup, to FIVE flows
(polish owns [J, M], audit owns [K, I], critique owns [L, K]). Every flow's
capability and gate relationship is explicit:

| Flow | Capability | Bound product validators | Runs each iteration | Error effect |
|---|---|---|---|---|
| `flowJ_tactical_polish` | `product_validator` | Flow J static validator | yes | blocks (gates) |
| `flowM_responsive_validation` | `advisory` | none (rendered responsive is follow-up) | yes (guidance) | advisory only - it already self-reports it "cannot pass on documentation alone" |
| `flowK_multi_lens_audit` | `advisory` | none (its 5-dim framework is manual) | yes (guidance) | advisory only |
| `flowI_accessibility` | `advisory` | none - the STATIC a11y slice is a separate registered validator, not this handler's framework output | yes (guidance) | advisory only |
| `flowL_design_critique` | `advisory` | none (Nielsen/cognitive-load is follow-up) | yes (guidance) | advisory only |

Plus the three lane-policy-bound static validators (theming, anti-patterns,
static a11y) that gate without being owned by any of the five flows. The
required gate for `lane_converge` is therefore: Flow J static validator +
theming + anti-patterns + static a11y, all `clean`; M/K/I/L coach every
iteration and their failures qualify the display label but never block.

**Flow J hardening (required, and obligatory under this spec's own
missing-inputs-are-inconclusive rule regardless of the floor):**

- Project discovery becomes RECURSIVE over supported source types with
  explicit exclusions (node_modules, dot-dirs, dist) and size limits - the
  current collector walks one level deep and reads only CSS-family files for
  rules and root-level HTML/MD for copy.
- Every rule returns the four-status `ProductRuleResult`; absence-passes
  (`undefined !== '0px'`) and N/A-as-`passed: true` are eliminated.
- Unsupported source systems (e.g. CSS-in-JS the collector cannot read) and
  unreadable/size-skipped files make the affected scope `inconclusive`, never
  clean, and appear in the coverage record.
- A shallow clean-CSS fixture cannot claim the full extended-domain matrix as
  measured - run coverage decides the claim.

**Initial source-support matrix** (what the release actually parses; anything
else is truthfully `inconclusive`, not a false pass, AND not an endless loop -
a project whose UI lives entirely in unsupported sources fails preflight with
an actionable message rather than entering a convergence loop that can only
stay inconclusive):

| Source kind | Flow J | Theming | Anti-patterns | Static a11y |
|---|---|---|---|---|
| CSS / SCSS / LESS | full | full | full | n/a |
| HTML | full | partial (inline style) | full | full |
| JSX / TSX | copy + className/inline only | partial | partial | partial (JSX attrs) |
| Vue / Svelte | inconclusive (follow-up) | inconclusive | inconclusive | inconclusive |
| CSS-in-JS (styled/emotion) | inconclusive (follow-up) | inconclusive | inconclusive | inconclusive |

This validator-level table is a SUMMARY: "partial" is defined PER RULE by each
`ProductRuleDefinition.supportedSourceKinds` (a rule provable from JSX
className survives; a rule needing a CSS cascade does not), so the engine can
always say which specific rules a partially-supported file proved vs left
inconclusive - and `minimumCoverageByScope` is generated from exactly those
per-rule declarations (closing the v7 LESS-full-but-coverage-omits-LESS gap).

Release requirement: at least one representative supported application
fixture (a CSS/SCSS + HTML project) must reach `clean` end to end - proving
the gate is not permanently-inconclusive by construction. Widening source
support (Vue/Svelte/CSS-in-JS parsers) is a registry-widening follow-up.

**Unsupported sources block sequence and convergence lanes - but the gate is
PHASE-AWARE, not universal (v8 review correction).** Every refinement/loop
lane has a polish step bound to Flow J, so an unsupported-source project would
otherwise leave that step permanently `validation_inconclusive` with no
explanation. But a UNIVERSAL preflight (the over-broad rule v8 first wrote)
would reject `lane_build` on a fresh, empty project - whose whole purpose is
to CREATE the UI source that does not exist yet - and the own-acceptance "every
lane passes a fresh-build fixture" makes that contradiction visible. So the
gate is phase-aware:

- Refinement/convergence lanes (`lane_ship`, `lane_calm`, `lane_live`,
  `lane_converge`; `lane_delight` is refinement) check Flow J source support
  at lane START and reject-at-preflight when no supported source exists, with
  an actionable message ("this project's UI is in {Vue/Svelte/CSS-in-JS},
  which the static validators don't yet parse").
- Build lanes (`lane_build`) DEFER the Flow J source-support gate to the first
  step that requires product/visual validation (its polish step). The lane
  starts, creates source, and only at the polish gate is support evaluated; if
  source is still unsupported there, it blocks at that step (not at start)
  unless an explicit recorded bypass runs polish as advisory.

Either way a lane never silently appears stuck at a step the engine can't
evaluate; the difference is only WHEN the gate fires. A fresh-empty-project
acceptance test proves `lane_build` starts, creates supported source, and
passes the deferred gate.

**Validator target scope.** `startLane(laneId, target, ...)` takes a free-form
`target`, but Flow J currently scans the whole project, so a lane aimed at one
component could be blocked by unrelated project-wide findings. The target
grammar: `target` is either a path/glob under the project root (validation
scopes coverage to matching files) or the sentinel `project` (project-wide).
A canonical target resolver:

- resolves the target and the project root with `realpath` and rejects any
  match that escapes the resolved root (symlink-safe, same rule as report-input
  hardening); rejects non-regular matched files;
- defines glob semantics explicitly (shared Python/TS): `**` recursive, `*`
  single-segment, no negation in v1; a glob matching ZERO files is a
  preflight error ("target matched no files"), never a silent clean.

`ProductRuleDefinition` carries a `scope` field (`file | component | page |
project`) declaring the context a rule needs. A required rule whose declared
scope cannot be validly evaluated against the selected target (e.g. a
project-scope rule under a single-file target that can't supply enough
context) returns a DISCLOSED `inconclusive` for that target, never `clean` -
so a narrow target can never produce a falsely-clean project-wide claim.
Coverage and `measuredScope` describe only the targeted subset; the target is
persisted in the checkpoint and shown in the summary so the scope of any clean
claim is explicit.

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
registryScope (maximum capability) - Flow J owns ONLY the rules left after the
canonical-key partition delegates theming/anti-pattern/a11y to their slice
validators (single-owner by canonicalRuleKey, so no rule is double-owned):
  - tactical polish matrix (22 rules)
  - extended design-domain rules NOT delegated to theming/anti-pattern/a11y
    (e.g. typography, spacing, motion-timing, copy domains)
  - linguistic-ban scan
  - absolute-ban scan (heuristic rules declared `minor` = non-blocking)
The theming/token, CSS-anti-pattern, and static-a11y rules in the extended
matrix are owned by the three slice validators, not Flow J.

measuredScope: derived PER RUN from the coverage record - only checks that
        actually ran with sufficient evidence. unverifiedScope = registry
        scope minus run-proven scope, merged into the summary.

status: clean only when every required applicable rule passed with no
        required rule inconclusive, under the persisted cleanPolicy;
        missing/skipped/unsupported inputs = inconclusive
```

Widening the gate is EXPLICIT, never automatic (v7 reviews both flagged the
contradiction). When audit, critique, or another flow earns
`product_validator` capability in a separately reviewed change, it joins
`lane_converge`'s gate only by being ADDED to that lane's
`requiredProductValidatorIds` - promoting a flow's capability never silently
mutates the lane policy. `--check` forces the choice: a `product_validator`
flow in a loop lane must appear in the lane policy's required OR excluded list.

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
  outcome: 'running' | 'converged' | 'stalled' | 'capped' | 'error',
           // the loop result; the lane's lifecycle (in_progress/interrupted/
           // closed) lives on LaneState, NOT here. running/stalled/capped/error
           // all sit under lifecycle in_progress (resumable); converged closes.
  iteration, signatures[], consecutiveNoProgress,
  limits: { maxIterations, maxNoProgress },
  productValidationRuns[], findings[], validatorErrors[],
  advisoryRuns[],
  measuredScope[], unverifiedScope[]
}
```

**Progress signature includes ALL required blocking state, not just findings
(v7 review).** A required validator can stay inconclusive or error WITHOUT
emitting a finding; if the signature were findings-only, two different
coverage gaps would share the same empty signature, a changing validator
error would read as no-progress, and stall reporting could not name the
blocker. So `computeProgressSignature` is built from the full required-state
tuple per validator: `{validatorId, status, failedRuleIds[],
inconclusiveRuleIds[], coverageGapIdentities[], normalizedErrorCategory}` -
stable identities only (rule keys, gap identities, error category), never
free-text messages or stack traces (which would make the signature unstable
and defeat stall detection). Advisory guidance changes never enter the
signature or reset the no-progress counter. Each `LaneStepResult` carries the
step-level result (the `clean/findings/inconclusive/error -> step status`
mapping from section 7's completion contract) plus the lane's `lifecycle` and
`outcome?`; the convergence detail lives in the `convergence` sub-state.
Stepped iteration: `advanceLane` runs product validators and advisory flows
-> findings + coaching returned -> model fixes (real work) -> next
`advanceLane` revalidates and updates signatures.

Every converged result and closing summary MUST state the boundary, and the
summary is GENERATED FROM THE RUN COVERAGE RECORD, never from registry
declarations alone - it discloses files/source kinds not inspected, rules
lacking evidence, not-applicable rules, and actual measured-rule coverage:

> Converged (machine-measured): {run measuredScope} clean after {N}
> iterations under {cleanPolicy}. Coverage: {inspected}/{discovered} files;
> not inspected: {unsupportedSourceKinds, skippedFiles}. Not machine-verified:
> {run unverifiedScope}. Advisory audit/critique guidance was
> {completed | partially unavailable}; manual verification remains advised.

**Advisory failure qualification:** advisory flow errors never block the
product gate, but they change the user-facing label. The persisted
`convergence.outcome` remains `converged` (and lifecycle `closed`); the
DISPLAYED result becomes `machine_checks_clean_with_advisory_warnings`, with
the incomplete coaching prominent in the summary. A bare "converged" is never
shown when the requested coaching loop did not fully execute.

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

As v3 (validator + compiled regexes + length caps + one structured debug line
per prompt with registry ids only), plus the checkpoint/report hardening in
section 7.

**One invalid-regex policy, not two (P2).** v7 stated both "invalid registry
disables the lane tier" and "per-pattern failure isolation", which conflict.
Single rule: registry STRUCTURE invalidity (unparseable JSON, schema
violation, missing required fields) disables the lane tier loudly; a single
malformed lexicon REGEX is isolated - that one pattern is skipped and logged,
the rest of the tier runs (matching the existing hook behavior at
`sidecoach-keyword.sh:321-332`). Structure is fatal; one bad pattern is not.

## 13. Operational behavior

As v3: AskUserQuestion unavailable -> one concise plain question; registry
STRUCTURE missing/invalid -> lane tier disabled loudly, verbs + nudge
unaffected, MCP returns explicit errors; one bad regex -> that pattern skipped
(section 12); model non-compliance mitigated by acceptance transcripts +
announce-always.

## 14. Blast radius

Hook layer: `sidecoach-keyword.sh`, `sidecoach-lanes.json` (new; replaces
`sidecoach-modes.json`; includes scope policy + waivers),
`test-sidecoach-keyword.sh`, `install.sh:1048` + `install.sh:2613`.

Engine: `modes.ts` removed -> `lanes.generated.ts` + `scripts/generate-lanes.ts`;
`ralph-loop.ts` -> `convergence-loop.ts` (+ t20 rename AND expectation fix);
new `flow-validation-capabilities.ts` (registration + flow binding + lane
policy); new `product-rule-registry.ts` (canonical `ProductRuleDefinition`s +
the severity normalization table - the source ownership/policy/coverage are
generated from);
`flow-handler.ts` (typed `ProductRuleResult` / `ProductFinding` /
`CanonicalSeverity` / `ProductValidationResult` / coverage / cleanPolicy
contracts);
`flow-handler-tactical-polish.ts` (recursive coverage-aware collector +
pure product-validation entry point exposing the matrix +
linguistic/absolute-ban findings; target-scoped discovery);
`polish-standard-validator.ts` + `extended-domain-validator.ts` +
`domains/*` (four-status rule results; absence-passes and
N/A-as-`passed: true` eliminated; canonicalRuleKey aliasing the 22 duplicated
POLISH_* rules);
new static validator slice modules (theming/token consistency, CSS
anti-patterns, static accessibility - the release floor);
`sidecoach-orchestrator.ts` (lane API, per-step history refresh, status
mapping, verb-guidance aggregation, lane resume dispatch, the lease/
operation-id protocol + AbortSignal propagation);
`checkpoint-store.ts` (schema v2 + migration + lease/seenReportIds + realpath
project canonicalization); `flow-history.ts` (project scoping, realpath key);
`flow-handler-brand-verify.ts` + others (execution-time precondition IDs);
`slash-command-router.ts` (+ tests); shared classifier module;
`bin/sidecoach-monitor.js` (lane subcommands);
**`sidecoach/package.json`** (`npm test` becomes an enumerating runner over
`src/__tests__/` - today it runs ONLY `intent-detector.test.ts`, so the gate
could pass while every new lane suite never executes); `sidecoach/dist/*`.

MCP server: `registries.ts` (+ intent registry for NUDGE parity, no cooldown),
`keyword-resolver.ts`, `resolve-keyword` -> `classify-intent`, new `lane` tool
(+ AbortSignal propagation into tool handlers - `server.ts`, `tools/types.ts`),
`list-modes` -> `list-lanes`, `schemas.ts`, `tools/index.ts`,
`get-cheatsheet.ts`, README, DESIGN, all test tiers + transcripts,
`mcp-server/dist/*`.

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
- Two concurrent advances against one checkpoint: exactly one COMMITS
  (expectedRevision CAS + lease finalization); the other is rejected even if
  it finished.
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
  validator; promoting a flow's capability does NOT mutate a lane policy
  (explicit add required); a `product_validator` loop-lane flow absent from
  both the required and excluded lists fails generation.
- v8 cross-model-review additions:
  - the clean evaluator gives the SAME status after serialize+reload (the
    persisted normalized inputs are sufficient);
  - severity normalization covers polish, extended-domain, anti-pattern,
    linguistic, absolute-ban, and taste source vocabularies into the canonical
    four; a policy written in canonical severities evaluates every source
    finding;
  - a medium/minor or tolerated finding has an explicitly tested resulting
    status (appears in findings, does not flip `clean`);
  - a semantic-duplicate rule under a second ID (`POLISH_00x`) shares one
    `canonicalRuleKey`, is owned once, and produces one finding (no
    double-count);
  - changing only a coverage gap (not a finding) changes the progress
    signature; a required inconclusive/error identity participates in it;
  - AT-MOST-ONE COMMITTED TRANSITION (not exactly-once execution): a timed-out
    operation that ignores abort while a replacement acquires the lease cannot
    commit state OR persistent side effects after fencing; a superseded
    operation's fencing-token writes are rejected downstream; a duplicate
    `reportId` is a no-op; a stale lease between two iterations of the same
    loop step is cleanly reclaimable;
  - an explicit verb + SCOPE_UNKNOWN/OUT_OF_SCOPE lane evidence resolves to
    `VERB` primary (zero explicit-verb overrides), lane scope diagnostic-only;
  - PHASE-AWARE source preflight: a refinement/convergence lane on a
    Vue/Svelte/CSS-in-JS-only target is rejected at lane start; `lane_build`
    on a fresh EMPTY project STARTS, creates supported source, and passes the
    deferred Flow J gate (the review's lane_build contradiction);
  - the per-lane no-PRODUCT/no-DESIGN/no-tokens/no-history matrix outcome holds
    for every lane (esp. `lane_delight`'s flowF+flowH preconditions);
  - a path/glob `target` scopes coverage to matching files; `measuredScope`
    describes only the targeted subset.
- Release-floor truthfulness suite (fifth review):
  - a nested TSX/CSS-in-JS fixture cannot report unsupported checks as pass;
  - removing required evidence flips affected rules from pass/fail to
    `inconclusive`;
  - not-applicable rules are excluded from pass rates and listed separately;
  - missing metadata cannot silently pass genericity, contrast, performance,
    or accessibility checks;
  - unreadable and size-skipped files appear in coverage and make affected
    scopes inconclusive;
  - a shallow clean-CSS-only fixture cannot claim the full extended-domain
    matrix as measured;
  - static theming, anti-pattern, and accessibility mutations each produce
    stable target-derived findings that block convergence;
  - the closing summary is generated from run coverage and changes when
    inspected evidence changes;
  - advisory flow failure produces the visibly qualified
    `machine_checks_clean_with_advisory_warnings` display result;
  - `lane_converge` cannot be enabled (generation check) until every
    release-floor validator is registered, attached to the lane policy,
    structurally valid, and proven by clean/findings/inconclusive contract
    fixtures (a static release condition - distinct from a given project's
    runtime cleanliness).
  - every required lane validator ID resolves to exactly one registration and
    is INVOKED once per convergence iteration (scheduling - distinct from the
    async at-most-one-committed guarantee above); a registered release-floor
    validator with no lane attachment fails generation; a canonicalRuleKey
    owned by two validators fails generation.
  - empty required-rule sets and zero/vacuous coverage policies fail
    generation; each initial clean policy has fixtures proving clean,
    findings, AND inconclusive outcomes.
  - product-validator `inconclusive` and `error` outcomes block sequence-step
    completion (not only `findings`), per the section-7 completion contract.
  - a representative supported CSS/HTML fixture reaches `clean` end to end;
    an unsupported-source-only project fails preflight with an actionable
    message rather than looping inconclusively.
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
- Browser-dependent validation (rendered responsive, Core Web Vitals,
  screen-reader behavior) and judgment-heavy critique (Nielsen,
  cognitive-load) remain advisory; each lands as a separately reviewed
  follow-up with its own harness/confidence policy and widens the gate via
  the registry. The static validator slices in the release floor are IN
  scope for this release.
