"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionMemoryWriter = void 0;
exports.persistSessionMemory = persistSessionMemory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const flow_history_1 = require("./flow-history");
/**
 * SessionMemoryWriter
 *
 * Writes accumulated flow history to persistent session memory files.
 * Location: ~/.claude/projects/<project-path>/memory/session_YYYY-MM-DD_sidecoach.md
 *
 * Called at session end or explicitly to create a permanent record of:
 * - All flows executed
 * - Design decisions made at each step
 * - Rules applied, metrics measured, validations passed
 * - References consulted, artifacts produced
 */
class SessionMemoryWriter {
    constructor(projectPath) {
        this.projectPath = projectPath || process.cwd();
        this.memoryDir = path.join(this.projectPath, '.claude', 'memory');
    }
    /**
     * Write session flow history to permanent memory file
     * Returns the path of the written file
     */
    writeSessionMemory() {
        const flowHistory = (0, flow_history_1.getFlowHistory)();
        const flows = flowHistory.getFlowSequence();
        if (flows.length === 0) {
            return ''; // Nothing to write
        }
        // Create memory directory if it doesn't exist
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
        // Generate filename: session_YYYY-MM-DD_sidecoach.md
        const today = new Date().toISOString().split('T')[0];
        const filename = `session_${today}_sidecoach.md`;
        const filepath = path.join(this.memoryDir, filename);
        // Build markdown content
        const content = this.buildSessionMemory(flows);
        // Write to file
        fs.writeFileSync(filepath, content, 'utf-8');
        // Update MEMORY.md index if it exists
        this.updateMemoryIndex(filename);
        return filepath;
    }
    /**
     * Build the markdown content for session memory
     */
    buildSessionMemory(flows) {
        const lines = [];
        const today = new Date().toISOString().split('T')[0];
        // Frontmatter
        lines.push('---');
        lines.push('name: sidecoach-session-' + today.replace(/-/g, ''));
        lines.push('description: Sidecoach flow execution session - design decisions, rules applied, metrics validated');
        lines.push('metadata:');
        lines.push('  type: project');
        lines.push('  relates_to:');
        lines.push('    - sidecoach_consolidation_gameplan.md');
        lines.push('    - phase4-completion-final.md');
        lines.push('---');
        lines.push('');
        // Title and summary
        lines.push(`# Sidecoach Session - ${today}`);
        lines.push('');
        lines.push(`Execution summary: ${flows.length} flows executed`);
        lines.push('');
        // Flow execution order
        lines.push('## Flow Execution Order');
        lines.push('');
        flows.forEach((flow, idx) => {
            const status = flow.status === 'success' ? 'OK' : flow.status === 'error' ? 'ERROR' : 'SKIP';
            lines.push(`${idx + 1}. **${flow.flowName}** (${flow.flowId}) - [${status}]`);
        });
        lines.push('');
        // Detailed flow records
        lines.push('## Detailed Flow Records');
        lines.push('');
        // Try to cast entries to FlowMemoryEntry if they have the extended schema
        flows.forEach((flow) => {
            // Check if this flow has memory data (appliedRules, userDecisions, etc.)
            const memoryFlow = flow;
            if (memoryFlow.appliedRules ||
                memoryFlow.userDecisions ||
                memoryFlow.metrics ||
                memoryFlow.validationResults) {
                // Format using the full memory schema
                lines.push(this.formatFlowMemory(memoryFlow));
            }
            else {
                // Fallback for flows without extended memory schema
                lines.push(this.formatFlowBasic(flow));
            }
            lines.push('');
        });
        // Summary metrics
        lines.push('## Session Summary');
        lines.push('');
        const successCount = flows.filter((f) => f.status === 'success').length;
        const errorCount = flows.filter((f) => f.status === 'error').length;
        const skipCount = flows.filter((f) => f.status === 'skipped').length;
        lines.push(`- Total flows: ${flows.length}`);
        lines.push(`- Successful: ${successCount}`);
        lines.push(`- Errors: ${errorCount}`);
        lines.push(`- Skipped: ${skipCount}`);
        lines.push('');
        // Collected design decisions across all flows
        const allDecisions = flows
            .flatMap((f) => f.userDecisions || [])
            .filter((d) => d);
        if (allDecisions.length > 0) {
            lines.push('## All Design Decisions');
            lines.push('');
            allDecisions.forEach((decision) => {
                lines.push(`- ${decision.decision}`);
                if (decision.rationale) {
                    lines.push(`  - Why: ${decision.rationale}`);
                }
            });
            lines.push('');
        }
        // Collected metrics across all flows
        const allMetrics = flows
            .flatMap((f) => f.metrics || [])
            .filter((m) => m);
        if (allMetrics.length > 0) {
            lines.push('## All Measurements');
            lines.push('');
            allMetrics.forEach((metric) => {
                const target = metric.target ? ` (target: ${metric.target})` : '';
                lines.push(`- ${metric.name}: ${metric.value}${target} = ${metric.status}`);
            });
            lines.push('');
        }
        // Validation summary
        const allValidations = flows
            .flatMap((f) => f.validationResults || [])
            .filter((v) => v);
        if (allValidations.length > 0) {
            const failCount = allValidations.filter((v) => v.result === 'fail').length;
            const warnCount = allValidations.filter((v) => v.result === 'warning').length;
            if (failCount > 0 || warnCount > 0) {
                lines.push('## Validation Issues');
                lines.push('');
                if (failCount > 0) {
                    lines.push(`**Failed validations (${failCount}):**`);
                    allValidations
                        .filter((v) => v.result === 'fail')
                        .forEach((v) => {
                        const details = v.details ? ` - ${v.details}` : '';
                        lines.push(`- ${v.check}${details}`);
                    });
                    lines.push('');
                }
                if (warnCount > 0) {
                    lines.push(`**Warnings (${warnCount}):**`);
                    allValidations
                        .filter((v) => v.result === 'warning')
                        .forEach((v) => {
                        const details = v.details ? ` - ${v.details}` : '';
                        lines.push(`- ${v.check}${details}`);
                    });
                    lines.push('');
                }
            }
        }
        lines.push(`Recorded: ${new Date().toISOString()}`);
        return lines.join('\n');
    }
    /**
     * Format flow with full memory schema
     */
    formatFlowMemory(flow) {
        const lines = [];
        lines.push(`### ${flow.flowName} (${flow.flowId})`);
        lines.push(`Status: ${flow.status}`);
        lines.push('');
        if (flow.message) {
            lines.push(`${flow.message}`);
            lines.push('');
        }
        // Applied rules
        if (flow.appliedRules && flow.appliedRules.length > 0) {
            lines.push('**Rules Applied:**');
            flow.appliedRules.forEach((rule) => {
                lines.push(`- ${rule.domain}: ${rule.rules.join(', ')}`);
            });
            lines.push('');
        }
        // User decisions
        if (flow.userDecisions && flow.userDecisions.length > 0) {
            lines.push('**Decisions:**');
            flow.userDecisions.forEach((decision) => {
                lines.push(`- ${decision.decision}`);
            });
            lines.push('');
        }
        // Metrics
        if (flow.metrics && flow.metrics.length > 0) {
            lines.push('**Metrics:**');
            flow.metrics.forEach((metric) => {
                lines.push(`- ${metric.name}: ${metric.value} (${metric.status})`);
            });
            lines.push('');
        }
        // Validations
        if (flow.validationResults && flow.validationResults.length > 0) {
            const failed = flow.validationResults.filter((v) => v.result === 'fail');
            if (failed.length > 0) {
                lines.push('**Validation Issues:**');
                failed.forEach((v) => {
                    lines.push(`- FAIL: ${v.check}`);
                });
                lines.push('');
            }
        }
        return lines.join('\n');
    }
    /**
     * Format flow with basic schema (fallback)
     */
    formatFlowBasic(flow) {
        const lines = [];
        lines.push(`### ${flow.flowName} (${flow.flowId})`);
        lines.push(`Status: ${flow.status}`);
        lines.push('');
        if (flow.message) {
            lines.push(`${flow.message}`);
            lines.push('');
        }
        if (flow.guidance && flow.guidance.length > 0) {
            lines.push('**Guidance:**');
            flow.guidance.forEach((g) => {
                lines.push(`- ${g}`);
            });
            lines.push('');
        }
        if (flow.nextSteps && flow.nextSteps.length > 0) {
            lines.push('**Next Steps:**');
            flow.nextSteps.forEach((step) => {
                lines.push(`- ${step}`);
            });
            lines.push('');
        }
        return lines.join('\n');
    }
    /**
     * Update MEMORY.md index to point to new session file
     */
    updateMemoryIndex(sessionFilename) {
        const indexPath = path.join(this.memoryDir, 'MEMORY.md');
        if (!fs.existsSync(indexPath)) {
            return; // Index doesn't exist yet
        }
        let content = fs.readFileSync(indexPath, 'utf-8');
        // Check if entry already exists
        const sessionName = sessionFilename.replace('.md', '').replace(/session_/, '');
        const entry = `- [Sidecoach Session](${sessionFilename}) - design decisions, rules applied, metrics`;
        if (!content.includes(sessionFilename)) {
            // Add at the top of the file (after any header)
            const lines = content.split('\n');
            let insertIdx = 0;
            // Find the first non-header, non-empty line
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].startsWith('#') && lines[i].trim() !== '') {
                    insertIdx = i;
                    break;
                }
            }
            lines.splice(insertIdx, 0, entry);
            content = lines.join('\n');
            fs.writeFileSync(indexPath, content, 'utf-8');
        }
    }
}
exports.SessionMemoryWriter = SessionMemoryWriter;
/**
 * Write session memory at session end
 * Call this from the orchestrator or CLI tool
 */
function persistSessionMemory(projectPath) {
    const writer = new SessionMemoryWriter(projectPath);
    return writer.writeSessionMemory();
}
//# sourceMappingURL=session-memory-writer.js.map