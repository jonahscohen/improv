# Independent Review: Sidecoach Lane Intent Detection v7

Date: 2026-06-13  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: v7 design plus current verb registry, Polish Standard and
Extended Domain rule registries, tactical-polish handler, anti-pattern, taste,
linguistic-ban and absolute-ban validators, convergence loop, and tests.

## Executive verdict

V7 resolves the two v6 release blockers. Product validators are now
first-class registrations, `lane_converge` has an explicit required-validator
policy, the complete J/M/K/I/L flow chain is acknowledged, sequence-lane
inconclusive/error behavior is defined, and the release has a concrete source
support matrix and non-vacuous policy intent.

The selected architecture is now coherent. The design is still **not fully
implementation-ready**, because the proposed deterministic policy generation
and clean-policy evaluation depend on rule metadata that the contract does not
define and the current validators do not expose.

Two P0 contracts remain:

1. The generator cannot reliably derive ownership, evidence capability,
   applicability, and required-rule membership from the current rule
   definitions. The v7 selection rules are semantic prose over arbitrary
   `checkFunction` bodies, not executable deterministic criteria.
2. The clean policy references severities and finding classes that are absent
   from the typed product-result contract. `ProductFinding` is named but not
   defined, so the engine cannot deterministically apply
   `blockingSeverities` or `toleratedFindingCountsByClass`.

Recommendation: retain the v7 architecture and add a canonical declarative
product-rule registry that supplies ownership, severity/class, evidence
requirements, source support, and applicability metadata. Once the clean
evaluator is defined over that registry, implementation can begin.

## Disposition of the v6 review

| V6 finding | V7 disposition | Assessment |
|---|---|---|
| Independent validators had no execution attachment | First-class registrations, flow bindings, and lane validation policies added | **Resolved** |
| Initial clean policies were undefined/vacuous | Deterministic selection rules and rejection checks added | **Partially resolved: selection inputs and evaluator contract remain undefined** |
| Complete derived loop membership omitted | J/M/K/I/L capability table added | **Resolved** |
| Sequence-lane validator failures incomplete | Clean/findings/inconclusive/error mapping added | **Resolved in intent** |
| Supported-source coverage unspecified | Initial source-support matrix and unsupported-source preflight added | **Mostly resolved: partial-support and coverage thresholds remain inconsistent** |
| Rule ownership and duplicate findings undefined | Single-owner `ownedRuleIds` added | **Partially resolved: semantic duplicate rules with different IDs remain** |
| Enablement language/reference cleanup | Static release condition clarified; missing inventory made non-load-bearing | **Resolved** |

## Prioritized findings

### P0. Deterministic policy generation has no declarative rule metadata

V7 correctly rejects hand-maintained required-rule lists because they can
drift. It instead says the initial clean policies are produced by
deterministic selection rules such as:

- Polish Standard rules whose checks are statically determinable from
  CSS/markup;
- hardcoded-color and token-consistency rules;
- prohibited-pattern rules;
- static accessibility source-evidence rules.

Relevant design:

- `spec:391-417`
- `spec:564-572`

Those categories are not represented in the current rule contracts. Existing
Polish and Extended Domain rules expose:

```text
id
name
domain/category
description
severity
checkFunction
```

They do not expose:

- whether a rule is statically determinable;
- required evidence kinds;
- supported source kinds;
- applicability criteria;
- product-validator owner;
- finding class;
- canonical identity or semantic aliases.

Relevant repository:

- `sidecoach/src/polish-standard-validator.ts:5-16`
- `sidecoach/src/extended-domain-validator.ts:11-19`
- `sidecoach/src/extended-domain-validator.ts:174-550`

The generator cannot safely determine whether an arbitrary `checkFunction`
needs a live DOM, contrast metrics, component-tree metadata, or only CSS
without interpreting TypeScript function bodies. Reimplementing those
decisions in `generate-lanes.ts` would create the exact mirror drift the
design is trying to avoid.

For example, apparently static rules contain materially different evidence
semantics:

- Polish radius checks `computedStyle`;
- hit-area validation has a CSS fallback in one validator but requires a live
  element in the Extended Domain duplicate;
- not-applicable behavior is embedded inside check functions;
- genericity defaults missing metadata to zero in current code.

**Required resolution**

Introduce a canonical declarative rule definition:

```text
ProductRuleDefinition = {
  ruleId,
  canonicalRuleKey,
  ownerValidatorId,
  severity,
  findingClass,
  registryScope,
  evidenceRequirements[],
  supportedSourceKinds[],
  applicability,
  checkProduct(context) -> ProductRuleResult
}
```

Generate `ownedRuleIds`, `requiredRuleIds`, source-support declarations, and
policy anchors from this registry. `generate-lanes --check` must reject a
gating rule that lacks required metadata or whose generated policy differs
from the checked-in output.

Do not make the generator inspect or classify function source text.

### P0. The clean-policy evaluator cannot be implemented from the result schema

The clean policy includes:

```text
blockingSeverities[]
toleratedFindingCountsByClass
```

However, `ProductRuleResult` contains no severity or finding class, and
`ProductFinding` is referenced without a defined shape.

Relevant design:

- `spec:340-370`
- `spec:399-410`

The current source validators use incompatible severity systems:

- Polish, Extended Domain, and anti-pattern rules use
  `critical | high | medium | low`;
- linguistic and absolute-ban findings use `P0 | P1 | P2`;
- taste findings use `error`.

Relevant repository:

- `sidecoach/src/polish-standard-validator.ts:5-16`
- `sidecoach/src/anti-pattern-validator.ts:7-14`
- `sidecoach/src/linguistic-ban-validator.ts:33-42`
- `sidecoach/src/absolute-ban-detector.ts:28-38`
- `sidecoach/src/taste-validator.ts:8-19`

Without a canonical severity/class mapping, two implementations can evaluate
the same policy differently. It is also unclear whether a failed medium/low
rule:

- appears in `findings`;
- changes `ProductValidationResult.status` to `findings`;
- is tolerated while still reported;
- affects the progress signature.

**Required resolution**

Define the canonical finding and policy-evaluation contract:

```text
ProductFinding = {
  validatorId,
  ruleId,
  canonicalRuleKey,
  severity,
  findingClass,
  evidenceLocations[],
  message,
  remediation?
}

CanonicalSeverity = 'blocker' | 'major' | 'minor' | 'advisory'
```

Define a single normalization table from existing severity systems into the
canonical severity. Define evaluation order:

1. Verify required-rule coverage.
2. Block on required-rule inconclusive/error.
3. Count findings by canonical severity and class.
4. Apply tolerated counts.
5. Produce exactly one validator status.

Persist the normalized policy inputs and evaluation result so a clean decision
is reproducible.

### P1. Explicit lane policies conflict with automatic gate widening

V7 deliberately makes `LaneValidationPolicy.requiredProductValidatorIds` the
source of truth for a lane's gate. That is the correct design.

The spec still states that when an existing lane flow earns
`product_validator` capability, it automatically joins the required gate.
The acceptance suite repeats that promotion automatically widens the gate.

Relevant design:

- `spec:321-338`
- `spec:658-661`
- `spec:862-864`

Those rules conflict. A flow-bound validator can execute during a sequence
step without being required by `lane_converge`'s explicit lane policy.
Automatically mutating the lane gate from flow capability restores the
accidental coupling v7 was introduced to remove.

**Recommendation**

Keep lane policy explicit:

- binding a validator to a flow makes it gate that flow's sequence step;
- adding a validator to a lane policy makes it gate that lane;
- promoting a flow never silently changes a lane policy.

Generation should warn or fail when a product-validator flow belongs to a
loop lane but its validator is not explicitly classified as either required
or intentionally excluded by that lane policy.

### P1. Progress signatures ignore required inconclusive/error states

V7 correctly prevents required validator errors and inconclusive results from
converging. Stall detection is still specified as using only persisted
product-validator findings.

Relevant design:

- `spec:665-699`

A required validator can remain inconclusive or error without producing a
finding. If the progress signature contains only findings:

- different coverage gaps can share the same empty signature;
- a changing validator error can appear as no progress;
- progress from one inconclusive rule to another is invisible;
- stall reporting cannot identify the actual blocker.

**Recommendation**

Build the convergence signature from all required validator blocking state:

```text
validatorId
validator status
failed rule IDs
inconclusive rule IDs
coverage-gap identities
normalized error category
```

Messages and stack traces should remain excluded so unstable text does not
prevent stall detection.

### P1. Source-support and coverage-policy declarations are not aligned

The source-support matrix and minimum-coverage policies do not describe the
same source sets:

- theming and anti-pattern validators declare full LESS support, but their
  minimum coverage says all discovered CSS/SCSS;
- anti-pattern validation declares full HTML support, but its minimum coverage
  only names CSS/SCSS;
- static accessibility declares partial JSX/TSX support, while its minimum
  coverage names HTML/JSX and omits TSX;
- `partial` support does not define which rules can be proven and which must
  become inconclusive.

Relevant design:

- `spec:399-404`
- `spec:608-625`

This can permit a policy to meet its written coverage threshold while omitting
a source kind that the registry claims to support.

**Recommendation**

Generate `minimumCoverageByScope` from each required rule's declared evidence
requirements and supported source kinds. Define `partial` per rule, not only
per validator/source pair. A supported discovered file that is relevant to a
required rule must be inspected or make that rule inconclusive.

### P1. Single-owner IDs do not prevent semantic duplicate rules

V7 requires every gating `ruleId` to have exactly one validator owner. That
prevents the same literal ID from being owned twice, but it does not prevent
the same underlying rule from existing under different IDs.

The current Extended Domain registry begins with 22 duplicated Polish Standard
rules:

- Polish Standard uses IDs `1` through `22`;
- Extended Domain repeats them as `POLISH_001` through `POLISH_022`.

Relevant repository:

- `sidecoach/src/polish-standard-validator.ts:60-430`
- `sidecoach/src/extended-domain-validator.ts:174-529`

Examples include Scale on Press, Concentric Border Radius, No
`transition: all`, Focus Visible, Reduced Motion, Component State
Completeness, and Anti-Pattern Detection.

Because the IDs differ, a uniqueness check passes while one product defect can
still generate two gating findings and distort progress signatures.

**Recommendation**

Use `canonicalRuleKey` to detect semantic aliases. Each canonical gating rule
must have one owner and one execution path. Existing duplicate rule IDs must
either:

- alias the same canonical rule and be excluded from duplicate gating; or
- be consolidated into a single rule definition.

### P1. Flow J can unintentionally block all sequence lanes on unsupported sources

V7 states that sequence and loop lanes use the same validator-result mapping.
Flow J is bound to its static product validator, and every sequence lane
contains a polish step. The initial source matrix marks Vue, Svelte, and
CSS-in-JS projects inconclusive.

Relevant design:

- `spec:275-295`
- `spec:581-591`
- `spec:608-625`

As written, the five sequence lanes do not wait for the full convergence
release floor, but they can still be unable to complete their polish step on
unsupported projects because Flow J returns inconclusive. Only
`lane_converge` explicitly receives unsupported-source preflight behavior.

**Recommendation**

Choose and document one behavior for unsupported sequence-lane targets:

1. Reject at lane preflight with an actionable unsupported-source message.
2. Run Flow J as advisory for that step and require an explicit recorded user
   bypass.
3. Permit the lane but prevent final `completed` status until the unsupported
   validation is acknowledged.

Do not allow sequence lanes to appear stuck at completion without explaining
the source-support limitation before work starts.

### P2. Capability terminology and invariants still carry obsolete flow coupling

Several statements still describe flows as the entities that decide clean,
despite the first-class validator model:

- constraints say validation occurs where a flow declares capability;
- section 9 says only flows declared `product_validator` decide clean;
- `FlowValidationCapability.productValidatorIds` may be empty even when
  capability is `product_validator`.

Relevant design:

- `spec:52-58`
- `spec:315-324`
- `spec:546-552`

**Recommendation**

State that registered validators decide clean; flows and lanes only bind
validator IDs. Derive flow capability from its bindings or enforce:

```text
product_validator -> productValidatorIds.length > 0
advisory/none      -> productValidatorIds.length === 0
```

### P2. Static generation checks and behavioral contract tests are conflated

The spec says `generate-lanes.ts --check` rejects a policy that lacks fixtures
proving clean, findings, and inconclusive outcomes. The test plan separately
runs the engine test suite after the generator.

Relevant design:

- `spec:412-417`
- `spec:819-827`
- `spec:882-898`

It is unclear whether generation executes behavioral tests, checks only a
fixture manifest, or relies on the later test command.

**Recommendation**

Keep responsibilities explicit:

- generator check: registry structure, ownership, generated-policy drift,
  fixture-manifest presence;
- test suite: execute fixtures and prove clean/findings/inconclusive behavior.

## Required acceptance additions

Add these tests before implementation approval:

- Every gating rule has declarative owner, canonical key, severity/class,
  evidence requirements, source support, and applicability metadata.
- Generated policies contain no manually classified rule IDs.
- The same clean policy evaluates identically after serialization and reload.
- Severity normalization covers Polish, Extended Domain, anti-pattern,
  linguistic, absolute-ban, and taste findings.
- Medium/minor and tolerated findings have explicitly tested result statuses.
- Required inconclusive/error identities participate in progress signatures.
- Changing only a coverage gap changes the progress signature.
- Every source kind declared supported by a required rule participates in its
  coverage threshold.
- Semantic duplicate rules with different IDs fail generation unless declared
  aliases with one gating owner.
- Unsupported Vue/Svelte/CSS-in-JS sequence-lane behavior is explicit and
  tested at preflight and completion.
- Lane-policy changes are explicit; promoting a flow does not silently mutate
  a lane gate.

## Suggested v7 disposition

| V7 area | Assessment |
|---|---|
| Classifier and scope architecture | Approve |
| Model-driven lane state machine | Approve |
| Checkpoint, CAS, resume, retention, and containment | Approve |
| First-class validator registration and lane policies | Approve |
| Complete J/M/K/I/L capability table | Approve |
| Four-status result and run-derived coverage model | Approve |
| Deterministic clean-policy generation | Reject pending declarative rule metadata |
| Clean-policy evaluation | Reject pending canonical finding/severity contract |
| Bounded convergence release floor | Approve in direction |
| Browser and judgment-heavy validators deferred | Approve |

## Final recommendation

Keep v7's lane and validator architecture. Add a canonical declarative
`ProductRuleDefinition` registry and define the normalized finding/policy
evaluator before implementation begins.

Those additions should become the source from which validator ownership,
required-rule policies, source coverage, clean decisions, and progress
signatures are derived. This removes the last material ambiguity and avoids
recreating rule-classification drift inside the generator.
