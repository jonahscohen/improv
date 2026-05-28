// Tool 7: sidecoach_validate_taste - run the taste-validator against an
// HTML body (with optional CSS).

import { validateTaste, formatViolations } from '../../../dist/taste-validator';
import { SidecoachToolError, redactErrorMessage } from '../errors';
import { validateTasteShape, type ValidateTasteInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof validateTasteShape> = {
  name: 'sidecoach_validate_taste',
  description:
    'Run sidecoach\'s taste validator over the provided HTML (and optional CSS). Checks for ' +
    'AI-slop patterns like fabricated SVG icons, translate-Y in :hover, hex literals in hover ' +
    'states when CSS vars are available, hero radial gradients, large inline style attrs, ' +
    'observer races, and border-radius inconsistency. Returns the structured violation list ' +
    'and a formatted human-readable string.',
  inputSchema: validateTasteShape,
  timeoutMs: 30_000,
};

export const handler: ToolHandler<ValidateTasteInputT> = async (input, _deps) => {
  let violations;
  try {
    violations = validateTaste(input.html, input.css, {
      iconLibrary: input.iconLibrary,
    });
  } catch (err) {
    throw new SidecoachToolError(
      'VALIDATOR_FAILURE',
      'taste validator threw an exception',
      {
        validator: 'validateTaste',
        errorMessage: redactErrorMessage(err),
      },
    );
  }
  let formatted: string;
  try {
    formatted = formatViolations(violations, '<input>');
  } catch (err) {
    formatted = `failed to format violations: ${redactErrorMessage(err)}`;
  }
  return {
    data: {
      violationCount: violations.length,
      violations,
      formatted,
    },
    summary:
      violations.length === 0
        ? 'sidecoach_validate_taste: 0 violations'
        : `sidecoach_validate_taste: ${violations.length} violation(s)`,
  };
};
