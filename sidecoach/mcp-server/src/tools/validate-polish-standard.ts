// Tool 5: sidecoach_validate_polish_standard - run the 22-point
// PolishStandardValidator against provided context.

import {
  PolishStandardValidator,
  type PolishCheckContext,
} from '../../../dist/polish-standard-validator';
import { SidecoachToolError, redactErrorMessage } from '../errors';
import { validatePolishShape, type ValidatePolishInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof validatePolishShape> = {
  name: 'sidecoach_validate_polish_standard',
  description:
    'Run sidecoach\'s 22-Point Polish Standard validator (14 baseline + 8 proprietary rules). ' +
    'Provide HTML and/or CSS and/or a design-token map. The validator inspects CSS rules for ' +
    'scale-on-press, concentric radius, compound icon transitions, shadow rhythm, hit areas, ' +
    'reduced-motion support, and 16 more polish criteria. Returns pass/fail counts, per-rule ' +
    'results, and a severity-weighted summary.',
  inputSchema: validatePolishShape,
  timeoutMs: 30_000,
};

function extractCssRules(rawCss: string): string[] {
  // PolishStandardValidator's rules grep against ctx.cssRules as a string[]
  // where each entry is a single rule-like string. We approximate by
  // splitting on '}' boundaries and trimming, which is enough for the
  // substring-matching that the rule functions actually do.
  return rawCss
    .split('}')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk + '}');
}

export const handler: ToolHandler<ValidatePolishInputT> = async (input, _deps) => {
  const cssCombined = [
    input.css ?? '',
    // Pull <style> bodies out of HTML so they participate in matching.
    ...((input.html ?? '').match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) ?? []).map(
      (s) => s.replace(/<style\b[^>]*>/i, '').replace(/<\/style>/i, ''),
    ),
  ]
    .filter((s) => s.length > 0)
    .join('\n');

  const cssRules = cssCombined ? extractCssRules(cssCombined) : [];

  const context: PolishCheckContext = {
    cssRules,
    designTokens: input.designTokens as Record<string, unknown> | undefined,
    ...((input.contextOverrides as Partial<PolishCheckContext>) ?? {}),
  };

  let report;
  try {
    report = PolishStandardValidator.validateAll(context);
  } catch (err) {
    throw new SidecoachToolError(
      'VALIDATOR_FAILURE',
      'PolishStandardValidator threw an exception',
      {
        validator: 'PolishStandardValidator.validateAll',
        errorMessage: redactErrorMessage(err),
      },
    );
  }

  return {
    data: { report },
    summary: `sidecoach_validate_polish_standard: ${report.passed}/${report.totalRules} passed (${report.passRate}), ${report.criticalViolations} critical`,
  };
};
