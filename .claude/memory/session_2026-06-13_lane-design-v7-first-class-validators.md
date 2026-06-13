---
name: lane intent detection design v7 - first-class validators
description: Sixth review folded in; product validators decoupled from verb-flow ownership (3-registry model), concrete non-vacuous clean policies, complete J/M/K/I/L table, sequence inconclusive/error contract, source-support matrix, single-owner rules
type: decision
relates_to: [session_2026-06-12_lane-design-v6-release-floor.md, reference_convergence_validator_capability_inventory.md]
supersedes: session_2026-06-12_lane-design-v6-release-floor.md
superseded_by: session_2026-06-13_lane-design-v8-declarative-rule-registry.md
---

Spec revised to v7 after the sixth independent review (the cleanest yet:
architecture fully Approve; remaining items were "make the chosen thing
precise and buildable"). All claims verified in source before adoption.

**Verified review claims:**
- audit owns [flowK_multi_lens_audit, flowI_accessibility]
  (verb-command-registry.ts:115-121) -> the deduped lane_converge loop is
  J, M, K, I, L (polish [J,M] + audit [K,I] + critique [L,K]). v6 section 9
  omitted M and I. CONFIRMED, fixed.
- flowM records 'warning' "Mandatory verification requires render at
  375/768/1024 ... cannot pass on documentation alone" -> correctly advisory.
- flowI emits framework-COVERAGE validations (All 7 domains covered, etc.),
  not target findings -> the static a11y slice is a SEPARATE registered
  validator, not flowI's handler output.
- polish-standard severities critical|high|medium|low (24 rules);
  absolute-ban-detector P0|P1|P2 default P1 "pattern shapes not certainties";
  linguistic P0=0 / P1<=2 already enforced -> real anchors for non-vacuous
  policies.
- REVIEWER ERROR: claimed reference_convergence_validator_capability_inventory.md
  "not present" - it IS present (committed 5c27bf9, 3104 bytes). But the
  deeper point is fair: a spec shouldn't lean on an internal beat as a
  resolvable reference. Fixed by demoting it to "internal engineering note,
  not a load-bearing spec dependency."

**Changes made (no new strategic fork - all contract completions within the
v6-chosen bounded-floor architecture; one wiring judgment stated, not
interviewed, per the v4/v5 precedent):**

P0 #1 - product validators are first-class. Split into THREE registries in
flow-validation-capabilities.ts: ProductValidatorRegistration (identity:
validatorId, registryScope, cleanPolicy, ownedRuleIds, supportedSourceKinds,
validateProduct), FlowValidationCapability (flow -> validatorIds binding),
LaneValidationPolicy (lane -> requiredProductValidatorIds). The release-floor
slices bind to lane_converge via the LANE POLICY, not verb-flow ownership.
--check rejects: unregistered required ID, duplicate IDs, validator with no
execution owner, floor validator absent from lane policy, ruleId owned by two
validators (single-owner identity kills double-counting). WIRING JUDGMENT:
chose the reviewer's lane-level registry over flow-attachment because release
gating shouldn't piggyback on which verb happens to own which flow.

P0 #2 - concrete non-vacuous clean policies. Not hand-frozen (drift risk);
produced by a DETERMINISTIC SELECTION RULE at generation, proven by fixtures.
Per-validator table with verified anchors (Flow J: static-determinable
polish rules, blocking critical/high, linguistic P0=0/P1<=2, ban P0=0;
theming: hardcoded-color/token rules; anti-patterns: prohibited-pattern ban
shapes; static a11y: source-evidence label/ARIA/focus/reduced-motion).
--check rejects empty required-rule sets, vacuous coverage, rules outside
registryScope/ownedRuleIds, and any policy lacking clean+findings+inconclusive
fixtures.

P1s: complete J/M/K/I/L capability table (M/K/I/L advisory, only J +
3 lane-bound static validators gate); sequence-lane completion contract
clean->proceed / findings->validation_failed / inconclusive->
validation_inconclusive / error->validation_error (only user skip/stop
bypasses); LaneState step-status enum extended; initial source-support
matrix (CSS/HTML full, JSX/TSX partial, Vue/Svelte/CSS-in-JS inconclusive
follow-up) with a representative supported fixture REQUIRED to reach clean
and unsupported-only projects failing preflight (no inconclusive loop);
single-owner rule identity.

P2: "present and green" -> "registered, attached, structurally valid, proven
by contract fixtures" (static condition vs runtime cleanliness); inventory
reference demoted; generation-strategy "measured scope" -> registryScope/
ownedRuleIds terminology.

v7 disposition: every sixth-review area is Approve or implemented. Six
versions, six reviews. Remaining step: implementation plan (writing-plans),
which should stage classifier + 5 sequence lanes ahead of the converge floor
work (the spec structure supports this split).

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v7 edits)
