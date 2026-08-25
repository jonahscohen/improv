// Sidecoach panel view-model + assembler.
// Pure - no I/O. Turns the real run data (flow results + BuildReport + a little
// routing context) into the compact view-model the panel renderer formats. This
// is the data behind the "sidecoach . multi-lens audit" card from the marketing
// demo (marketing-site/demo.js .scd-sc), now driven by a real run.

import { FlowExecutionResult } from './flow-handler';
import { BuildReport, LetterGrade } from './build-report-types';

export interface PanelGate {
  name: string;
  ok: boolean | null; // null = gate has not run yet (progressive snapshot)
}

export interface PanelChecklistItem {
  label: string;
  done: boolean;
}

// GREEN MEANS CHECKED (honesty line). A coverage classification DERIVED from the existing verdict/
// gate - never a new verdict state. 'verified-clean' is the only certified pass and demands positive
// evidence a COMPLETE run ACTUALLY RAN (validators present and run / both lenses available) and found
// nothing; 'checked' ran fully and found findings; 'partially-checked' scanned but a lens/check did
// not run (incomplete coverage); 'not-fully-checked' is the downgrade for a run that cannot be
// certified at all (inconclusive/error gate, zero validators, or an in-progress snapshot). A run that
// measured nothing carries no verdict, so it gets no coverage (undefined) and the card makes no claim
// at all - its `notice` states that instead.
export type PanelCoverage = 'verified-clean' | 'checked' | 'partially-checked' | 'not-fully-checked';

// A terminal verdict maps to a coverage banner; an absent verdict (in-progress or measured-nothing)
// maps to undefined, so the card shows no coverage claim until there is a real one to make. This is
// the FULL-COVERAGE mapping only - callers downgrade to 'not-fully-checked' when a run is partial or
// its gate was inconclusive/error (see assemblePanelModel and laneStepToPanelModel).
export function coverageForVerdict(verdict?: 'clean' | 'warnings-only' | 'blocked'): PanelCoverage | undefined {
  if (!verdict) return undefined;
  return verdict === 'clean' ? 'verified-clean' : 'checked';
}

export interface SidecoachPanelModel {
  verb?: string; // the verb/phase the user invoked, if any (header subtitle)
  flowName: string; // headline flow human name, e.g. "Multi-Lens Audit"
  flowId: string; // e.g. "flowK_multi_lens_audit"
  confidence?: number; // routing confidence 0..1 (omitted from render when absent)
  chain: string[]; // ordered flow chain, e.g. ["brand verify","multi-lens audit","design critique"]
  checklist: PanelChecklistItem[]; // one row per chain phase (or finer items), with done state
  dims?: string[]; // sub-dimensions of the headline phase (e.g. accessibility, performance, ...)
  gates: PanelGate[]; // QA gates: taste / claudemd / polish
  verdict?: 'clean' | 'warnings-only' | 'blocked';
  grade?: LetterGrade;
  findings?: number; // blocking + warning count (info excluded, matching the report)
  partial: boolean; // true = in-progress snapshot (some rows still pending)
  // Loud, unmissable line printed ABOVE everything when this run measured nothing.
  // Codex review 2026-07-28 (d): dropping the verdict stopped the panel ASSERTING a false
  // clean, but a reader still saw a full checklist of [done] phases including "multi-lens
  // audit" with no hint that no page was opened, so a clean read was still INFERABLE. The
  // notice removes the inference.
  notice?: string;
  // Whether the clean/quiet card is a CERTIFIED pass ('verified-clean'), a complete run that carries
  // findings ('checked'), or an incomplete/partial/inconclusive run that cannot be certified
  // ('not-fully-checked'). Undefined when the run measured nothing - the card then makes no coverage
  // claim at all (its `notice` states that instead).
  coverage?: PanelCoverage;
}

// The three QA gates the panel shows, matched against BuildReport findings by a
// substring of the finding's source / rule / flowId. A gate is "failed" when a
// blocking-or-warning finding is attributed to it.
const GATE_DEFS: { name: string; match: RegExp }[] = [
  { name: 'taste', match: /taste/i },
  { name: 'claudemd', match: /claude\.?md|clausemd|mandate/i },
  { name: 'polish', match: /polish/i },
];

// "Multi-Lens Audit (5 dimensions)" -> "multi-lens audit". With only an id, derive
// a readable label: "flowK_multi_lens_audit" -> "multi lens audit".
export function shortFlowLabel(flowName: string, flowId: string): string {
  if (flowName && flowName !== flowId) {
    return flowName.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
  }
  const fromId = String(flowId).replace(/^flow[a-z0-9]+_/i, '').replace(/_/g, ' ').trim().toLowerCase();
  return fromId || String(flowId);
}

export interface AssemblePanelInput {
  flowResults: FlowExecutionResult[];
  report?: BuildReport; // present once the run has produced a verdict
  verb?: string;
  confidence?: number;
  dims?: string[];
  /** Headline flow id; defaults to the last flow in the chain (usually the audit/critique). */
  headlineFlowId?: string;
  /** Force the partial flag; defaults to "no report yet". */
  partial?: boolean;
  /**
   * The underlying rendered audit could not scan every lens (a detection lens did not run), so its
   * coverage is INCOMPLETE even though it produced a verdict. Codex 2026-08-25 (Med): the panel is
   * built from the BuildReport alone and cannot see audit.unavailableReasons, so a partial audit was
   * rendering an unqualified CHECKED. When set, the panel downgrades to 'partially-checked'. The
   * orchestrator passes `audit.unavailableReasons.length > 0` here for a rendered audit.
   */
  auditPartial?: boolean;
  /** Whether the QA gates have executed; when false (and no report), gates render as pending. */
  ranGates?: boolean;
  /** Loud line printed above the card when this run measured nothing (see model.notice). */
  notice?: string;
}

export function assemblePanelModel(input: AssemblePanelInput): SidecoachPanelModel {
  const { flowResults, report } = input;

  const headline = input.headlineFlowId
    ? flowResults.find((r) => String(r.flowId) === input.headlineFlowId)
    : flowResults[flowResults.length - 1];
  const flowName = headline ? headline.flowName : report?.composite ?? 'sidecoach';
  const flowId = headline ? String(headline.flowId) : report?.composite ?? '';

  const chain = flowResults.map((r) => shortFlowLabel(r.flowName, String(r.flowId)));
  const checklist: PanelChecklistItem[] = flowResults.map((r) => ({
    label: shortFlowLabel(r.flowName, String(r.flowId)),
    done: r.status === 'success' || r.status === 'skipped',
  }));

  // Dims: explicit wins; otherwise use the headline flow's own checklist labels.
  let dims = input.dims;
  if (!dims && headline && Array.isArray(headline.checklist) && headline.checklist.length > 0) {
    dims = headline.checklist.map((c) => c.label);
  }

  const findings = report ? report.severityCounts.blocking + report.severityCounts.warning : undefined;

  const gates: PanelGate[] = GATE_DEFS.map((g) => {
    if (report) {
      const hit = report.findings.some(
        (f) =>
          f.severity !== 'info' &&
          (g.match.test(f.source) || g.match.test(f.rule) || g.match.test(String(f.flowId))),
      );
      return { name: g.name, ok: !hit };
    }
    return { name: g.name, ok: input.ranGates ? true : null };
  });

  // Codex 2026-08-25: coverage must never certify without positive evidence of a COMPLETE run.
  //  - auditPartial (Med): a rendered audit that scanned but a lens did not run -> 'partially-checked'
  //    (incomplete coverage, never an unqualified CHECKED), even when it produced findings.
  //  - forced/partial snapshot (Med): an INCOMPLETE snapshot with a clean verdict is not proof both
  //    lenses ran clean -> 'not-fully-checked', never 'verified-clean'.
  //  - a run with no verdict at all makes no claim (undefined).
  const isPartial = input.partial ?? !report;
  let coverage: PanelCoverage | undefined;
  if (input.auditPartial && report?.verdict) {
    coverage = 'partially-checked';
  } else if (isPartial) {
    coverage = report?.verdict ? 'not-fully-checked' : undefined;
  } else {
    coverage = coverageForVerdict(report?.verdict);
  }

  return {
    verb: input.verb,
    flowName,
    flowId,
    confidence: input.confidence,
    chain,
    checklist,
    dims,
    gates,
    verdict: report?.verdict,
    grade: report?.overallGrade,
    findings,
    partial: isPartial,
    notice: input.notice,
    coverage,
  };
}

// Progressive snapshot from a lane step result (LaneStepResult-like). The lane
// step carries the verb, flow ids, and an aggregated checklist (per-flow items
// keyed "<flowId>:<itemId>") but no verdict yet - so this is always a partial
// card: route/flow/checklist building up, gates pending, no verdict. The final
// verdict card comes from the run's BuildReport via assemblePanelModel.
export interface LaneStepLike {
  currentVerb?: string;
  flowIds: Array<string | { toString(): string }>;
  checklist: { id: string; label: string; completed: boolean }[];
  // Present on a terminal/complete lane step that ran product validators.
  gate?: { status?: string; validators?: { validatorId: string; status: string }[]; findings?: unknown[] } | null;
  convergence?: { findings?: unknown[] } | null;
}

export function laneStepToPanelModel(step: LaneStepLike): SidecoachPanelModel {
  const ids = (step.flowIds || []).map((x) => String(x));
  const chain = ids.map((id) => shortFlowLabel('', id));
  const checklist: PanelChecklistItem[] = ids.map((id) => {
    const items = (step.checklist || []).filter((c) => c.id === id || c.id.startsWith(`${id}:`));
    return { label: shortFlowLabel('', id), done: items.length > 0 && items.every((c) => c.completed) };
  });

  const g = step.gate;
  let gates: PanelGate[];
  let verdict: SidecoachPanelModel['verdict'];
  let findings: number | undefined;
  let coverage: PanelCoverage | undefined;
  if (g && Array.isArray(g.validators)) {
    gates = GATE_DEFS.map((def) => {
      const v = g.validators!.find((x) => def.match.test(x.validatorId));
      return { name: def.name, ok: v ? v.status === 'pass' : null };
    });
    // GateStatus is clean|findings|inconclusive|error (lane-types.ts). Codex 2026-08-25: VERIFIED
    // CLEAN requires positive evidence that checks ACTUALLY RAN and found nothing.
    //  - (High) an inconclusive OR error gate did NOT complete a check -> no verdict, 'not-fully-checked'.
    //  - (High) a 'clean' gate with ZERO validators ran NOTHING (e.g. `shape` -> flowA_brand_verify has
    //    no product validators; the lane aggregates an empty list as 'clean'). An empty run is "nothing
    //    was measured", never verified-clean -> no verdict, 'not-fully-checked'. verified-clean demands
    //    validators.length > 0 AND all clean. Err toward not certifying.
    const gateStatus = String(g.status || '');
    if (gateStatus === 'inconclusive' || gateStatus === 'error' || g.validators.length === 0) {
      verdict = undefined;
      coverage = 'not-fully-checked';
    } else {
      const anyFail = g.validators.some((v) => /fail|error|inconclusive/i.test(v.status));
      verdict = gateStatus === 'pass' || gateStatus === 'clean' ? 'clean' : anyFail ? 'blocked' : 'warnings-only';
      coverage = coverageForVerdict(verdict);
    }
    findings = Array.isArray(g.findings)
      ? g.findings.length
      : Array.isArray(step.convergence?.findings)
        ? step.convergence!.findings!.length
        : undefined;
  } else {
    gates = GATE_DEFS.map((def) => ({ name: def.name, ok: null }));
  }

  return {
    verb: step.currentVerb,
    flowName: ids.length > 0 ? shortFlowLabel('', ids[0]) : 'sidecoach',
    flowId: ids.length > 0 ? ids[ids.length - 1] : '',
    chain,
    checklist,
    gates,
    verdict,
    findings,
    partial: !g,
    coverage,
  };
}
