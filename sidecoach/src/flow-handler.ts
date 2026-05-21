import { FlowId } from './types';

export interface FlowExecutionContext {
  utterance: string;
  userId?: string;
  projectPath?: string;
  currentFile?: string;
  selectedText?: string;
  metadata?: Record<string, any>;
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

export class BaseFlowHandler implements FlowHandler {
  flowId: FlowId;

  constructor(flowId: FlowId) {
    this.flowId = flowId;
  }

  canExecute(context: FlowExecutionContext): boolean {
    return true;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'skipped',
      message: 'Flow handler not implemented',
    };
  }

  protected getFlowName(): string {
    const flowNames: Record<FlowId, string> = {
      flow1_clone_match: 'Clone/Match from Reference',
      flow2_polish_enhance: 'Polish/Enhance Interaction',
      flow3_audit_page: 'Audit Page/Section',
      flow4_explore_discovery: 'Exploration/Discovery Mode',
      flow5_review_qa: 'Review/QA Mode',
      flow6_constraint_design: 'Constraint-Based Design',
      flow7_design_component: 'Design a New Component',
      flow8_refactor_layout: 'Refactor/Improve Section',
      flow9_accessible: 'Make Accessible',
      flow10_implement_design: 'Implement from Design',
      flow11_extract_tokens: 'Extract Design Tokens',
      flow12_responsive_review: 'Responsive Design Review',
      flow13_rapid_iteration: 'Rapid Iteration/Refinement',
      flow14_migration: 'Migration/API Changes',
    };
    return flowNames[this.flowId] || 'Unknown Flow';
  }

  protected createChecklist(items: { label: string; required: boolean; description?: string }[]): ChecklistItem[] {
    return items.map((item, index) => ({
      id: `item-${index}`,
      ...item,
      completed: false,
    }));
  }

  protected createArtifact(type: FlowArtifact['type'], name: string, content: string, description?: string): FlowArtifact {
    return { type, name, content, description };
  }
}
