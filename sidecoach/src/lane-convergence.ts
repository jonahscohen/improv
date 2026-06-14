// sidecoach/src/lane-convergence.ts
// Pure loop-convergence logic (no IO). Consumed by lane-runner.ts's iteration
// boundary. REUSES the P4a ProductValidationResult and aggregateWorstStatus; does
// not re-implement clean evaluation.
import { createHash } from 'crypto';
import type { GateStatus, RequiredValidatorState, ConvergenceState, ConvergenceOutcome, ConvergenceIterationRecord } from './lane-types';
import type { ProductValidationResult, ProductValidationError, ProductValidationCoverage, ProductFinding, NormalizedErrorCategory } from './product-rule-types';
import { aggregateWorstStatus } from './lane-validators';

export const DEFAULT_LOOP_MAX_ITERATIONS = 10;
export const DEFAULT_LOOP_MAX_NO_PROGRESS = 3;

// Reduce one required validator's typed result to its stable identity tuple. Only
// canonical rule keys / gap identities / normalized categories - never free-text
// messages or stack traces (which would destabilize the signature).
export function toRequiredValidatorState(validatorId: string, result: ProductValidationResult): RequiredValidatorState {
  const rules = result.rules ?? [];
  const cov = result.coverage;
  return {
    validatorId,
    status: result.status as GateStatus,
    failedRuleIds: rules.filter((r) => r.status === 'fail').map((r) => r.canonicalRuleKey).sort(),
    inconclusiveRuleIds: rules.filter((r) => r.status === 'inconclusive').map((r) => r.canonicalRuleKey).sort(),
    coverageGapIdentities: [...new Set([
      ...(cov?.skippedFiles ?? []).map((p) => `skipped-file:${p}`),
      ...(cov?.unreadableFiles ?? []).map((p) => `unreadable-file:${p}`),
      ...(cov?.unsupportedFiles ?? []).map((p) => `unsupported-source-file:${p}`),
      ...(cov?.unsupportedSourceKinds ?? []).map((k) => `unsupported-source-kind:${k}`),
      ...(cov?.unverifiedScope ?? []).map((s) => `unverified-scope:${s}`),
    ])].sort(),
    validatorErrorCategory: result.status === 'error' ? (result as ProductValidationError).normalizedErrorCategory : undefined,
    ruleErrorCategories: rules.filter((r) => r.normalizedErrorCategory).map((r) => `${r.canonicalRuleKey}:${r.normalizedErrorCategory}`).sort(),
  };
}

// The required-state signature: a sha256-16 over the sorted per-validator tuples.
// Two boundaries with the same blocking state (in any validator order) hash equal,
// which is the no-progress signal stall detection watches for.
export function computeRequiredStateSignature(states: RequiredValidatorState[]): string {
  const sorted = [...states]
    .sort((a, b) => (a.validatorId < b.validatorId ? -1 : a.validatorId > b.validatorId ? 1 : 0))
    .map((s) => ({ v: s.validatorId, s: s.status, f: s.failedRuleIds, i: s.inconclusiveRuleIds, g: s.coverageGapIdentities, e: s.validatorErrorCategory ?? null, r: s.ruleErrorCategories }));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

export interface BoundaryEvaluation {
  perValidator: RequiredValidatorState[];
  iterationStatus: GateStatus;     // worst-of required validators
  converged: boolean;              // every required validator returned clean
  signature: string;
  findings: ProductFinding[];
  validatorErrors: { validatorId: string; category: NormalizedErrorCategory; message: string }[];
  requiredValidatorRuns: ConvergenceIterationRecord['requiredValidatorRuns'];
  runCoverage: ConvergenceState['runCoverage'];
  measuredScope: string[];         // convenience mirror of runCoverage.measuredScope (merged+sorted)
}

// Evaluate one iteration boundary from the required validators' typed results.
// Convergence requires EVERY required validator to be clean (honest convergence:
// never converge on findings/inconclusive/error).
export function evaluateBoundary(perValidator: { validatorId: string; result: ProductValidationResult }[]): BoundaryEvaluation {
  if (perValidator.length === 0) {
    throw new Error('evaluateBoundary: a convergence lane requires at least one required product validator');
  }
  const states = perValidator.map((p) => toRequiredValidatorState(p.validatorId, p.result));
  const iterationStatus = aggregateWorstStatus(states.map((s) => s.status));
  const converged = states.every((s) => s.status === 'clean');
  const signature = computeRequiredStateSignature(states);
  const findings = perValidator.flatMap((p) => p.result.findings ?? []);
  const validatorErrors = perValidator
    .filter((p) => p.result.status === 'error')
    .map((p) => ({ validatorId: p.validatorId, category: (p.result as ProductValidationError).normalizedErrorCategory, message: (p.result as ProductValidationError).error }));
  const requiredValidatorRuns = perValidator.map((p) => ({ validatorId: p.validatorId, status: p.result.status as GateStatus, coverage: p.result.coverage }));
  const runCoverage = aggregateActualRunCoverage(perValidator.map((p) => p.result));
  return { perValidator: states, iterationStatus, converged, signature, findings, validatorErrors, requiredValidatorRuns, runCoverage, measuredScope: runCoverage.measuredScope };
}

// Union + sort the ACTUAL coverage arrays carried on the results (never the
// generated registry declarations). notApplicableRuleIds is derived from actual rule
// statuses. File paths and source kinds stay as separate arrays so the truthful
// summary and the gap signature can name each distinctly.
function aggregateActualRunCoverage(results: ProductValidationResult[]): ConvergenceState['runCoverage'] {
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const cov = (sel: (c: ProductValidationCoverage) => string[] | undefined) =>
    uniq(results.flatMap((r) => sel(r.coverage) ?? []));
  const notApplicableRuleIds = uniq(results.flatMap((r) => (r.rules ?? []).filter((x) => x.status === 'not_applicable').map((x) => x.canonicalRuleKey)));
  return {
    discoveredFiles: cov((c) => c.discoveredFiles),
    inspectedFiles: cov((c) => c.inspectedFiles),
    skippedFiles: cov((c) => c.skippedFiles),
    unreadableFiles: cov((c) => c.unreadableFiles),
    unsupportedSourceKinds: cov((c) => c.unsupportedSourceKinds),
    unsupportedFiles: cov((c) => c.unsupportedFiles),
    measuredScope: cov((c) => c.measuredScope),
    unverifiedScope: cov((c) => c.unverifiedScope),
    notApplicableRuleIds,
  };
}

export interface ProgressDecision {
  outcome: ConvergenceOutcome;     // converged | running | stalled | capped
  consecutiveNoProgress: number;
  nextIteration: number;
}

// Decide the loop outcome after one boundary. Converged closes the lane (caller).
// Otherwise: count consecutive identical signatures (stall) and the next iteration
// index (cap). An errored/inconclusive iteration is treated like findings for
// progress - it cannot converge, but it stays resumable (running) until stall/cap.
export function decideProgress(prev: ConvergenceState, ev: BoundaryEvaluation): ProgressDecision {
  if (ev.converged) return { outcome: 'converged', consecutiveNoProgress: prev.consecutiveNoProgress, nextIteration: prev.iteration };
  const lastSig = prev.signatures.length ? prev.signatures[prev.signatures.length - 1] : undefined;
  const consecutiveNoProgress = lastSig === ev.signature ? prev.consecutiveNoProgress + 1 : 1;
  const nextIteration = prev.iteration + 1;
  let outcome: ConvergenceOutcome;
  if (consecutiveNoProgress >= prev.limits.maxNoProgress) outcome = 'stalled';
  else if (nextIteration >= prev.limits.maxIterations) outcome = 'capped';
  else outcome = 'running';
  return { outcome, consecutiveNoProgress, nextIteration };
}

export function seedConvergenceState(limits?: Partial<{ maxIterations: number; maxNoProgress: number }>): ConvergenceState {
  return {
    outcome: 'running', iteration: 0, signatures: [], consecutiveNoProgress: 0,
    limits: { maxIterations: limits?.maxIterations ?? DEFAULT_LOOP_MAX_ITERATIONS, maxNoProgress: limits?.maxNoProgress ?? DEFAULT_LOOP_MAX_NO_PROGRESS },
    history: [], findings: [], validatorErrors: [], advisoryRuns: [],
    runCoverage: { discoveredFiles: [], inspectedFiles: [], skippedFiles: [], unreadableFiles: [], unsupportedSourceKinds: [],
      unsupportedFiles: [], measuredScope: [], unverifiedScope: [], notApplicableRuleIds: [] },
  };
}
