/**
 * Flow Memory Schema
 *
 * Defines what each Sidecoach flow records to FlowHistory for session memory.
 * The record becomes the source of truth for design decisions and their rationale.
 *
 * Every flow's memory captures:
 * - Which design laws were applied
 * - User decisions made at checkpoints
 * - Metrics/measurements (e.g., color contrast ratio, font scale)
 * - Validation results (pass/fail/warning)
 * - References consulted
 * - Artifacts produced
 */

export interface FlowMemoryEntry {
  flowId: string;
  flowName: string;
  timestamp: string;
  status: 'success' | 'error' | 'skipped';

  // Design laws applied by this flow
  appliedRules: {
    domain: string; // typography, color, spatial, motion, interaction, responsive, writing
    rules: string[]; // specific rules applied, e.g., "8 typography rules", "4 motion rules"
    violations?: string[]; // any rules that were checked but violated
  }[];

  // User decisions & checkpoints
  userDecisions: {
    decision: string; // "Selected 'optimistic' brand personality"
    rationale?: string; // why this choice matters
    alternatives?: string[]; // what other options were available
  }[];

  // Measured outcomes
  metrics: {
    name: string; // "color-contrast-ratio", "font-scale-ratio", "line-length"
    value: number | string;
    target?: number | string; // expected/WCAG requirement
    status: 'pass' | 'warning' | 'fail';
  }[];

  // What was validated
  validationResults: {
    check: string; // "WCAG 2.1 AA compliance", "AI slop detection", "component state matrix"
    result: 'pass' | 'fail' | 'warning';
    details?: string;
  }[];

  // Reference systems consulted
  referencesUsed: {
    system: string; // component-gallery, fontshare, design-references, motion-reference
    query?: string; // what was searched for
    resultCount: number;
  }[];

  // Context requirements & gate results
  gates: {
    name: string; // "brand-verified", "design-tokens-exist", "project-has-product-md"
    required: boolean;
    passed: boolean;
    error?: string; // if failed, why
  }[];

  // Output artifacts and downstream impact
  artifactProduced: {
    type: string; // "font-candidates", "component-patterns", "easing-curves", "color-palette"
    count: number;
    consumed_by?: string[]; // flows that used this artifact
  }[];

  // AI slop detection results (if applicable)
  aiSlopDetection?: {
    categoryReflex: boolean; // is palette guessable from category?
    aestheticLaneChecked: string; // which design trend was assessed
    antiReferencesRespected: boolean;
    score: number; // 0-1, lower is better (less generic)
  };

  // Summary for session memory
  summary: string; // one-line summary of what happened
  nextSteps?: string[]; // what should happen next
}

/**
 * Helper to build memory entries from flow execution
 */
export class FlowMemoryBuilder {
  private entry: FlowMemoryEntry;

  constructor(flowId: string, flowName: string) {
    this.entry = {
      flowId,
      flowName,
      timestamp: new Date().toISOString(),
      status: 'success',
      appliedRules: [],
      userDecisions: [],
      metrics: [],
      validationResults: [],
      referencesUsed: [],
      gates: [],
      artifactProduced: [],
      summary: '',
    };
  }

  addRule(domain: string, rules: string[], violations?: string[]): this {
    this.entry.appliedRules.push({ domain, rules, violations });
    return this;
  }

  addDecision(decision: string, rationale?: string, alternatives?: string[]): this {
    this.entry.userDecisions.push({ decision, rationale, alternatives });
    return this;
  }

  addMetric(
    name: string,
    value: number | string,
    status: 'pass' | 'warning' | 'fail',
    target?: number | string
  ): this {
    this.entry.metrics.push({ name, value, target, status });
    return this;
  }

  addValidation(check: string, result: 'pass' | 'fail' | 'warning', details?: string): this {
    this.entry.validationResults.push({ check, result, details });
    return this;
  }

  addReference(system: string, resultCount: number, query?: string): this {
    this.entry.referencesUsed.push({ system, query, resultCount });
    return this;
  }

  addGate(name: string, required: boolean, passed: boolean, error?: string): this {
    this.entry.gates.push({ name, required, passed, error });
    return this;
  }

  addArtifact(type: string, count: number, consumedBy?: string[]): this {
    this.entry.artifactProduced.push({ type, count, consumed_by: consumedBy });
    return this;
  }

  setStatus(status: 'success' | 'error' | 'skipped'): this {
    this.entry.status = status;
    return this;
  }

  setSummary(summary: string): this {
    this.entry.summary = summary;
    return this;
  }

  setNextSteps(steps: string[]): this {
    this.entry.nextSteps = steps;
    return this;
  }

  setAiSlopDetection(
    categoryReflex: boolean,
    aestheticLane: string,
    antiReferencesRespected: boolean,
    score: number
  ): this {
    this.entry.aiSlopDetection = {
      categoryReflex,
      aestheticLaneChecked: aestheticLane,
      antiReferencesRespected,
      score,
    };
    return this;
  }

  build(): FlowMemoryEntry {
    return this.entry;
  }
}

/**
 * Convert FlowMemoryEntry to session memory markdown format
 * Used for writing to ~/.claude/projects/.../memory/ files
 */
export function formatFlowMemoryAsMarkdown(entry: FlowMemoryEntry): string {
  const lines: string[] = [];

  lines.push(`## ${entry.flowName} (${entry.flowId})`);
  lines.push(`**Status**: ${entry.status.toUpperCase()}`);
  lines.push(`**Time**: ${entry.timestamp}`);
  lines.push('');

  // Summary
  lines.push('**Summary**: ' + entry.summary);
  lines.push('');

  // Applied rules
  if (entry.appliedRules.length > 0) {
    lines.push('**Design Laws Applied**:');
    entry.appliedRules.forEach((rule) => {
      lines.push(`- ${rule.domain}: ${rule.rules.join(', ')}`);
      if (rule.violations?.length) {
        lines.push(`  - Violations: ${rule.violations.join(', ')}`);
      }
    });
    lines.push('');
  }

  // User decisions
  if (entry.userDecisions.length > 0) {
    lines.push('**User Decisions**:');
    entry.userDecisions.forEach((decision) => {
      lines.push(`- ${decision.decision}`);
      if (decision.rationale) {
        lines.push(`  - Why: ${decision.rationale}`);
      }
      if (decision.alternatives?.length) {
        lines.push(`  - Alternatives: ${decision.alternatives.join(', ')}`);
      }
    });
    lines.push('');
  }

  // Metrics
  if (entry.metrics.length > 0) {
    lines.push('**Measurements**:');
    entry.metrics.forEach((metric) => {
      const target = metric.target ? ` (target: ${metric.target})` : '';
      lines.push(`- ${metric.name}: ${metric.value}${target} = ${metric.status}`);
    });
    lines.push('');
  }

  // Validations
  if (entry.validationResults.length > 0) {
    lines.push('**Validation Results**:');
    entry.validationResults.forEach((v) => {
      const status = v.result === 'pass' ? 'OK' : v.result === 'fail' ? 'FAIL' : 'WARN';
      const details = v.details ? ` - ${v.details}` : '';
      lines.push(`- [${status}] ${v.check}${details}`);
    });
    lines.push('');
  }

  // References
  if (entry.referencesUsed.length > 0) {
    lines.push('**References Consulted**:');
    entry.referencesUsed.forEach((ref) => {
      const query = ref.query ? ` (${ref.query})` : '';
      lines.push(`- ${ref.system}${query}: ${ref.resultCount} results`);
    });
    lines.push('');
  }

  // Gates
  if (entry.gates.length > 0) {
    const failedGates = entry.gates.filter((g) => !g.passed);
    if (failedGates.length > 0) {
      lines.push('**Gate Failures**:');
      failedGates.forEach((gate) => {
        lines.push(`- ${gate.name}: ${gate.error}`);
      });
      lines.push('');
    }
  }

  // Artifacts
  if (entry.artifactProduced.length > 0) {
    lines.push('**Artifacts Produced**:');
    entry.artifactProduced.forEach((artifact) => {
      const consumed = artifact.consumed_by ? ` (feeds: ${artifact.consumed_by.join(', ')})` : '';
      lines.push(`- ${artifact.type}: ${artifact.count}${consumed}`);
    });
    lines.push('');
  }

  // AI slop detection
  if (entry.aiSlopDetection) {
    lines.push('**AI Slop Detection**:');
    lines.push(
      `- Category reflex test: ${entry.aiSlopDetection.categoryReflex ? 'FAIL (palette guessable)' : 'PASS'}`
    );
    lines.push(`- Aesthetic lane: ${entry.aiSlopDetection.aestheticLaneChecked}`);
    lines.push(
      `- Anti-references respected: ${entry.aiSlopDetection.antiReferencesRespected ? 'YES' : 'NO'}`
    );
    lines.push(`- Genericity score: ${(entry.aiSlopDetection.score * 100).toFixed(1)}% generic`);
    lines.push('');
  }

  // Next steps
  if (entry.nextSteps?.length) {
    lines.push('**Next Steps**:');
    entry.nextSteps.forEach((step) => {
      lines.push(`- ${step}`);
    });
  }

  return lines.join('\n');
}
