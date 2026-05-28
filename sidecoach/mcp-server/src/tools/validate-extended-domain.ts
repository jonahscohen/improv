// Tool 6: sidecoach_validate_extended_domain - run the 112-rule
// ExtendedDomainValidator across all 10 domains.

import {
  ExtendedDomainValidator,
  type DomainCheckContext,
} from '../../../dist/extended-domain-validator';
import { SidecoachToolError, redactErrorMessage } from '../errors';
import {
  validateExtendedDomainShape,
  type ValidateExtendedDomainInputT,
} from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof validateExtendedDomainShape> = {
  name: 'sidecoach_validate_extended_domain',
  description:
    'Run sidecoach\'s 112-rule Extended Domain validator across 10 design domains: typography, ' +
    'color, spacing, motion, accessibility, contrast, performance, data visualization, ' +
    'internationalization, and Polish Standard subset. Provide any subset of inputs (HTML, CSS, ' +
    'designTokens, typography, colors, spacing, motion, accessibility, contrast, performance, ' +
    'visualization, internationalization). Returns per-domain pass rates and the full result set. ' +
    'If no inputs are provided, returns a skipped-status report instead of synthesizing pass rates.',
  inputSchema: validateExtendedDomainShape,
  timeoutMs: 30_000,
};

function extractCssRules(rawCss: string): string[] {
  return rawCss
    .split('}')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk + '}');
}

export const handler: ToolHandler<ValidateExtendedDomainInputT> = async (
  input,
  _deps,
) => {
  const cssCombined = [
    input.css ?? '',
    ...((input.html ?? '').match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) ?? []).map(
      (s) => s.replace(/<style\b[^>]*>/i, '').replace(/<\/style>/i, ''),
    ),
  ]
    .filter((s) => s.length > 0)
    .join('\n');
  const cssRules = cssCombined ? extractCssRules(cssCombined) : [];

  // Map each optional record-of-unknown input into the validator's typed
  // shape. We cast through `unknown` because we don't run full Zod schemas
  // for every nested shape - the validator itself tolerates partial inputs.
  const context: DomainCheckContext = {
    cssRules,
    designTokens: input.designTokens as Record<string, unknown> | undefined,
    typography: input.typography as any,
    colors: input.colors as any,
    spacing: input.spacing as any,
    motion: input.motion as any,
    accessibility: input.accessibility as any,
    contrast: input.contrast as any,
    performance: input.performance as any,
    visualization: input.visualization as any,
    internationalization: input.internationalization as any,
  };

  let report;
  try {
    report = ExtendedDomainValidator.validateAll(context);
  } catch (err) {
    throw new SidecoachToolError(
      'VALIDATOR_FAILURE',
      'ExtendedDomainValidator threw an exception',
      {
        validator: 'ExtendedDomainValidator.validateAll',
        errorMessage: redactErrorMessage(err),
      },
    );
  }

  // Status comes from the report itself ('skipped' or 'completed').
  const summary =
    report.status === 'skipped'
      ? 'sidecoach_validate_extended_domain: skipped (no inputs provided)'
      : `sidecoach_validate_extended_domain: ${report.passed}/${report.totalRules} passed (${report.passRate}), ${report.criticalViolations} critical across ${Object.keys(report.passRateByDomain).length} domains`;

  return { data: { report }, summary };
};
