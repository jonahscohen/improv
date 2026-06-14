// sidecoach/src/validator-generation.ts
//
// PURE generation logic, INSIDE rootDir ./src so src/__tests__ can import it
// without a TS6059 rootDir crossing (the P2 lane-derivation precedent). The thin
// scripts/generate-validators.ts wrapper imports these for file I/O + --check.
import {
  CleanPolicy, ProductRuleDefinition, RequiredCoverageRecord, SourceKindSupport,
  SEVERITY_TABLE, sourceKindsForEvidence, isStaticallySatisfiable,
} from './product-rule-types';
import {
  ProductValidatorRegistration, LaneValidationPolicy, ValidatorFixtureManifest,
  FLOW_CAPABILITIES, deriveCapability,
} from './flow-validation-capabilities';

const BLOCKING: CleanPolicy['blockingSeverities'] = ['blocker', 'major'];

export interface GeneratedValidator {
  validatorId: string;
  ownedRuleIds: string[];
  registryScope: string[];
  supportedSourceKinds: SourceKindSupport[];
  cleanPolicy: CleanPolicy;
}

function dedupeSourceKinds(kinds: SourceKindSupport[]): SourceKindSupport[] {
  // strongest level wins per kind (full > partial > none)
  const rank = { full: 3, partial: 2, none: 1 } as const;
  const best = new Map<string, SourceKindSupport>();
  for (const k of kinds) {
    const cur = best.get(k.kind);
    if (!cur || rank[k.level] > rank[cur.level]) best.set(k.kind, k);
  }
  return [...best.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

// requireAll defaults TRUE (spec 526-533: completeness wants EVERY discovered
// applicable input checked). Only a rule that explicitly excludes-and-discloses
// narrow targets is permitted NOT to require all discovered files - derived from
// metadata, NOT a blanket component/page scope check.
function deriveRequireAll(r: ProductRuleDefinition): boolean {
  return r.narrowTargetBehavior !== 'exclude_and_disclose';
}

// PER-REQUIREMENT coverage alternatives: for EACH evidence requirement, the source
// kinds that can satisfy THAT requirement (static compatibility intersected with
// the rule's supported kinds). AND-across-requirements is then enforced by
// isCoverageSatisfied; a flat union would false-satisfy a css-rule+markup rule
// from a css-only run.
function coverageRecord(r: ProductRuleDefinition): RequiredCoverageRecord {
  const supported = new Set(r.supportedSourceKinds.filter((s) => s.level !== 'none').map((s) => s.kind));
  return {
    ruleId: r.ruleId,
    scope: r.scope,
    evidenceAlternativesByRequirement: r.evidenceRequirements.map((e) =>
      sourceKindsForEvidence([e]).filter((k) => supported.has(k))),
    requireAllDiscoveredApplicableFiles: deriveRequireAll(r),
  };
}

// PURE: derive one validator's generated entry from the registry.
export function deriveValidator(reg: ProductValidatorRegistration, rules: ProductRuleDefinition[]): GeneratedValidator {
  const owned = rules.filter((r) => r.ownerValidatorId === reg.validatorId);
  const required = owned.filter((r) => isStaticallySatisfiable(r.evidenceRequirements));

  const requiredCoverageByScope = required.map(coverageRecord);

  // EXPLICIT 0 tolerance for every owned blocking (severity,findingClass) pair.
  const toleratedFindingCounts: Record<string, number> = {};
  for (const r of owned) {
    if (BLOCKING.includes(r.severity)) toleratedFindingCounts[`${r.severity}|${r.findingClass}`] = 0;
  }

  const cleanPolicy: CleanPolicy = {
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
    cleanPolicy,
  };
}

// PURE: validate the whole registry; returns { ok, errors }. --check exits nonzero
// if !ok. Covers the spec 628-634 rejection set.
export function validateRegistry(rules: ProductRuleDefinition[], regs: ProductValidatorRegistration[], gatingValidatorIdList: string[] = []): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // FULL field completeness: EVERY required field must be non-empty.
  for (const r of rules) {
    const missing: string[] = [];
    if (!r.ruleId) missing.push('ruleId');
    if (!r.sourceRuleAliases?.length) missing.push('sourceRuleAliases');
    if (!r.canonicalRuleKey) missing.push('canonicalRuleKey');
    if (!r.ownerValidatorId) missing.push('ownerValidatorId');
    if (!r.severity) missing.push('severity');
    if (!r.findingClass) missing.push('findingClass');
    if (!r.scope) missing.push('scope');
    if (!r.sourceVocabulary) missing.push('sourceVocabulary');
    if (!r.sourceSeverity) missing.push('sourceSeverity');
    if (!r.registryScope) missing.push('registryScope');
    if (!r.narrowTargetBehavior) missing.push('narrowTargetBehavior');
    if (!r.applicability) missing.push('applicability');
    if (!r.evidenceRequirements?.length) missing.push('evidenceRequirements');
    if (!r.supportedSourceKinds?.length) missing.push('supportedSourceKinds');
    if (missing.length) errors.push(`rule ${r.ruleId || '(no id)'} missing required field(s): ${missing.join(', ')}`);
  }

  // duplicate canonical ruleId (distinct from canonicalRuleKey / aliases)
  const idCounts = new Map<string, number>();
  for (const r of rules) idCounts.set(r.ruleId, (idCounts.get(r.ruleId) ?? 0) + 1);
  for (const [id, n] of idCounts) if (id && n > 1) errors.push(`duplicate canonical ruleId ${id} (${n} definitions)`);

  // canonicalRuleKey with more than one owner / definition
  const byKey = new Map<string, Set<string>>();
  for (const r of rules) {
    if (!byKey.has(r.canonicalRuleKey)) byKey.set(r.canonicalRuleKey, new Set());
    byKey.get(r.canonicalRuleKey)!.add(r.ownerValidatorId);
  }
  for (const [key, owners] of byKey) {
    const defs = rules.filter((r) => r.canonicalRuleKey === key).length;
    if (key && (defs > 1 || owners.size > 1)) errors.push(`canonicalRuleKey ${key} has more than one owner/definition`);
  }

  // conflicting alias (one source id -> two canonical keys)
  const aliasTo = new Map<string, string>();
  for (const r of rules) for (const a of r.sourceRuleAliases) {
    const prev = aliasTo.get(a);
    if (prev && prev !== r.canonicalRuleKey) errors.push(`source alias ${a} maps to two canonical keys (${prev}, ${r.canonicalRuleKey})`);
    aliasTo.set(a, r.canonicalRuleKey);
  }

  // undocumented severity divergence
  for (const r of rules) {
    const def = SEVERITY_TABLE[r.sourceSeverity];
    if (def && def !== r.severity && !r.severityOverrideReason) {
      errors.push(`rule ${r.ruleId} severity ${r.severity} diverges from table default ${def} without severityOverrideReason`);
    }
  }

  // every owner referenced by a rule has a registration
  const registered = new Set(regs.map((v) => v.validatorId));
  for (const ownerId of new Set(rules.map((r) => r.ownerValidatorId))) {
    if (ownerId && !registered.has(ownerId)) errors.push(`rule owner ${ownerId} has no registration`);
  }

  // A gating registration must own at least one rule. Without this explicit
  // check, the no-owned-rules skip below would permit a lane-required validator
  // whose generated requiredRuleIds is empty.
  const gating = new Set(gatingValidatorIdList);
  for (const reg of regs) {
    if (gating.has(reg.validatorId) && rules.every((r) => r.ownerValidatorId !== reg.validatorId)) {
      errors.push(`gating validator ${reg.validatorId} owns zero rules`);
    }
  }

  // per-validator generated checks: non-empty requiredRuleIds + satisfiable coverage
  for (const reg of regs) {
    if (rules.every((r) => r.ownerValidatorId !== reg.validatorId)) continue; // non-gating empty registrations may remain identity-only
    const g = deriveValidator(reg, rules);
    if (g.cleanPolicy.requiredRuleIds.length === 0) errors.push(`validator ${reg.validatorId} has empty generated requiredRuleIds`);
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
export function gatingValidatorIds(policies: LaneValidationPolicy[]): string[] {
  return [...new Set(policies.flatMap((p) => p.requiredProductValidatorIds))];
}

// PURE: every gating validator must declare a clean/findings/inconclusive
// fixture-manifest entry. P4a-1 checks PRESENCE only; P4a-2 creates and executes
// the fixture files (spec 628-634; section 15 separates these). --check rejects a gap.
export function validateFixtureManifest(gating: string[], manifest: ValidatorFixtureManifest[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const byId = new Map(manifest.map((m) => [m.validatorId, m]));
  for (const id of gating) {
    const m = byId.get(id);
    if (!m) { errors.push(`gating validator ${id} has no fixture-manifest entry`); continue; }
    for (const cat of ['clean', 'findings', 'inconclusive'] as const) {
      if (!m.fixtures[cat]) errors.push(`gating validator ${id} fixture-manifest missing ${cat} entry`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// resolved flow capabilities (generated; --check asserts file equality)
export function deriveFlowCapabilities() {
  return FLOW_CAPABILITIES.map((f) => ({ flowId: f.flowId as string, capability: deriveCapability(f) }));
}
