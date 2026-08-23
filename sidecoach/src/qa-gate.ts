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
import { parseSlashCommand } from './slash-command-router';
import { getVerbEntry } from './verb-command-registry';

/** The QA gate verbs, in execution order. Source of truth for the sequence. */
export const QA_GATE_VERBS = ['audit', 'critique', 'polish'] as const;

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
export function resolveQaGate(target?: string): QaGatePlan {
  const cleanTarget = (target ?? '').trim();
  const steps: QaGateStep[] = QA_GATE_VERBS.map((verb, i) => {
    const slashCommand = `/sidecoach ${verb}${cleanTarget ? ` ${cleanTarget}` : ''}`;
    const match = parseSlashCommand(slashCommand);
    if (!match.isCommand) {
      throw new Error(
        `QA gate stage "${verb}" did not resolve to a command (${match.reason}). ` +
          `The gate cannot be handed to the orchestrator with an unroutable stage.`,
      );
    }
    if (!match.flowIds || match.flowIds.length === 0) {
      throw new Error(
        `QA gate stage "${verb}" resolved to an EMPTY flow chain. A stage that runs ` +
          `nothing is not a real orchestration step.`,
      );
    }
    const entry = getVerbEntry(verb);
    return {
      order: i + 1,
      verb,
      slashCommand,
      flowIds: match.flowIds,
      description: entry ? entry.description : '',
    };
  });
  return { target: cleanTarget || null, steps };
}

/** Machine-readable plan (consumed by the on-edit hook and CI). */
export function qaGateToJson(plan: QaGatePlan): string {
  return JSON.stringify(
    {
      tool: 'sidecoach',
      command: 'qa-plan',
      gate: 'audit->critique->polish',
      target: plan.target,
      steps: plan.steps,
    },
    null,
    2,
  );
}

/**
 * Human-readable ordered plan. Kept compact on purpose: this text is injected
 * into a hook's additionalContext, so it must read as a directive, not a report.
 */
export function renderQaGateText(plan: QaGatePlan): string {
  const lines: string[] = [];
  const t = plan.target ? ` ${plan.target}` : '';
  lines.push(`Sidecoach QA gate (audit -> critique -> polish)${plan.target ? ` for ${plan.target}` : ''}:`);
  for (const step of plan.steps) {
    lines.push(`  ${step.order}. ${step.slashCommand}  [${step.flowIds.join(' -> ')}]`);
  }
  lines.push(`Run the three in order to completion; do not stop after audit.`);
  return lines.join('\n');
}
