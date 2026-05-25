import { FlowExecutionResult } from './flow-handler';
import { BuildReport, GradingThresholds } from './build-report-types';
export interface AggregatorInput {
    source: 'flow-results' | 'memory';
    flowResults?: FlowExecutionResult[];
    memoryPaths?: string[];
    composite?: string;
}
export interface AggregatorOptions {
    includeInfo?: boolean;
    maxFindings?: number;
    thresholds?: GradingThresholds;
}
export declare function generateBuildReport(input: AggregatorInput, options?: AggregatorOptions): BuildReport;
/**
 * Render a BuildReport as human-readable markdown.
 * Pure function. No I/O.
 */
export declare function renderBuildReportMarkdown(report: BuildReport): string;
//# sourceMappingURL=build-report-aggregator.d.ts.map