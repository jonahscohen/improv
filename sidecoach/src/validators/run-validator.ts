// sidecoach/src/validators/run-validator.ts
//
// makeProductValidator(validatorId) -> (context) => ProductValidationResult. Reads
// the validator's GENERATED cleanPolicy/ownedRuleIds, collects a project, executes
// file-scoped rules once per APPLICABLE file (and project-scoped rules once over the
// assembled shape), builds truthful CoverageObservations + evidence-derived
// RunCoverage, and calls the P4a-1 evaluateCleanPolicy (never re-implements it).
import type {
  ProductValidationResult, ProductRuleResult, ProductRuleDefinition, RequiredCoverageRecord,
  RuleStatus, NormalizedErrorCategory, CleanPolicy, EvidenceKind,
} from '../product-rule-types';
import { isStaticallySatisfiable, sourceKindsForEvidence } from '../product-rule-types';
import { getRuleById } from '../product-rule-registry';
import { GENERATED_VALIDATORS } from '../validators.generated';
import { evaluateCleanPolicy, isCoverageSatisfied } from '../clean-evaluator';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import { collect, CollectionAbortedError } from './project-collector';
import type { Collected } from './project-collector';
import { stampResult, inconclusive } from './check-context';
import type { ProductCheckContext, CollectedFile } from './check-context';
import { collectBrowserEvidence, renderUrlFromContext } from './browser-evidence-collector';
import type { BrowserEvidenceCollection } from './browser-evidence-collector';
import { scanRenderedLive } from './rendered-live-scan';
import type { RenderedScanCollection } from './rendered-live-scan';

function toCheckContext(c: Collected, raw: unknown, browser?: BrowserEvidenceCollection, rendered?: RenderedScanCollection): ProductCheckContext {
  const r = raw as Partial<ProductCheckContext>;
  const e = browser?.available ? browser.evidence : undefined;
  return {
    cssText: c.cssText, markup: c.markup, files: c.files, discoveredFiles: c.discovered,
    renderUrl: renderUrlFromContext(raw),
    browserEvidence: e?.browserEvidence,
    computedStyle: e?.computedStyle ?? r?.computedStyle,
    dom: e?.dom ?? r?.dom,
    contrast: e?.contrast ?? r?.contrast,
    designTokens: r?.designTokens, tasteOptions: r?.tasteOptions,
    renderedScan: rendered ?? r?.renderedScan,
  };
}

// Per-run browser dependency seam: production uses the real collector; tests inject
// a deterministic one. Absent -> the real collectBrowserEvidence (which itself
// degrades to available:false when there is no render URL or no launchable Chromium).
export interface ValidatorRuntimeDeps {
  collectBrowserEvidence?: (renderUrl: string | undefined, signal?: AbortSignal) => Promise<BrowserEvidenceCollection>;
  // Per-run seam mirroring collectBrowserEvidence: production uses the real live scanner; tests inject a
  // deterministic one. Absent -> the real scanRenderedLive (which degrades to {available:false} without a
  // renderUrl or launchable Chromium).
  scanRenderedLive?: (renderUrl: string | undefined, signal?: AbortSignal) => Promise<RenderedScanCollection>;
}

// Promote ONLY the generated browserRuleIds whose evidence requirements are ALL
// present in the collected evidence kinds. Failed/absent collection -> kinds empty
// -> nothing promoted -> the static cleanPolicy is the safe baseline. Browser rules
// still execute (surfacing inconclusive) because they are owned, not because they
// are required.
function activateBrowserPolicy(
  base: CleanPolicy,
  gen: typeof GENERATED_VALIDATORS[number],
  kinds: EvidenceKind[],
): CleanPolicy {
  const present = new Set(kinds);
  const promoted = gen.browserRuleIds.filter((id) => {
    const def = getRuleById(id);
    return !!def && def.evidenceRequirements.every((kind) => present.has(kind));
  });
  return {
    ...base,
    requiredRuleIds: [...base.requiredRuleIds, ...promoted],
    requiredCoverageByScope: [
      ...base.requiredCoverageByScope,
      ...gen.browserCoverageByScope.filter((c) => promoted.includes(c.ruleId)),
    ],
  };
}

// Rendered-scan promotion (parallel to activateBrowserPolicy, but the gate is renderUrl-PRESENCE, not
// scan-success). When a renderUrl is present a live scan is EXPECTED, so every rendered rule is promoted to
// required: a successful scan yields pass/fail; an UNAVAILABLE scan makes the rule's check return inconclusive,
// and required+inconclusive blocks clean (the fail-closed contract - a render we tried and could not read must
// never report clean). When there is NO renderUrl, rendered rules stay owned-but-non-required (dormant), exactly
// like browser rules with no evidence, so the established no-render behavior is preserved (detection-preserving).
function activateRenderedPolicy(
  base: CleanPolicy,
  gen: typeof GENERATED_VALIDATORS[number],
  hasRenderUrl: boolean,
): CleanPolicy {
  if (!hasRenderUrl || gen.renderedRuleIds.length === 0) return base;
  return {
    ...base,
    requiredRuleIds: [...base.requiredRuleIds, ...gen.renderedRuleIds],
    requiredCoverageByScope: [...base.requiredCoverageByScope, ...gen.renderedCoverageByScope],
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
async function executeRule(
  def: ProductRuleDefinition,
  record: RequiredCoverageRecord | undefined,
  collected: Collected,
  raw: unknown,
  signal?: AbortSignal,
  browser?: BrowserEvidenceCollection,
  rendered?: RenderedScanCollection,
): Promise<RuleExecution> {
  if (signal?.aborted) throw new AbortSentinel();
  const reqKind = def.evidenceRequirements[0];

  if (!isStaticallySatisfiable(def.evidenceRequirements)) {
    // computed-style/dom/contrast/rendered-scan: no static source can satisfy this. With trusted evidence the
    // check produces a real verdict over the render-URL target; without it the check returns its honest
    // inconclusive. The evidence channel that satisfies THIS rule is rendered-scan (the live scan ran) or the
    // browser collector (dom/contrast/computed-style) - inspected coverage tracks the matching channel so a
    // rendered rule whose browser collection failed is still counted covered when its scan ran (and vice versa).
    const result = def.checkProduct!(toCheckContext(collected, raw, browser, rendered)) as ProductRuleResult;
    const renderUrl = renderUrlFromContext(raw);
    // Evidence "present for THIS rule": a rendered-scan rule's family produced a verdict iff the check did NOT
    // return inconclusive (the rendered checks return inconclusive ONLY when their own family scan is
    // unavailable). Keying coverage on the per-rule result - not on a coarse objective||subjective availability -
    // is precise when one family failed and the other succeeded (Codex P2). Browser rules key on the collector.
    const evidenceAvailable = reqKind === 'rendered-scan'
      ? result.status !== 'inconclusive'
      : (browser?.available ?? false);
    const kinds = reqKind === 'rendered-scan'
      ? (evidenceAvailable ? ['rendered-scan'] : [])
      : (browser?.available ? browser.evidence.browserEvidence.kinds : []);
    const discoveredApplicableFiles = renderUrl ? [{ file: renderUrl, evidenceKindsPresent: kinds }] : [];
    const inspectedApplicableFiles = evidenceAvailable && renderUrl ? [renderUrl] : [];
    const exec: RuleExecution = { result, discoveredApplicableFiles, inspectedApplicableFiles, sufficientlyCovered: false };
    exec.sufficientlyCovered = result.status !== 'inconclusive' && isCoverageSatisfied(record, observationFor(exec));
    return exec;
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
      // Cooperatively yield BETWEEN FILES so the heartbeat timer can fire and an abort is
      // observed promptly even within a single rule scanning many files.
      if (signal?.aborted) throw new AbortSentinel();
      await yieldToEventLoop();
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
  activePolicy: CleanPolicy;
}

// The safe empty policy used for early error/abort detail returns when no generated
// static policy is available (e.g. unknown validator id).
const EMPTY_POLICY: CleanPolicy = {
  requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {},
  requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report',
};

function emptyRun(): RunCoverage {
  return { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [], measuredScope: [], unverifiedScope: [],
    discoveredFiles: [], unreadableFiles: [], unsupportedFiles: [] };
}

// Cooperative yield to the EVENT LOOP (a macrotask, not a microtask): returns control
// so setInterval timers - notably the lease heartbeat - can fire between files/rules. A
// microtask (Promise.resolve) would NOT let timers run; setImmediate does.
function yieldToEventLoop(): Promise<void> { return new Promise((r) => setImmediate(r)); }

async function runDetailed(
  validatorId: string,
  context: unknown,
  signal?: AbortSignal,
  deps: ValidatorRuntimeDeps = {},
): Promise<ValidatorRunDetail> {
  const gen = GENERATED_VALIDATORS.find((v) => v.validatorId === validatorId);
  const policy = gen?.cleanPolicy;
  if (!gen || !policy) {
    const result = evaluateCleanPolicy(
      { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
        validatorError: { category: 'registry_fault', message: `no generated validator for ${validatorId}` } },
      EMPTY_POLICY,
    );
    return { result, executions: [], coverageObservations: [], runCoverage: emptyRun(), activePolicy: EMPTY_POLICY };
  }

  let collected: Collected;
  try { collected = await collect(context, signal); }
  catch (e) {
    if (e instanceof CollectionAbortedError) return abortedDetail(validatorId, policy);  // aborted DURING collection
    const result = evaluateCleanPolicy(
      { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
        validatorError: { category: 'unreadable_input', message: String(e instanceof Error ? e.message : e) } },
      policy,
    );
    return { result, executions: [], coverageObservations: [], runCoverage: emptyRun(), activePolicy: policy };
  }

  if (signal?.aborted) return abortedDetail(validatorId, policy);

  // Collect browser evidence ONCE for this target, then build the per-target active
  // policy: successful collection promotes the browser rules whose evidence is present;
  // failed/absent collection promotes none (static cleanPolicy stays the baseline).
  const renderUrl = renderUrlFromContext(context);
  const browser = await (deps.collectBrowserEvidence ?? collectBrowserEvidence)(renderUrl, signal);
  if (signal?.aborted) return abortedDetail(validatorId, policy);
  // ONE live rendered scan per target (objective + subjective), resolved BEFORE any rendered-scan rule runs so
  // checkProduct reads it synchronously and never launches its own browser (Codex P0-4). Fail-closed inside.
  const rendered = await (deps.scanRenderedLive ?? scanRenderedLive)(renderUrl, signal);
  if (signal?.aborted) return abortedDetail(validatorId, policy);
  const activePolicy = activateRenderedPolicy(
    activateBrowserPolicy(policy, gen, browser.available ? browser.evidence.browserEvidence.kinds : []),
    gen, !!renderUrl);

  const recordById = new Map(activePolicy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
  const defs = gen.ownedRuleIds
    .map((id) => getRuleById(id))
    .filter((d): d is NonNullable<typeof d> => !!d && typeof d.checkProduct === 'function');
  const executions: RuleExecution[] = [];
  try {
    for (const d of defs) {
      // Cooperatively yield BETWEEN RULES so the heartbeat keeps firing and abort is
      // observed promptly across a long synchronous validator run.
      if (signal?.aborted) return abortedDetail(validatorId, policy);
      await yieldToEventLoop();
      executions.push(await executeRule(d, recordById.get(d.ruleId), collected, context, signal, browser, rendered));
    }
  } catch (e) {
    if (e instanceof AbortSentinel) return abortedDetail(validatorId, policy);
    throw e;
  }
  const rules = executions.map((x) => x.result);

  const coverageObservations = executions
    .filter((x) => activePolicy.requiredRuleIds.includes(x.result.ruleId))
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
    // P4c stable file identities (from the collector result, not registry prose).
    discoveredFiles: collected.discovered.map((d) => d.path),
    unreadableFiles: collected.unreadableFiles,
    unsupportedFiles: collected.unsupportedFiles,
  };

  const result = evaluateCleanPolicy({ validatorId, rules, coverageObservations, runCoverage }, activePolicy);
  return { result, executions, coverageObservations, runCoverage, activePolicy };
}

export function makeProductValidator(validatorId: string) {
  // The public entry is ASYNC with cooperative abort: it checks the signal at entry,
  // yields so an abort fired during this tick is observed, then runs the cooperatively
  // async core (runDetailed), which yields + re-checks the signal between files and rules
  // so a long run cannot block the heartbeat / delay abort.
  return async function validateProduct(context: unknown, signal?: AbortSignal): Promise<ProductValidationResult> {
    if (signal?.aborted) return abortedResult(validatorId);
    await Promise.resolve();
    if (signal?.aborted) return abortedResult(validatorId);
    return (await runDetailed(validatorId, context, signal)).result;
  };
}

// An aborted validator run maps to a validator-level error (category 'aborted') - the
// same shape the lease protocol expects when ownership is lost mid-execute.
function abortedResult(validatorId: string): ProductValidationResult {
  return evaluateCleanPolicy(
    { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
      validatorError: { category: 'aborted', message: 'validation aborted (lease lost / cancelled)' } },
    { requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {}, requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report' },
  );
}
function abortedDetail(validatorId: string, policy?: CleanPolicy): ValidatorRunDetail {
  return { result: abortedResult(validatorId), executions: [], coverageObservations: [], runCoverage: emptyRun(), activePolicy: policy ?? EMPTY_POLICY };
}

// Sentinel thrown by the per-rule abort check inside runDetailed's execution loop.
class AbortSentinel extends Error {}

// Test seam: exposes the internal executions/observations/coverage so the pipeline
// suite can assert per-file execution and coverage WITHOUT duplicating the algorithm.
// Async now that runDetailed yields cooperatively.
export function runValidatorForTest(validatorId: string, context: unknown, deps: ValidatorRuntimeDeps = {}): Promise<ValidatorRunDetail> {
  return runDetailed(validatorId, context, undefined, deps);
}
