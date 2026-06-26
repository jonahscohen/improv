// Phase III Block 1: Flow-Specific Validators
// Custom validators for high-impact flows

import { FlowExecutionResult, FlowExecutionContext } from './flow-handler';

export interface FlowValidationRule {
  name: string;
  description: string;
  check: (context: FlowExecutionContext, result: FlowExecutionResult) => boolean;
  severity: 'error' | 'warning' | 'info';
}

export interface FlowValidatorConfig {
  flowId: string;
  rules: FlowValidationRule[];
}

// ===== Flow A: Brand Verify Validator =====
const brandVerifyRules: FlowValidationRule[] = [
  {
    name: 'design-tokens-present',
    description: 'Design tokens metadata must be populated',
    check: (context, result) => {
      return !!(context.metadata?.designTokens && Object.keys(context.metadata.designTokens).length > 0);
    },
    severity: 'error',
  },
  {
    name: 'register-defined',
    description: 'Brand register must be selected',
    check: (context, result) => {
      return !!(context.metadata?.designTokens?.register && context.metadata.designTokens.register !== 'unknown');
    },
    severity: 'error',
  },
  {
    name: 'color-palette-exists',
    description: 'Color palette must be defined',
    check: (context, result) => {
      return !!(context.metadata?.colors && Object.keys(context.metadata.colors).length > 0);
    },
    severity: 'warning',
  },
  {
    name: 'brand-consistency-checked',
    description: 'Brand consistency validation should execute',
    check: (context, result) => {
      return !!(result.status === 'success' && result.guidance && result.guidance.length > 0);
    },
    severity: 'warning',
  },
];

// ===== Flow B: Component Research Validator =====
const componentResearchRules: FlowValidationRule[] = [
  {
    name: 'interaction-patterns-identified',
    description: 'Interaction patterns must be documented',
    check: (context, result) => {
      return !!(result.status === 'success' && result.guidance && result.guidance.some(g => g.includes('interaction')));
    },
    severity: 'warning',
  },
  {
    name: 'accessibility-rules-checked',
    description: 'Accessibility validation should be present',
    check: (context, result) => {
      return !!(result.status === 'success' && result.guidance && result.guidance.some(g => g.includes('accessibility') || g.includes('wcag')));
    },
    severity: 'warning',
  },
  {
    name: 'component-states-documented',
    description: 'Component states must be identified',
    check: (context, result) => {
      return !!(result.checklist && result.checklist.length > 0);
    },
    severity: 'info',
  },
  {
    name: 'reference-system-used',
    description: 'Component gallery reference should be consulted',
    check: (context, result) => {
      return !!(result.artifacts && result.artifacts.length > 0);
    },
    severity: 'info',
  },
];

// ===== Flow F: Design Tokens Validator =====
const designTokensRules: FlowValidationRule[] = [
  {
    name: 'token-naming-consistent',
    description: 'Token naming must follow conventions',
    check: (context, result) => {
      // Check if guidance includes naming convention information
      return !!(result.guidance && result.guidance.some(g => g.includes('naming') || g.includes('convention')));
    },
    severity: 'warning',
  },
  {
    name: 'token-coverage-complete',
    description: 'All design domains must have tokens',
    check: (context, result) => {
      return !!(result.guidance && result.guidance.some(g => g.includes('color') && g.includes('spacing') && g.includes('typography')));
    },
    severity: 'error',
  },
  {
    name: 'semantic-tokens-defined',
    description: 'Semantic token structure should be established',
    check: (context, result) => {
      return !!(result.guidance && result.guidance.some(g => g.includes('semantic') || g.includes('alias')));
    },
    severity: 'warning',
  },
  {
    name: 'token-scale-verified',
    description: 'Token scales must be mathematically consistent',
    check: (context, result) => {
      return !!(result.guidance && result.guidance.some(g => g.includes('scale') || g.includes('ratio')));
    },
    severity: 'info',
  },
];

// ===== Flow J: Tactical Polish Validator =====
const tacticalPolishRules: FlowValidationRule[] = [
  {
    name: 'polish-principles-applied',
    description: '24-point Polish Standard must be enforced',
    check: (context, result) => {
      // Check for polish-related guidance
      return !!(result.guidance && result.guidance.some(g =>
        g.includes('scale') || g.includes('radius') || g.includes('transition') || g.includes('shadow')
      ));
    },
    severity: 'warning',
  },
  {
    name: 'baseline-items-complete',
    description: '14 baseline polish items must be addressed',
    check: (context, result) => {
      return !!(result.checklist && result.checklist.length >= 14);
    },
    severity: 'error',
  },
  {
    name: 'proprietary-items-addressed',
    description: '8 proprietary items must be documented',
    check: (context, result) => {
      return !!(result.guidance && result.guidance.length >= 8);
    },
    severity: 'warning',
  },
  {
    name: 'optical-alignment-verified',
    description: 'Optical alignment must be checked',
    check: (context, result) => {
      return !!(result.guidance && result.guidance.some(g => g.includes('optical') || g.includes('alignment') || g.includes('baseline')));
    },
    severity: 'info',
  },
];

// Registry of all flow validators
const FLOW_VALIDATORS: Record<string, FlowValidatorConfig> = {
  flowA_brand_verify: {
    flowId: 'flowA_brand_verify',
    rules: brandVerifyRules,
  },
  flowB_component_research: {
    flowId: 'flowB_component_research',
    rules: componentResearchRules,
  },
  flowF_design_tokens: {
    flowId: 'flowF_design_tokens',
    rules: designTokensRules,
  },
  flowJ_tactical_polish: {
    flowId: 'flowJ_tactical_polish',
    rules: tacticalPolishRules,
  },
};

export class FlowSpecificValidator {
  static getValidatorConfig(flowId: string): FlowValidatorConfig | undefined {
    return FLOW_VALIDATORS[flowId];
  }

  static validateFlow(
    flowId: string,
    context: FlowExecutionContext,
    result: FlowExecutionResult
  ): { passed: number; failed: number; warnings: string[] } {
    const config = FLOW_VALIDATORS[flowId];
    if (!config) {
      return { passed: 0, failed: 0, warnings: [] };
    }

    let passed = 0;
    let failed = 0;
    const warnings: string[] = [];

    for (const rule of config.rules) {
      const ruleResult = rule.check(context, result);

      if (ruleResult) {
        passed++;
      } else {
        if (rule.severity === 'error') {
          failed++;
        } else if (rule.severity === 'warning') {
          warnings.push(`[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.description}`);
        }
      }
    }

    return { passed, failed, warnings };
  }

  static getAllValidators(): FlowValidatorConfig[] {
    return Object.values(FLOW_VALIDATORS);
  }

  static validateAll(
    flowId: string,
    context: FlowExecutionContext,
    result: FlowExecutionResult
  ): Record<string, { passed: number; failed: number; warnings: string[] }> {
    const results: Record<string, { passed: number; failed: number; warnings: string[] }> = {};

    for (const [id, config] of Object.entries(FLOW_VALIDATORS)) {
      if (id === flowId || flowId === '*') {
        results[id] = this.validateFlow(id, context, result);
      }
    }

    return results;
  }
}

export function getFlowValidatorConfig(flowId: string): FlowValidatorConfig | undefined {
  return FlowSpecificValidator.getValidatorConfig(flowId);
}
