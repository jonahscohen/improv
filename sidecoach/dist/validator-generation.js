"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENDERED_BACKED_RULE_IDS = exports.BROWSER_BACKED_RULE_IDS = void 0;
exports.deriveValidator = deriveValidator;
exports.validateRegistry = validateRegistry;
exports.gatingValidatorIds = gatingValidatorIds;
exports.validateFixtureManifest = validateFixtureManifest;
exports.deriveFlowCapabilities = deriveFlowCapabilities;
// sidecoach/src/validator-generation.ts
//
// PURE generation logic, INSIDE rootDir ./src so src/__tests__ can import it
// without a TS6059 rootDir crossing (the P2 lane-derivation precedent). The thin
// scripts/generate-validators.ts wrapper imports these for file I/O + --check.
const product_rule_types_1 = require("./product-rule-types");
const source_support_matrix_1 = require("./validators/source-support-matrix");
const flow_validation_capabilities_1 = require("./flow-validation-capabilities");
const BLOCKING = ['blocker', 'major'];
// P4b-2 EXPLICIT browser-backed allowlist. ONLY these rules are promoted into
// active browser policy when the collector succeeds. polish.anti-pattern-genericity
// is deliberately EXCLUDED (team-lead decision) even though it also declares 'dom':
// its render-URL meaning was never defined, so it stays owned, non-required, and
// inconclusive. Browser satisfiability is NOT inferred from "any non-static evidence
// requirement" - it is this hand-maintained allowlist.
exports.BROWSER_BACKED_RULE_IDS = new Set([
    'a11y.min-hit-area',
    'polish.concentric-radius',
    'polish.typography-rhythm',
]);
// RENDERED-backed rules: satisfied by the live rendered scan (scanRenderedLive), promoted to required when a
// renderUrl is PRESENT (run-validator activateRenderedPolicy). Each must declare ONLY 'rendered-scan' evidence.
// Stage 6 convergence: a11y.color-contrast MIGRATED off the collector contrast probe onto the rendered scanner's
// low-contrast finding (the SAME detector the eval scores) - closing the eval-only hole the one-engine audit
// found. Its old collector contrast probe is now orphaned (no live rule consumes ctx.contrast).
exports.RENDERED_BACKED_RULE_IDS = new Set([
    'a11y.broken-image',
    'a11y.skipped-heading',
    'a11y.gray-on-color',
    'a11y.justified-text',
    'a11y.color-contrast',
    'polish.tiny-text',
    'polish.marketing-buzzword',
]);
// Evidence kinds the browser-evidence collector actually produces. An allowlisted
// browser rule whose declared evidence is outside this set could never be satisfied
// by collection, so --check rejects it.
const COLLECTOR_EVIDENCE_KINDS = new Set(['computed-style', 'dom', 'contrast']);
// The ONLY evidence kind a rendered-backed rule may declare - the live rendered scan. --check rejects a
// rendered-backed rule that declares anything else (e.g. a stray static or collector kind).
const RENDERED_EVIDENCE_KINDS = new Set(['rendered-scan']);
function dedupeSourceKinds(kinds) {
    // strongest level wins per kind (full > partial > none)
    const rank = { full: 3, partial: 2, none: 1 };
    const best = new Map();
    for (const k of kinds) {
        const cur = best.get(k.kind);
        if (!cur || rank[k.level] > rank[cur.level])
            best.set(k.kind, k);
    }
    return [...best.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}
// requireAll defaults TRUE (spec 526-533: completeness wants EVERY discovered
// applicable input checked). Only a rule that explicitly excludes-and-discloses
// narrow targets is permitted NOT to require all discovered files - derived from
// metadata, NOT a blanket component/page scope check.
function deriveRequireAll(r) {
    return r.narrowTargetBehavior !== 'exclude_and_disclose';
}
// PER-REQUIREMENT coverage alternatives: for EACH evidence requirement, the source
// kinds that can satisfy THAT requirement (static compatibility intersected with
// the rule's supported kinds). AND-across-requirements is then enforced by
// isCoverageSatisfied; a flat union would false-satisfy a css-rule+markup rule
// from a css-only run.
function coverageRecord(r) {
    const supported = new Set(r.supportedSourceKinds.filter((s) => s.level !== 'none').map((s) => s.kind));
    return {
        ruleId: r.ruleId,
        scope: r.scope,
        evidenceAlternativesByRequirement: r.evidenceRequirements.map((e) => (0, product_rule_types_1.sourceKindsForEvidence)([e]).filter((k) => supported.has(k))),
        requireAllDiscoveredApplicableFiles: deriveRequireAll(r),
    };
}
// Non-static coverage is satisfied by an evidence KIND directly (each evidence requirement is its own kind, e.g.
// 'dom' / 'computed-style' / 'contrast' for the collector, or 'rendered-scan' for the live scan), NOT by static
// source kinds. The runtime matches these against the evidence kinds present for the render-URL target. Shared by
// the browser and rendered promotion paths (their coverage semantics are identical).
function evidenceKindCoverageRecord(r) {
    return {
        ruleId: r.ruleId,
        scope: r.scope,
        evidenceAlternativesByRequirement: r.evidenceRequirements.map((e) => [e]),
        requireAllDiscoveredApplicableFiles: deriveRequireAll(r),
    };
}
// PURE: derive one validator's generated entry from the registry.
function deriveValidator(reg, rules) {
    const owned = rules.filter((r) => r.ownerValidatorId === reg.validatorId);
    const required = owned.filter((r) => (0, product_rule_types_1.isStaticallySatisfiable)(r.evidenceRequirements));
    const browserRequired = owned.filter((r) => exports.BROWSER_BACKED_RULE_IDS.has(r.ruleId));
    const renderedRequired = owned.filter((r) => exports.RENDERED_BACKED_RULE_IDS.has(r.ruleId));
    const requiredCoverageByScope = required.map(coverageRecord);
    // EXPLICIT 0 tolerance for every owned blocking (severity,findingClass) pair.
    const toleratedFindingCounts = {};
    for (const r of owned) {
        if (BLOCKING.includes(r.severity))
            toleratedFindingCounts[`${r.severity}|${r.findingClass}`] = 0;
    }
    const cleanPolicy = {
        requiredRuleIds: required.map((r) => r.ruleId),
        blockingSeverities: BLOCKING,
        toleratedFindingCounts,
        requiredCoverageByScope,
        inconclusiveBehavior: 'block',
        notApplicableBehavior: 'exclude_and_report',
    };
    return {
        validatorId: reg.validatorId,
        ownedRuleIds: owned.map((r) => r.ruleId),
        registryScope: [...new Set(owned.map((r) => r.registryScope))],
        supportedSourceKinds: dedupeSourceKinds(owned.flatMap((r) => r.supportedSourceKinds)),
        browserRuleIds: browserRequired.map((r) => r.ruleId),
        browserCoverageByScope: browserRequired.map(evidenceKindCoverageRecord),
        renderedRuleIds: renderedRequired.map((r) => r.ruleId),
        renderedCoverageByScope: renderedRequired.map(evidenceKindCoverageRecord),
        cleanPolicy,
    };
}
// PURE: validate the whole registry; returns { ok, errors }. --check exits nonzero
// if !ok. Covers the spec 628-634 rejection set.
function validateRegistry(rules, regs, gatingValidatorIdList = [], browserBackedRuleIds = [], renderedBackedRuleIds = []) {
    const errors = [];
    // FULL field completeness: EVERY required field must be non-empty.
    for (const r of rules) {
        const missing = [];
        if (!r.ruleId)
            missing.push('ruleId');
        if (!r.sourceRuleAliases?.length)
            missing.push('sourceRuleAliases');
        if (!r.canonicalRuleKey)
            missing.push('canonicalRuleKey');
        if (!r.ownerValidatorId)
            missing.push('ownerValidatorId');
        if (!r.severity)
            missing.push('severity');
        if (!r.findingClass)
            missing.push('findingClass');
        if (!r.scope)
            missing.push('scope');
        if (!r.sourceVocabulary)
            missing.push('sourceVocabulary');
        if (!r.sourceSeverity)
            missing.push('sourceSeverity');
        if (!r.registryScope)
            missing.push('registryScope');
        if (!r.narrowTargetBehavior)
            missing.push('narrowTargetBehavior');
        if (!r.applicability)
            missing.push('applicability');
        if (!r.evidenceRequirements?.length)
            missing.push('evidenceRequirements');
        if (!r.supportedSourceKinds?.length)
            missing.push('supportedSourceKinds');
        if (missing.length)
            errors.push(`rule ${r.ruleId || '(no id)'} missing required field(s): ${missing.join(', ')}`);
        // a present-but-blank alias entry is not a valid alias (the array-length check
        // above only rejects an empty array, not [''] or ['   ']).
        if (r.sourceRuleAliases?.some((a) => !a || !a.trim())) {
            errors.push(`rule ${r.ruleId || '(no id)'} has a blank/empty sourceRuleAlias entry`);
        }
        // supportedSourceKinds must match the ONE shared matrix exactly (no authored or
        // generated support list may drift from supportedKindsFor for this rule's evidence).
        if (r.evidenceRequirements?.length && r.supportedSourceKinds?.length) {
            const expected = (0, source_support_matrix_1.supportedKindsFor)(...r.evidenceRequirements);
            if (JSON.stringify(r.supportedSourceKinds) !== JSON.stringify(expected)) {
                errors.push(`rule ${r.ruleId || '(no id)'} supportedSourceKinds diverge from the shared source-support matrix`);
            }
        }
    }
    // duplicate canonical ruleId (distinct from canonicalRuleKey / aliases)
    const idCounts = new Map();
    for (const r of rules)
        idCounts.set(r.ruleId, (idCounts.get(r.ruleId) ?? 0) + 1);
    for (const [id, n] of idCounts)
        if (id && n > 1)
            errors.push(`duplicate canonical ruleId ${id} (${n} definitions)`);
    // canonicalRuleKey with more than one owner / definition
    const byKey = new Map();
    for (const r of rules) {
        if (!byKey.has(r.canonicalRuleKey))
            byKey.set(r.canonicalRuleKey, new Set());
        byKey.get(r.canonicalRuleKey).add(r.ownerValidatorId);
    }
    for (const [key, owners] of byKey) {
        const defs = rules.filter((r) => r.canonicalRuleKey === key).length;
        if (key && (defs > 1 || owners.size > 1))
            errors.push(`canonicalRuleKey ${key} has more than one owner/definition`);
    }
    // conflicting alias (one source id -> two canonical keys)
    const aliasTo = new Map();
    for (const r of rules)
        for (const a of r.sourceRuleAliases) {
            const prev = aliasTo.get(a);
            if (prev && prev !== r.canonicalRuleKey)
                errors.push(`source alias ${a} maps to two canonical keys (${prev}, ${r.canonicalRuleKey})`);
            aliasTo.set(a, r.canonicalRuleKey);
        }
    // undocumented severity divergence
    for (const r of rules) {
        if (!r.sourceSeverity)
            continue; // already flagged by the field-completeness check
        const def = product_rule_types_1.SEVERITY_TABLE[r.sourceSeverity];
        // an unknown/typoed sourceSeverity cannot be normalized or compared against
        // the declared canonical severity - reject it rather than silently skipping
        // the divergence guard (which would let any severity claim through).
        if (!def) {
            errors.push(`rule ${r.ruleId} sourceSeverity '${r.sourceSeverity}' has no SEVERITY_TABLE entry (cannot normalize/compare)`);
            continue;
        }
        if (def !== r.severity && !r.severityOverrideReason) {
            errors.push(`rule ${r.ruleId} severity ${r.severity} diverges from table default ${def} without severityOverrideReason`);
        }
    }
    // every owner referenced by a rule has a registration
    const registered = new Set(regs.map((v) => v.validatorId));
    for (const ownerId of new Set(rules.map((r) => r.ownerValidatorId))) {
        if (ownerId && !registered.has(ownerId))
            errors.push(`rule owner ${ownerId} has no registration`);
    }
    // Every gating validator (lane-required id) must have a registration. The
    // owns-at-least-one-rule loop below iterates `regs`, so a gating id that
    // NOTHING registers would never be checked and slip through unguarded.
    const gating = new Set(gatingValidatorIdList);
    for (const gid of gatingValidatorIdList) {
        if (gid && !registered.has(gid))
            errors.push(`gating validator ${gid} has no registration`);
    }
    // A gating registration must own at least one rule. Without this explicit
    // check, the no-owned-rules skip below would permit a lane-required validator
    // whose generated requiredRuleIds is empty.
    for (const reg of regs) {
        if (gating.has(reg.validatorId) && rules.every((r) => r.ownerValidatorId !== reg.validatorId)) {
            errors.push(`gating validator ${reg.validatorId} owns zero rules`);
        }
    }
    // P4b-2 browser-backed allowlist consistency. EACH allowlisted id must be owned
    // by a present rule, must NOT be statically satisfiable (a static rule belongs in
    // cleanPolicy, not browser policy), and every declared evidence requirement must
    // be a collector-produced kind. Rules OUTSIDE the allowlist are NEVER rejected for
    // being non-static, so an excluded owned rule (e.g. genericity) stays valid as
    // owned, non-required, and inconclusive.
    const byRuleId = new Map(rules.map((r) => [r.ruleId, r]));
    for (const id of new Set(browserBackedRuleIds)) {
        const r = byRuleId.get(id);
        if (!r) {
            errors.push(`browser-backed rule ${id} is not present in the registry`);
            continue;
        }
        if ((0, product_rule_types_1.isStaticallySatisfiable)(r.evidenceRequirements)) {
            errors.push(`browser-backed rule ${id} is statically satisfiable and must not be in the browser allowlist`);
        }
        const nonCollector = r.evidenceRequirements.filter((e) => !COLLECTOR_EVIDENCE_KINDS.has(e));
        if (nonCollector.length) {
            errors.push(`browser-backed rule ${id} declares non-collector evidence (${nonCollector.join(', ')})`);
        }
    }
    // RENDERED-backed allowlist consistency (parallel to the browser allowlist). Each allowlisted id must be owned
    // by a present rule, must NOT be statically satisfiable, and must declare ONLY 'rendered-scan' evidence (the
    // live scan is the only channel that satisfies it). A rule may be in at most one of the two allowlists.
    for (const id of new Set(renderedBackedRuleIds)) {
        const r = byRuleId.get(id);
        if (!r) {
            errors.push(`rendered-backed rule ${id} is not present in the registry`);
            continue;
        }
        if ((0, product_rule_types_1.isStaticallySatisfiable)(r.evidenceRequirements)) {
            errors.push(`rendered-backed rule ${id} is statically satisfiable and must not be in the rendered allowlist`);
        }
        const nonRendered = r.evidenceRequirements.filter((e) => !RENDERED_EVIDENCE_KINDS.has(e));
        if (nonRendered.length) {
            errors.push(`rendered-backed rule ${id} declares non-rendered evidence (${nonRendered.join(', ')})`);
        }
        if (browserBackedRuleIds.includes(id)) {
            errors.push(`rule ${id} is in BOTH the browser and rendered allowlists (a rule has one evidence channel)`);
        }
    }
    // INVERSE invariant (the gap that let marketing-buzzword ship un-promoted): EVERY rule that declares a
    // rendered-scan evidence requirement MUST be in the rendered allowlist. Without this, a rule can declare
    // ['rendered-scan'] yet be omitted from RENDERED_BACKED_RULE_IDS, so it is never promoted-required on a renderUrl
    // and never fails-closed on an unavailable scan (a silent false-clean). Forward + inverse together pin the set.
    const renderedSet = new Set(renderedBackedRuleIds);
    for (const r of rules) {
        if (r.evidenceRequirements.some((e) => RENDERED_EVIDENCE_KINDS.has(e)) && !renderedSet.has(r.ruleId)) {
            errors.push(`rule ${r.ruleId} declares rendered-scan evidence but is missing from RENDERED_BACKED_RULE_IDS (it would never be promoted-required or fail-closed)`);
        }
    }
    // per-validator generated checks: non-empty requiredRuleIds + satisfiable coverage
    for (const reg of regs) {
        if (rules.every((r) => r.ownerValidatorId !== reg.validatorId))
            continue; // non-gating empty registrations may remain identity-only
        const g = deriveValidator(reg, rules);
        if (g.cleanPolicy.requiredRuleIds.length === 0)
            errors.push(`validator ${reg.validatorId} has empty generated requiredRuleIds`);
        for (const c of g.cleanPolicy.requiredCoverageByScope) {
            // AND-across-requirements: EVERY requirement must have >=1 alternative.
            if (c.evidenceAlternativesByRequirement.length === 0 || c.evidenceAlternativesByRequirement.some((alts) => alts.length === 0)) {
                errors.push(`coverage plan for ${c.ruleId} cannot satisfy its declared evidence`);
            }
        }
    }
    return { ok: errors.length === 0, errors };
}
// gating validators = every id required by some lane policy.
function gatingValidatorIds(policies) {
    return [...new Set(policies.flatMap((p) => p.requiredProductValidatorIds))];
}
// PURE: every gating validator must declare a clean/findings/inconclusive
// fixture-manifest entry. P4a-1 checks PRESENCE only; P4a-2 creates and executes
// the fixture files (spec 628-634; section 15 separates these). --check rejects a gap.
function validateFixtureManifest(gating, manifest) {
    const errors = [];
    const byId = new Map(manifest.map((m) => [m.validatorId, m]));
    for (const id of gating) {
        const m = byId.get(id);
        if (!m) {
            errors.push(`gating validator ${id} has no fixture-manifest entry`);
            continue;
        }
        for (const cat of ['clean', 'findings', 'inconclusive']) {
            if (!m.fixtures[cat])
                errors.push(`gating validator ${id} fixture-manifest missing ${cat} entry`);
        }
    }
    return { ok: errors.length === 0, errors };
}
// resolved flow capabilities (generated; --check asserts file equality)
function deriveFlowCapabilities() {
    return flow_validation_capabilities_1.FLOW_CAPABILITIES.map((f) => ({ flowId: f.flowId, capability: (0, flow_validation_capabilities_1.deriveCapability)(f) }));
}
//# sourceMappingURL=validator-generation.js.map