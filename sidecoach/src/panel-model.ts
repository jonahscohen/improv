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
  /** Whether the QA gates have executed; when false (and no report), gates render as pending. */
  ranGates?: boolean;
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
    partial: input.partial ?? !report,
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
  if (g && Array.isArray(g.validators)) {
    gates = GATE_DEFS.map((def) => {
      const v = g.validators!.find((x) => def.match.test(x.validatorId));
      return { name: def.name, ok: v ? v.status === 'pass' : null };
    });
    const anyFail = g.validators.some((v) => /fail|error/i.test(v.status));
    verdict = g.status === 'pass' ? 'clean' : anyFail ? 'blocked' : 'warnings-only';
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
  };
}
