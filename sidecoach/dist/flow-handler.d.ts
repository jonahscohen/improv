import { FlowId } from './types';
import { ProjectContext } from './project-context';
import { FlowMemoryEntry } from './flow-memory-schema';
export interface FlowExecutionContext {
    utterance: string;
    userId?: string;
    projectPath?: string;
    currentFile?: string;
    selectedText?: string;
    metadata?: Record<string, any>;
    projectContext?: ProjectContext;
}
export interface FlowExecutionResult {
    flowId: FlowId;
    flowName: string;
    status: 'success' | 'needs_input' | 'error' | 'skipped';
    message: string;
    guidance?: string[];
    checklist?: ChecklistItem[];
    nextSteps?: string[];
    artifacts?: FlowArtifact[];
    error?: string;
    memory?: FlowMemoryEntry;
}
export interface ChecklistItem {
    id: string;
    label: string;
    required: boolean;
    description?: string;
    completed?: boolean;
}
export interface FlowArtifact {
    type: 'checklist' | 'script' | 'command' | 'reference' | 'template';
    name: string;
    content: string;
    description?: string;
}
export interface FlowHandler {
    flowId: FlowId;
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
}
export declare class BaseFlowHandler implements FlowHandler {
    flowId: FlowId;
    constructor(flowId: FlowId);
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    protected getFlowName(): string;
    protected createChecklist(items: {
        label: string;
        required: boolean;
        description?: string;
    }[]): ChecklistItem[];
    protected createArtifact(type: FlowArtifact['type'], name: string, content: string, description?: string): FlowArtifact;
}
//# sourceMappingURL=flow-handler.d.ts.map