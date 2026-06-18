# Independent Review: Sidecoach Lane Intent Detection v6

Date: 2026-06-12  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: v6 design plus current verb registry, tactical-polish handler,
responsive and accessibility handlers, validator implementations, convergence
loop, and tests.

## Executive verdict

V6 resolves the principal v5 concern. It retains the correct capability
architecture while requiring a bounded product-validation release floor,
coverage-aware rule results, run-derived measured scope, explicit
not-applicable and inconclusive states, and non-vacuous evidence reporting.
The classifier, model-driven lane state machine, checkpoint/CAS design,
preflight policy, and advisory/product-evidence boundary remain strong.

The design is **close, but not yet implementation-ready**. Two release
blockers remain:

1. The three independent release-floor validator slices have no defined
   attachment to the flow-derived lane execution model, so the engine has no
   specified way to discover or invoke them.
2. The design defines the shape of `cleanPolicy`, but not the concrete initial
   policies. Empty required-rule sets or ineffective coverage thresholds could
   satisfy the registry checks and produce a vacuous clean result.

Recommendation: approve the overall architecture, but resolve the P0
execution-attachment and concrete-policy contracts before implementation
begins.

## Disposition of the v5 review

| V5 finding | V6 disposition | Assessment |
|---|---|---|
| Flow J cannot prove its assigned measured scope | Four-status rules, coverage ledger, recursive discovery, and run-derived scope added | **Resolved in design intent** |
| Sole-gate release posture is too weak | Bounded static validation release floor added | **Resolved in direction; validator execution attachment missing** |
| `cleanPolicy` needs a concrete schema | Structured schema added | **Partially resolved: initial policy values remain unspecified** |
| Measured/unverified scope must be dynamic | Run-derived coverage and summary required | **Resolved in design intent** |
| Initial gate should include static Audit slices | Theming, anti-pattern, and static accessibility slices required | **Partially resolved: ownership and invocation undefined** |
| Advisory failure should qualify terminal result | `machine_checks_clean_with_advisory_warnings` added | **Resolved** |

## Prioritized findings

### P0. Independent release-floor validators have no execution attachment

The validation capability registry is defined as a canonical **per-flow**
contract:

- product-validator capability is declared by flows;
- `advanceLane` runs product validators declared by the current step's flows;
- convergence includes flows declared as product validators.

Relevant design:

- `spec:268-280`
- `spec:282-343`
- `spec:466-494`

The release floor then requires three independent product validators:

- static theming/token consistency;
- static CSS anti-pattern checks;
- reliable static accessibility checks.

The spec explicitly says these are independent validators, not results
inferred from the Audit handler. However, it does not attach them to a flow,
add them to a lane, or define a lane-level validator registry.

The actual derived `lane_converge` flow chain further exposes the gap:

- `polish` owns `flowJ_tactical_polish` and `flowM_responsive_validation`;
- `audit` owns `flowK_multi_lens_audit` and `flowI_accessibility`;
- `critique` owns `flowL_design_critique` and `flowK_multi_lens_audit`.

After deduplication, the loop contains J, M, K, I, and L. The design does not
state whether the static slices attach to J, K, I, another existing flow, or
the lane itself.

Without an attachment contract, the release-floor validators can be present
in source and registered somewhere but never execute during convergence.

**Required resolution**

Separate validator identity from flow capability:

```text
ProductValidatorRegistration = {
  validatorId,
  registryScope[],
  cleanPolicy,
  validateProduct(context)
}

FlowValidationCapability = {
  flowId,
  capability,
  productValidatorIds[]
}

LaneValidationPolicy = {
  requiredProductValidatorIds[]
}
```

The lane's required validator IDs must be resolved directly and invoked once
per iteration. Generation must reject missing registrations, duplicate IDs,
validators with no execution owner, and release-floor validators absent from
the lane policy.

Alternatively, attach each static slice explicitly to an existing flow and
state that attachment in section 9. The independent lane-level policy is
cleaner because release gating should not depend accidentally on verb-flow
ownership.

### P0. Initial clean policies remain undefined and can be vacuous

V6 defines a useful structured `cleanPolicy` shape:

```text
requiredRuleIds[]
blockingSeverities[]
toleratedFindingCountsByClass
minimumCoverageByScope
inconclusiveBehavior
notApplicableBehavior
```

Relevant design:

- `spec:317-337`
- `spec:475-494`

It does not define the actual initial policies for Flow J or the three static
release-floor validators.

This leaves two opposite implementation risks:

1. An empty `requiredRuleIds` list or zero minimum coverage can satisfy a
   structural registry check while allowing a vacuous clean result.
2. Requiring every Extended Domain rule can make convergence impossible
   because several rules require evidence intentionally left advisory or
   unsupported.

The generation check currently verifies only that a product validator has a
clean policy. It does not require the policy to be meaningful.

**Required resolution**

Define the exact initial policy for every release-floor validator:

| Validator | Required rules | Blocking severities | Tolerated findings | Minimum coverage |
|---|---|---|---|---|
| Flow J static polish/copy/bans | Explicit IDs | Explicit values | Explicit values | Per-scope thresholds |
| Static theming/token consistency | Explicit IDs | Explicit values | Explicit values | Per-scope thresholds |
| Static CSS anti-patterns | Explicit IDs | Explicit values | Explicit values | Per-scope thresholds |
| Static accessibility | Explicit IDs | Explicit values | Explicit values | Per-scope thresholds |

Generation must reject:

- empty required-rule lists;
- unknown or duplicate rule IDs;
- zero/vacuous coverage thresholds;
- required rules outside the validator's registry scope;
- a release-floor validator whose policy cannot produce both clean and
  findings outcomes in fixtures.

### P1. Complete derived loop membership is not reconciled with section 9

Section 9 describes lane membership as `polish -> audit -> critique`, then
discusses Flow J, K, and L as the meaningful members. The canonical derivation
rules mean the loop actually contains five flows:

```text
flowJ_tactical_polish
flowM_responsive_validation
flowK_multi_lens_audit
flowI_accessibility
flowL_design_critique
```

Relevant repository:

- `sidecoach/src/verb-command-registry.ts:88-121`
- `sidecoach/src/verb-command-registry.ts:142-148`

Flow M and Flow I are primarily guidance/manual-testing handlers today. Their
capabilities, advisory error behavior, and relationship to the new static
accessibility validator are not stated in the release-floor table.

**Recommendation**

Add the complete derived flow chain and initial capability table to section 9.
For every flow, state:

- advisory/none/product-validator capability;
- attached product validator IDs;
- whether an error affects product cleanliness or only advisory completion;
- whether its guidance executes every iteration.

### P1. Sequence-lane validator failure semantics remain incomplete

V6 states that a hard finding converts an attempted sequence-step completion
into `validation_failed`. It does not state what happens when a required
product validator returns `inconclusive` or `error` during a normal sequence
lane.

Relevant design:

- `spec:268-280`
- `spec:327-337`
- `spec:547-555`

Convergence correctly blocks on error, skip, unsupported output, and missing
input. The same validator can run in sequence lanes because Flow J appears in
several verb chains. Sequence completion must not treat an inconclusive
product check as successful.

**Recommendation**

Define one consistent product-validator completion rule:

```text
clean        -> completion may proceed
findings     -> validation_failed
inconclusive -> validation_inconclusive; step remains current
error        -> validation_error; step remains current
```

Only an explicit user `skip` or `stop` should bypass an unclean or
inconclusive required validator.

### P1. Supported-source coverage is not concrete enough

V6 requires recursive project discovery and truthful handling of unsupported
sources. It does not define which source systems the initial release actually
supports.

Relevant design:

- `spec:496-509`
- `spec:749-766`

The TSX/CSS-in-JS test only requires that unsupported checks do not falsely
pass. An implementation could satisfy this by making most real projects
permanently inconclusive.

**Recommendation**

Add an initial source-support matrix:

| Source kind | Flow J | Theming | Anti-patterns | Static accessibility |
|---|---|---|---|---|
| CSS/SCSS | support level | support level | support level | support level |
| HTML | support level | support level | support level | support level |
| JSX/TSX | support level | support level | support level | support level |
| Vue/Svelte | support level | support level | support level | support level |
| CSS-in-JS | support level | support level | support level | support level |

Require at least one representative supported application fixture to reach
clean. Unsupported projects should receive an actionable preflight response
rather than entering a convergence loop that can only remain inconclusive.

### P1. Rule ownership and duplicate findings are undefined

Flow J retains the entire Extended Domain matrix in its maximum registry
scope, while the new static release-floor validators reuse existing Extended
Domain, taste, and anti-pattern logic.

Relevant design:

- `spec:489-494`
- `spec:521-540`

The same underlying rule may therefore execute through multiple validators
with different policies or evidence collectors. This can double-count
findings, destabilize progress signatures, or produce conflicting statuses.

**Recommendation**

Choose one:

1. Assign each gating rule ID to exactly one product validator.
2. Define canonical finding identities and deterministic deduplication with
   explicit precedence when validators disagree.

The first option is simpler and should be preferred for the initial release.

### P2. Release enablement language and references need cleanup

Three smaller inconsistencies remain:

1. The acceptance test says `lane_converge` cannot be enabled until every
   release-floor validator is "present and green." Presence is a static
   release condition; green is a target-specific runtime result. The static
   check should validate registration, policy, and passing contract fixtures,
   not current project cleanliness.
2. Section 9 references
   `reference_convergence_validator_capability_inventory.md`, but that file is
   not present in the repository.
3. The generation strategy says product validators require "measured scope,"
   while the revised registry contract uses `registryScope`; measured scope is
   run-derived.

Relevant design:

- `spec:108-110`
- `spec:489-494`
- `spec:760-767`

**Recommendation**

Replace "present and green" with:

> registered, attached to the lane policy, structurally valid, and proven by
> clean/finding/inconclusive contract fixtures.

Add or remove the missing inventory reference and update the generation check
terminology to `registryScope`.

## Required acceptance additions

Add these tests before implementation approval:

- Every required lane validator ID resolves to exactly one registration and
  executes exactly once per convergence iteration.
- A registered release-floor validator with no lane attachment fails
  generation.
- Empty required-rule sets and zero/vacuous coverage policies fail
  generation.
- Every initial clean policy has fixtures proving clean, findings, and
  inconclusive outcomes.
- The complete J/M/K/I/L flow chain has explicit capability behavior.
- Product-validator error and inconclusive outcomes block sequence-step
  completion.
- A representative supported real-world project fixture reaches clean.
- Unsupported source systems fail preflight or return actionable
  inconclusive output without entering an endless loop.
- Duplicate rule IDs across gating validators fail generation unless explicit
  ownership or deduplication is declared.

## Suggested v6 disposition

| V6 area | Assessment |
|---|---|
| Classifier and scope architecture | Approve |
| Model-driven lane state machine | Approve |
| Checkpoint, CAS, resume, retention, and containment | Approve |
| Product/advisory evidence boundary | Approve |
| Four-status rule and run-coverage model | Approve |
| Bounded validation release floor | Approve in direction |
| Release-floor validator invocation | Reject pending attachment contract |
| Initial clean policies | Reject pending concrete policies |
| Browser and judgment-heavy validators deferred | Approve |

## Final recommendation

Revise v6 to make product validators first-class registered capabilities rather
than implicit properties of flows. Give `lane_converge` an explicit required
validator-ID policy, attach or register all release-floor validators, and
define concrete non-vacuous clean policies for each.

Once those two P0 contracts are resolved, the design is implementation-ready.
The remaining P1 findings should also be specified before coding because they
affect runtime behavior and acceptance tests, but they do not require changing
the selected architecture.
