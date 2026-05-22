"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowMemoryBuilder = void 0;
exports.formatFlowMemoryAsMarkdown = formatFlowMemoryAsMarkdown;
/**
 * Helper to build memory entries from flow execution
 */
class FlowMemoryBuilder {
    constructor(flowId, flowName) {
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
    addRule(domain, rules, violations) {
        this.entry.appliedRules.push({ domain, rules, violations });
        return this;
    }
    addDecision(decision, rationale, alternatives) {
        this.entry.userDecisions.push({ decision, rationale, alternatives });
        return this;
    }
    addMetric(name, value, status, target) {
        this.entry.metrics.push({ name, value, target, status });
        return this;
    }
    addValidation(check, result, details) {
        this.entry.validationResults.push({ check, result, details });
        return this;
    }
    addReference(system, resultCount, query) {
        this.entry.referencesUsed.push({ system, query, resultCount });
        return this;
    }
    addGate(name, required, passed, error) {
        this.entry.gates.push({ name, required, passed, error });
        return this;
    }
    addArtifact(type, count, consumedBy) {
        this.entry.artifactProduced.push({ type, count, consumed_by: consumedBy });
        return this;
    }
    setStatus(status) {
        this.entry.status = status;
        return this;
    }
    setSummary(summary) {
        this.entry.summary = summary;
        return this;
    }
    setNextSteps(steps) {
        this.entry.nextSteps = steps;
        return this;
    }
    setAiSlopDetection(categoryReflex, aestheticLane, antiReferencesRespected, score) {
        this.entry.aiSlopDetection = {
            categoryReflex,
            aestheticLaneChecked: aestheticLane,
            antiReferencesRespected,
            score,
        };
        return this;
    }
    build() {
        return this.entry;
    }
}
exports.FlowMemoryBuilder = FlowMemoryBuilder;
/**
 * Convert FlowMemoryEntry to session memory markdown format
 * Used for writing to ~/.claude/projects/.../memory/ files
 */
function formatFlowMemoryAsMarkdown(entry) {
    const lines = [];
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
        lines.push(`- Category reflex test: ${entry.aiSlopDetection.categoryReflex ? 'FAIL (palette guessable)' : 'PASS'}`);
        lines.push(`- Aesthetic lane: ${entry.aiSlopDetection.aestheticLaneChecked}`);
        lines.push(`- Anti-references respected: ${entry.aiSlopDetection.antiReferencesRespected ? 'YES' : 'NO'}`);
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
//# sourceMappingURL=flow-memory-schema.js.map