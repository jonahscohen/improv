import { AnnotationData } from '../types.js';

export type Verbosity = 'compact' | 'standard' | 'detailed' | 'forensic';

export function formatAnnotations(annotations: AnnotationData[], verbosity: Verbosity): string {
  return annotations.map((ann, index) => formatOne(ann, index + 1, verbosity)).join('\n\n');
}

function formatOne(ann: AnnotationData, n: number, verbosity: Verbosity): string {
  switch (verbosity) {
    case 'compact':
      return `${n}. **${ann.elementSelector}** [${ann.intent}/${ann.severity}]: ${ann.comment}`;

    case 'standard':
      return [
        `### ${n}. ${ann.elementSelector}`,
        `**Location:** ${ann.elementPath}`,
        `**Intent:** ${ann.intent} | **Severity:** ${ann.severity}`,
        `**Feedback:** ${ann.comment}`,
      ].join('\n');

    case 'detailed': {
      const bb = ann.boundingBox;
      const lines = [
        `### ${n}. ${ann.elementSelector}`,
        `**Location:** ${ann.elementPath}`,
        `**Intent:** ${ann.intent} | **Severity:** ${ann.severity}`,
        `**Feedback:** ${ann.comment}`,
        `**Position:** ${bb.x}, ${bb.y} (${bb.width}x${bb.height})`,
      ];
      if (ann.nearbyText) lines.push(`**Context:** ${ann.nearbyText}`);
      if (ann.accessibility?.role || ann.accessibility?.label) {
        lines.push(`**Accessibility:** role=${ann.accessibility.role} label=${ann.accessibility.label}`);
      }
      return lines.join('\n');
    }

    case 'forensic': {
      const bb = ann.boundingBox;
      const lines = [
        `### ${n}. ${ann.elementSelector}`,
        `**Location:** ${ann.elementPath}`,
        `**Intent:** ${ann.intent} | **Severity:** ${ann.severity}`,
        `**Feedback:** ${ann.comment}`,
        `**Position:** ${bb.x}, ${bb.y} (${bb.width}x${bb.height})`,
      ];
      if (ann.nearbyText) lines.push(`**Context:** ${ann.nearbyText}`);
      if (ann.accessibility?.role || ann.accessibility?.label) {
        lines.push(`**Accessibility:** role=${ann.accessibility.role} label=${ann.accessibility.label}`);
      }
      if (ann.computedStyles && Object.keys(ann.computedStyles).length > 0) {
        lines.push('**Computed Styles:**');
        for (const [prop, value] of Object.entries(ann.computedStyles)) {
          lines.push(`  ${prop}: ${value}`);
        }
      }
      lines.push(`**Viewport:** ${bb.width}x${bb.height} at (${bb.x}, ${bb.y})`);
      lines.push(`**Timestamp:** ${new Date(ann.timestamp).toISOString()}`);
      return lines.join('\n');
    }
  }
}
