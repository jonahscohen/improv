/**
 * QA gate resolver - the orchestrated multi-step design-review sequence.
 *
 * The QA gate is the ordered sequence a substantive UI change is put through
 * before it is called done: audit -> critique -> polish. Each stage is an
 * EXISTING sidecoach verb with its own flow chain; this module resolves the
 * sequence through the SAME `parseSlashCommand` the in-session orchestrator and
 * the CLI use, so the gate can never drift from the verb registry. It adds no
 * routing of its own - it composes three verbs into one reachable orchestration.
 *
 * WHY THIS EXISTS. `/sidecoach audit`, `critique`, and `polish` each resolve
 * individually, but nothing expressed the audit->critique->polish gate as one
 * reachable, testable unit. The on-edit auto-invoke hook
 * (claude/hooks/sidecoach-orchestrate-edit.sh) needs exactly that: a grounded,
 * ordered plan it can hand to the model so a design edit engages the full
 * orchestration rather than a single check. `bin/sidecoach-qa-plan.js` is the
 * thin CLI over this module that the hook and CI call.
 *
 * The order is the QA gate defined in CLAUDE.md's Design Work section:
 *   1. audit    - render + detection engine; Critical/High findings first
 *   2. critique - design-judgment layer (heuristics, personas, taste)
 *   3. polish   - final alignment pass, runs LAST
 */
import type { FlowId } from './types';
/** The QA gate verbs, in execution order. Source of truth for the sequence. */
export declare const QA_GATE_VERBS: readonly ["audit", "critique", "polish"];
export type QaGateVerb = (typeof QA_GATE_VERBS)[number];
export interface QaGateStep {
    /** 1-based position in the gate. */
    order: number;
    /** The verb this stage runs. */
    verb: QaGateVerb;
    /** The exact slash command a session runs to execute this stage. */
    slashCommand: string;
    /** The verb's resolved flow chain (from the shared router, in execution order). */
    flowIds: FlowId[];
    /** One-line description of the verb (from the verb registry). */
    description: string;
}
export interface QaGatePlan {
    /** The target the gate runs against (a file path, URL, or prose), or null. */
    target: string | null;
    steps: QaGateStep[];
}
/**
 * Resolve the audit -> critique -> polish QA gate for an optional target.
 *
 * Every stage is resolved through parseSlashCommand, so a stage that ever became
 * unroutable (verb dropped from the registry, router regression) throws HERE with
 * a named verb rather than silently yielding an empty plan the hook would hand to
 * the model as if it were a real orchestration. Fail-loud is deliberate: the whole
 * point of the gate is that it actually runs.
 */
export declare function resolveQaGate(target?: string): QaGatePlan;
/** Machine-readable plan (consumed by the on-edit hook and CI). */
export declare function qaGateToJson(plan: QaGatePlan): string;
/**
 * Human-readable ordered plan. Kept compact on purpose: this text is injected
 * into a hook's additionalContext, so it must read as a directive, not a report.
 */
export declare function renderQaGateText(plan: QaGatePlan): string;
//# sourceMappingURL=qa-gate.d.ts.map