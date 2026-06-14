// sidecoach/src/validators/run-validator.ts
//
// makeProductValidator(validatorId) -> (context) => ProductValidationResult. Reads
// the validator's GENERATED cleanPolicy/ownedRuleIds, collects a project, executes
// file-scoped rules once per APPLICABLE file (and project-scoped rules once over the
// assembled shape), builds truthful CoverageObservations + evidence-derived
// RunCoverage, and calls the P4a-1 evaluateCleanPolicy (never re-implements it).
import type {
  ProductValidationResult, ProductRuleResult, ProductRuleDefinition, RequiredCoverageRecord,
  RuleStatus, NormalizedErrorCategory,
} from '../product-rule-types';
import { isStaticallySatisfiable, sourceKindsForEvidence } from '../product-rule-types';
import { getRuleById } from '../product-rule-registry';
import { GENERATED_VALIDATORS } from '../validators.generated';
import { evaluateCleanPolicy, isCoverageSatisfied } from '../clean-evaluator';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import { collect } from './project-collector';
import type { Collected } from './project-collector';
import { stampResult, inconclusive } from './check-context';
import type { ProductCheckContext, CollectedFile } from './check-context';

function toCheckContext(c: Collected, raw: unknown): ProductCheckContext {
  const r = raw as Partial<ProductCheckContext>;
  return {
    cssText: c.cssText, markup: c.markup, files: c.files, discoveredFiles: c.discovered,
    computedStyle: r?.computedStyle, contrast: r?.contrast, designTokens: r?.designTokens, tasteOptions: r?.tasteOptions,
  };
}

export interface RuleExecution {
  result: ProductRuleResult;
  discoveredApplicableFiles: Array<{ file: string; evidenceKindsPresent: string[] }>;
  inspectedApplicableFiles: string[];
  sufficientlyCovered: boolean;
}

function observationFor(x: RuleExecution): CoverageObservation {
  return {
    ruleId: x.result.ruleId,
    inspectedFiles: x.inspectedApplicableFiles,
    discoveredApplicableFiles: x.discoveredApplicableFiles,
  };
}

// The single execution/coverage source of truth (spec contract):
// 1. Browser-only rules have no static candidates -> run once (inconclusive), no coverage.
// 2. Static rules select candidate files by ACTUAL evidence presence (a css-rule file
//    must carry css text; a markup file must carry markup) so an html file with no
//    inline <style> never silently fails a css-rule check.
// 3. scope:file -> checkProduct once per applicable file via a one-file context;
//    scope:project -> checkProduct once over the assembled shape (the faithful source
//    scanner reasons over the page/project). Aggregate: any gap/inconclusive ->
//    inconclusive; else any fail -> fail; else any pass -> pass; else all N/A -> N/A.
// 4. A pass in one file can never cover a fail/gap in another applicable file.
function executeRule(
  def: ProductRuleDefinition,
  record: RequiredCoverageRecord | undefined,
  collected: Collected,
  raw: unknown,
): RuleExecution {
  const reqKind = def.evidenceRequirements[0];

  if (!isStaticallySatisfiable(def.evidenceRequirements)) {
    // computed-style/dom/contrast: no static source can satisfy this until P4b.
    const result = def.checkProduct!(toCheckContext(collected, raw)) as ProductRuleResult;
    return { result, discoveredApplicableFiles: [], inspectedApplicableFiles: [], sufficientlyCovered: false };
  }

  const compatible = record
    ? new Set(record.evidenceAlternativesByRequirement.flat())
    : new Set(sourceKindsForEvidence([reqKind]));
  // Candidates are inspected files of a COMPATIBLE source kind - NOT only files that
  // already yielded extracted text. A compatible inspected file that carries an
  // applicable target but no usable evidence (e.g. an html/tsx with an uncovered
  // <button> and no inline <style>) still runs the check and surfaces inconclusive,
  // so the rule cannot be falsely reported measured/clean (Codex P1#1).
  const readable = collected.files.filter((f) => compatible.has(f.sourceKind));
  // Gaps force the rule inconclusive: an oversized/unreadable file of a compatible kind,
  // OR an unreadable directory subtree (sourceKind 'directory') - which could harbor
  // applicable files of ANY kind, so it is an unknown gap for every static rule (Codex
  // P1#2). Without the directory clause an unreadable subtree yielded a false clean.
  const gaps = collected.discovered.filter((d) =>
    (d.outcome === 'oversized' && compatible.has(d.sourceKind))
    || (d.outcome === 'unreadable' && (d.sourceKind === 'directory' || compatible.has(d.sourceKind))));

  if (readable.length === 0 && gaps.length === 0) {
    return {
      result: stampResult(def, inconclusive(`no inspected ${reqKind} evidence for ${def.canonicalRuleKey}`, 'unreadable_input')),
      discoveredApplicableFiles: [], inspectedApplicableFiles: [], sufficientlyCovered: false,
    };
  }

  type PerFile = { file: CollectedFile; result: ProductRuleResult };
  const perFile: PerFile[] = [];
  if (def.scope === 'project') {
    const result = def.checkProduct!(toCheckContext(collected, raw)) as ProductRuleResult;
    for (const f of readable) perFile.push({ file: f, result });
  } else {
    for (const f of readable) {
      const oneFile: ProductCheckContext = {
        cssText: f.cssText, markup: f.markup, files: [f],
        tasteOptions: (raw as Partial<ProductCheckContext>)?.tasteOptions,
      };
      perFile.push({ file: f, result: def.checkProduct!(oneFile) as ProductRuleResult });
    }
  }

  const applicable = perFile.filter((p) => p.result.status !== 'not_applicable');
  const discoveredApplicableFiles = [
    ...applicable.map((p) => ({ file: p.file.path, evidenceKindsPresent: p.file.evidenceKindsPresent })),
    ...gaps.map((g) => ({ file: g.path, evidenceKindsPresent: [g.sourceKind] })),
  ];
  const inspectedApplicableFiles = applicable.map((p) => p.file.path);

  const statuses = applicable.map((p) => p.result.status);
  let status: RuleStatus;
  let category: NormalizedErrorCategory | undefined;
  if (gaps.length > 0 || statuses.includes('inconclusive')) {
    status = 'inconclusive';
    category = applicable.find((p) => p.result.status === 'inconclusive')?.result.normalizedErrorCategory ?? 'unreadable_input';
  } else if (statuses.includes('fail')) {
    status = 'fail';
  } else if (statuses.includes('pass')) {
    status = 'pass';
  } else {
    status = 'not_applicable';
  }

  const contributing = applicable.filter((p) =>
    status === 'inconclusive' ? p.result.status === 'inconclusive'
      : status === 'fail' ? p.result.status === 'fail'
        : status === 'pass' ? p.result.status === 'pass'
          : true);
  const evidenceLocations = [...new Set(contributing.flatMap((p) => p.result.evidenceLocations))];
  const message = contributing.map((p) => p.result.message).find(Boolean)
    ?? (status === 'inconclusive' ? `unread ${reqKind} evidence for ${def.canonicalRuleKey}` : `${def.canonicalRuleKey}: ${status}`);
  const remediation = contributing.map((p) => p.result.remediation).find((m): m is string => !!m);

  const result: ProductRuleResult = {
    ruleId: def.ruleId, canonicalRuleKey: def.canonicalRuleKey, status,
    normalizedErrorCategory: status === 'inconclusive' ? category : undefined,
    severity: def.severity, findingClass: def.findingClass,
    evidenceKind: def.evidenceRequirements[0], evidenceLocations, message, remediation,
  };

  const exec: RuleExecution = { result, discoveredApplicableFiles, inspectedApplicableFiles, sufficientlyCovered: false };
  exec.sufficientlyCovered = status !== 'inconclusive' && isCoverageSatisfied(record, observationFor(exec));
  return exec;
}

export interface ValidatorRunDetail {
  result: ProductValidationResult;
  executions: RuleExecution[];
  coverageObservations: CoverageObservation[];
  runCoverage: RunCoverage;
}

function emptyRun(): RunCoverage {
  return { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [], measuredScope: [], unverifiedScope: [] };
}

function runDetailed(validatorId: string, context: unknown): ValidatorRunDetail {
  const gen = GENERATED_VALIDATORS.find((v) => v.validatorId === validatorId);
  const policy = gen?.cleanPolicy;
  if (!gen || !policy) {
    const result = evaluateCleanPolicy(
      { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
        validatorError: { category: 'registry_fault', message: `no generated validator for ${validatorId}` } },
      { requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {}, requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report' },
    );
    return { result, executions: [], coverageObservations: [], runCoverage: emptyRun() };
  }

  let collected: Collected;
  try { collected = collect(context); }
  catch (e) {
    const result = evaluateCleanPolicy(
      { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
        validatorError: { category: 'unreadable_input', message: String(e instanceof Error ? e.message : e) } },
      policy,
    );
    return { result, executions: [], coverageObservations: [], runCoverage: emptyRun() };
  }

  const recordById = new Map(policy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
  const executions: RuleExecution[] = gen.ownedRuleIds
    .map((id) => getRuleById(id))
    .filter((d): d is NonNullable<typeof d> => !!d && typeof d.checkProduct === 'function')
    .map((d) => executeRule(d, recordById.get(d.ruleId), collected, context));
  const rules = executions.map((x) => x.result);

  const coverageObservations = executions
    .filter((x) => policy.requiredRuleIds.includes(x.result.ruleId))
    .map(observationFor);

  const supportedSourceKinds = [...new Set(collected.files.map((f) => f.sourceKind))];
  const unsupportedSourceKinds = [...new Set(collected.discovered.filter((d) => d.outcome === 'unsupported').map((d) => d.sourceKind))];
  const measuredScope = [...new Set(executions
    .filter((x) => x.sufficientlyCovered && x.result.status !== 'inconclusive')
    .map((x) => getRuleById(x.result.ruleId)!.registryScope))];
  const runCoverage: RunCoverage = {
    inspectedFiles: collected.inspectedFiles,
    skippedFiles: collected.skippedFiles,
    supportedSourceKinds, unsupportedSourceKinds,
    measuredScope,
    unverifiedScope: gen.registryScope.filter((s) => !measuredScope.includes(s)),
  };

  const result = evaluateCleanPolicy({ validatorId, rules, coverageObservations, runCoverage }, policy);
  return { result, executions, coverageObservations, runCoverage };
}

export function makeProductValidator(validatorId: string) {
  return function validateProduct(context: unknown): ProductValidationResult {
    return runDetailed(validatorId, context).result;
  };
}

// Test seam: exposes the internal executions/observations/coverage so the pipeline
// suite can assert per-file execution and coverage WITHOUT duplicating the algorithm.
export function runValidatorForTest(validatorId: string, context: unknown): ValidatorRunDetail {
  return runDetailed(validatorId, context);
}
