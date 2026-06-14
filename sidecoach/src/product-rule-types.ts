// sidecoach/src/product-rule-types.ts
export type CanonicalSeverity = 'blocker' | 'major' | 'minor' | 'advisory';
export type NormalizedErrorCategory =
  | 'unreadable_input' | 'registry_fault' | 'validator_exception' | 'rule_exception'
  | 'timeout' | 'aborted' | 'unsupported_runtime' | 'other';
export type RuleStatus = 'pass' | 'fail' | 'not_applicable' | 'inconclusive';
export type EvidenceKind = 'css-rule' | 'computed-style' | 'dom' | 'markup' | 'contrast';
export type RuleScope = 'file' | 'component' | 'page' | 'project';
export type SourceVocabulary = 'polish-extended-antipattern' | 'p012' | 'taste';

export interface SourceKindSupport { kind: string; level: 'full' | 'partial' | 'none'; }

export interface ProductRuleDefinition {
  ruleId: string;
  sourceRuleAliases: string[];        // REQUIRED NON-EMPTY; cross-registry source ids for the SAME semantic rule
  canonicalRuleKey: string;
  ownerValidatorId: string;
  // sourceVocabulary + sourceSeverity feed the --check divergence guard: --check
  // normalizes sourceSeverity via SEVERITY_TABLE and REQUIRES severityOverrideReason
  // when the normalized default != the declared canonical `severity`.
  sourceVocabulary: SourceVocabulary;
  sourceSeverity: string;             // raw source value, e.g. 'critical' | 'P1' | 'error'
  severity: CanonicalSeverity;        // canonical, per-rule AUTHORITATIVE (evaluator reads only this)
  severityOverrideReason?: string;    // REQUIRED by --check when SEVERITY_TABLE[sourceSeverity] != severity
  findingClass: string;               // 'a11y' | 'theming' | 'anti-pattern' | 'copy' | 'polish' | ...
  registryScope: string;              // the user-facing claim this rule contributes to
  evidenceRequirements: EvidenceKind[];
  supportedSourceKinds: SourceKindSupport[];
  scope: RuleScope;
  narrowTargetBehavior: 'evaluate_expanded_context' | 'exclude_and_disclose' | 'reject_target';
  applicability: 'not_applicable' | 'inconclusive';   // disposition when the rule does not apply
  // checkProduct(context) -> ProductRuleResult is OPTIONAL here and ATTACHED in
  // P4a-2 (validator adaptation). The P4a-1 registry is purely declarative.
  checkProduct?: (context: unknown) => ProductRuleResult;
}

export interface ProductRuleResult {
  ruleId: string;
  canonicalRuleKey: string;
  status: RuleStatus;
  normalizedErrorCategory?: NormalizedErrorCategory;   // set when an inconclusive came from a caught throw / gap
  severity: CanonicalSeverity;
  findingClass: string;
  evidenceKind?: EvidenceKind;
  evidenceLocations: string[];
  message: string;
  remediation?: string;
}

export interface ProductFinding {
  validatorId: string;
  ruleId: string;
  canonicalRuleKey: string;
  severity: CanonicalSeverity;
  findingClass: string;
  evidenceLocations: string[];
  message: string;
  remediation?: string;
}

export interface RequiredCoverageRecord {
  ruleId: string;
  scope: RuleScope;
  // ONE alternatives list PER evidence requirement family. Each inner list is the
  // source kinds that can satisfy THAT requirement (static compatibility
  // intersected with the rule's supported source kinds). Coverage is satisfied
  // iff EVERY entry has at least one present source (AND across requirements, OR
  // within a requirement) - a flat union would let a css-only run "satisfy" a
  // css-rule+markup rule, which is the v4 false-satisfaction bug.
  evidenceAlternativesByRequirement: string[][];
  requireAllDiscoveredApplicableFiles: boolean;
}

export interface CleanPolicy {
  requiredRuleIds: string[];
  blockingSeverities: CanonicalSeverity[];
  toleratedFindingCounts: Record<string, number>;   // key: `${severity}|${findingClass}`; explicit 0 per owned blocking pair
  requiredCoverageByScope: RequiredCoverageRecord[];
  inconclusiveBehavior: 'block';
  notApplicableBehavior: 'exclude_and_report';
}

export interface ProductValidationCoverage {
  inspectedFiles: string[]; skippedFiles: string[];
  supportedSourceKinds: string[]; unsupportedSourceKinds: string[];
  ruleCounts: { pass: number; fail: number; notApplicable: number; inconclusive: number };
  findingCounts: { blockingExcess: number; withinTolerance: number; nonBlocking: number };
  measuredScope: string[]; unverifiedScope: string[];
  // P4c (additive, optional): stable file identities for convergence gap signatures
  // and truthful summaries. discoveredFiles = every discovered path; unreadableFiles
  // / unsupportedFiles are the corresponding gap subsets. Does not change evaluation.
  discoveredFiles?: string[];
  unreadableFiles?: string[];
  unsupportedFiles?: string[];
}

interface ProductValidationBase {
  rules: ProductRuleResult[];
  findings: ProductFinding[];
  coverage: ProductValidationCoverage;
}

// DISCRIMINATED UNION (spec 512-513): the `error` variant REQUIRES
// normalizedErrorCategory + error; the non-error variants carry neither. The
// compiler now enforces that a status==='error' result always has a category.
export interface ProductValidationOk extends ProductValidationBase {
  status: 'clean' | 'findings' | 'inconclusive';
}
export interface ProductValidationError extends ProductValidationBase {
  status: 'error';
  normalizedErrorCategory: NormalizedErrorCategory;
  error: string;
}
export type ProductValidationResult = ProductValidationOk | ProductValidationError;

export function isBlocking(sev: CanonicalSeverity, blocking: CanonicalSeverity[]): boolean {
  return blocking.includes(sev);
}

// The normalization table - used ONCE at registry-authoring time to SEED severity.
// The evaluator never reads it (per-rule severity is authoritative). --check uses it
// to flag undocumented divergence (Task 4).
export const SEVERITY_TABLE: Record<string, CanonicalSeverity> = {
  critical: 'blocker', P0: 'blocker', error: 'blocker',
  high: 'major', P1: 'major',
  medium: 'minor', P2: 'minor',
  low: 'advisory',
};

// EVIDENCE-COMPATIBILITY MODEL (spec lines 526-533, 608-612). Maps each evidence
// requirement to the SOURCE KINDS that can satisfy it statically. Browser-only
// evidence (dom / computed-style / contrast) maps to the EMPTY set: no static
// source kind can provide it until a browser-evidence collector exists (P4b+).
// This makes both `requiredRuleIds` derivation and the coverage satisfiability
// guard well-defined instead of prose.
export const EVIDENCE_SOURCE_COMPATIBILITY: Record<EvidenceKind, string[]> = {
  'css-rule': ['css', 'scss', 'sass', 'less', 'tsx', 'jsx', 'html', 'vue', 'svelte'],
  'markup': ['html', 'tsx', 'jsx', 'vue', 'svelte'],
  'computed-style': [],
  'dom': [],
  'contrast': [],
};

// The union of source kinds that can satisfy ALL of the given evidence requirements
// (union across requirements; a rule is satisfied if any listed kind is present for
// each requirement family it declares).
export function sourceKindsForEvidence(reqs: EvidenceKind[]): string[] {
  const set = new Set<string>();
  for (const e of reqs) for (const k of EVIDENCE_SOURCE_COMPATIBILITY[e]) set.add(k);
  return [...set];
}

// A rule is statically satisfiable iff it declares at least one evidence
// requirement and EVERY requirement has a non-empty static source-kind set
// (i.e. no dom / computed-style / contrast requirement).
export function isStaticallySatisfiable(reqs: EvidenceKind[]): boolean {
  return reqs.length > 0 && reqs.every((e) => EVIDENCE_SOURCE_COMPATIBILITY[e].length > 0);
}
