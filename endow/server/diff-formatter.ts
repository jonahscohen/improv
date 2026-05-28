import type { ResolvedChange, StylingApproach } from './types.js';
import { getGuidance } from './styling-detector.js';

export function formatDiffOutput(
  changes: ResolvedChange[],
  approach: StylingApproach
): string {
  const byFile = new Map<string, ResolvedChange[]>();

  for (const change of changes) {
    const key = change.source.filePath;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(change);
  }

  const sections: string[] = [];

  for (const [filePath, fileChanges] of byFile) {
    const byRule = new Map<string, ResolvedChange[]>();

    for (const change of fileChanges) {
      const ruleKey = change.source.ruleSelector ?? '__no_rule__';
      if (!byRule.has(ruleKey)) byRule.set(ruleKey, []);
      byRule.get(ruleKey)!.push(change);
    }

    for (const [ruleKey, ruleChanges] of byRule) {
      const first = ruleChanges[0];
      const lines: string[] = [];

      lines.push(`File: ${filePath}`);
      lines.push(`Line: ${first.source.line}`);

      if (ruleKey !== '__no_rule__') {
        lines.push(`Rule: ${ruleKey}`);
      }

      lines.push('Changes:');

      for (const change of ruleChanges) {
        if (change.guidance && change.guidance.includes('swap class')) {
          lines.push(`  remove class: ${change.oldValue} / add class: ${change.newValue}`);
        } else {
          lines.push(`  ${change.property}: ${change.oldValue} -> ${change.newValue}`);
        }
      }

      sections.push(lines.join('\n'));
    }
  }

  const tokenMappings = changes
    .filter((c) => c.tokenMapping)
    .map((c) => c.tokenMapping as string);

  const footer: string[] = [];
  footer.push('---');
  footer.push(`Styling approach: ${getGuidance(approach)}`);
  if (tokenMappings.length > 0) {
    footer.push(`Design tokens: ${tokenMappings.join(', ')}`);
  }

  return [...sections, footer.join('\n')].join('\n\n');
}
