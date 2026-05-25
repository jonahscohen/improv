import * as fs from 'fs';
import * as path from 'path';
import type { FlowExecutionContext, FlowExecutionResult } from './flow-handler';

export interface TeachExtraction {
  register?: 'brand' | 'product';
  users?: string;
  brandPersonality?: string;
  antiReferences?: string[];
  strategicPrinciples?: string[];
  confidence: { [field: string]: 'high' | 'low' | 'absent' };
}

interface Gap {
  field: string;
  question: string;
}

/**
 * TeachCommandHandlerV2 - brief-driven hybrid handler.
 *
 * Replaces the old hardcoded-default stub. The handler parses a user's brief from
 * `context.utterance`, extracts the five PRODUCT.md fields (register, users,
 * brandPersonality, antiReferences, strategicPrinciples), identifies gaps, and
 * either returns a pending-with-questions result OR writes PRODUCT.md when the
 * brief plus any supplied teachAnswers cover all required fields.
 *
 * Constraints honored in the generated PRODUCT.md:
 * - No self-attribution lines
 * - No references to /sidecoach
 * - Brand Personality section only present when register=brand
 * - Will not overwrite a real existing PRODUCT.md (>=200 chars, no [TODO]
 *   placeholders) unless metadata.forceOverwrite is true.
 */
export class TeachCommandHandlerV2 {
  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const projectPath = context.projectPath || process.cwd();
    const productMdPath = path.join(projectPath, 'PRODUCT.md');

    // Refuse to overwrite real PRODUCT.md without explicit force.
    if (this.hasRealProductMd(productMdPath) && !(context.metadata as any)?.forceOverwrite) {
      return {
        flowId: 'teach' as any,
        flowName: 'Sidecoach Teach',
        status: 'error',
        message: `PRODUCT.md exists at ${productMdPath} (>=200 chars of real content). Pass metadata.forceOverwrite=true to replace.`,
        error: 'PRODUCT.md exists',
        guidance: [],
        checklist: [],
      };
    }

    const brief = this.extractBrief(context.utterance);
    const extracted = this.parseBrief(brief);
    const teachAnswers = (context.metadata as any)?.teachAnswers || {};
    const merged = this.mergeFromBriefAndAnswers(extracted, teachAnswers);

    const gaps = this.identifyGaps(merged);
    if (gaps.length > 0 && !(context.metadata as any)?.skipInteractive) {
      return {
        flowId: 'teach' as any,
        flowName: 'Sidecoach Teach',
        status: 'pending' as any,
        message: `Brief partially parsed. ${gaps.length} field(s) need answers.`,
        guidance: [
          'Brief extracted these fields:',
          ...this.summarizeExtracted(merged),
          '',
          'Missing or low-confidence fields - awaiting answers:',
          ...gaps.map((g) => `- ${g.field}: ${g.question}`),
        ],
        checklist: gaps.map((g) => ({
          id: g.field,
          label: `Answer: ${g.question}`,
          required: true,
          completed: false,
        })),
        artifacts: [
          {
            type: 'reference',
            name: 'teach-state',
            content: JSON.stringify({ extracted: merged, gaps }, null, 2),
            description: 'Parsed brief state + outstanding gaps',
          },
        ],
      };
    }

    const content = this.generateProductMd(merged);
    fs.writeFileSync(productMdPath, content, 'utf-8');

    return {
      flowId: 'teach' as any,
      flowName: 'Sidecoach Teach',
      status: 'success',
      message: `PRODUCT.md written to ${productMdPath} from brief + answers.`,
      guidance: [
        `Register: ${merged.register}`,
        `Users: ${merged.users}`,
        merged.register === 'brand' && merged.brandPersonality
          ? `Brand personality: ${merged.brandPersonality}`
          : '',
        `Anti-references: ${(merged.antiReferences || []).join('; ')}`,
        `Strategic principles: ${(merged.strategicPrinciples || []).join('; ')}`,
      ].filter((s) => s.length > 0) as string[],
      checklist: [
        { id: 'register', label: 'Register confirmed', required: true, completed: true },
        { id: 'users', label: 'Users documented', required: true, completed: true },
        { id: 'anti', label: 'Anti-references captured', required: true, completed: true },
        { id: 'principles', label: 'Strategic principles documented', required: true, completed: true },
      ],
    };
  }

  private hasRealProductMd(productPath: string): boolean {
    if (!fs.existsSync(productPath)) return false;
    const content = fs.readFileSync(productPath, 'utf-8');
    if (content.length < 200) return false;
    if (/\[TODO\]/i.test(content)) return false;
    return true;
  }

  private extractBrief(utterance: string): string {
    // Strip the leading slash command if present.
    return (utterance || '').replace(/^\/sidecoach\s+teach\s*/i, '').trim();
  }

  private parseBrief(brief: string): TeachExtraction {
    const e: TeachExtraction = { confidence: {} };
    if (!brief) {
      ['register', 'users', 'brandPersonality', 'antiReferences', 'strategicPrinciples'].forEach(
        (f) => (e.confidence[f] = 'absent'),
      );
      return e;
    }

    // Register - explicit "register: brand" or "register: product" wins;
    // bare "brand" / "product" only counts if exactly one appears.
    const registerExplicit = brief.match(/register:\s*(brand|product)\b/i);
    if (registerExplicit) {
      e.register = registerExplicit[1].toLowerCase() as 'brand' | 'product';
      e.confidence.register = 'high';
    } else {
      const hasBrand = /\bbrand\b/i.test(brief);
      const hasProduct = /\b(?:product|saas|app|tool)\b/i.test(brief);
      if (hasBrand && !hasProduct) {
        e.register = 'brand';
        e.confidence.register = 'high';
      } else if (hasProduct && !hasBrand) {
        e.register = 'product';
        e.confidence.register = 'high';
      } else {
        e.confidence.register = 'absent';
      }
    }

    // Users - look for "users:" or "for X" / "audience:" / "target:" patterns.
    const usersMatch =
      brief.match(/users?:\s*([^.]+\.)/i) ||
      brief.match(/(?:for|target|audience:?)\s+([^.]{8,}\.)/i);
    if (usersMatch) {
      e.users = usersMatch[1].trim().replace(/\.$/, '');
      e.confidence.users = 'high';
    } else {
      e.confidence.users = 'absent';
    }

    // Brand personality (only when register=brand)
    if (e.register === 'brand') {
      const personalityMatch =
        brief.match(/brand\s+personality:\s*([^.]+\.)/i) ||
        brief.match(/(?:voice|tone|personality|feel):\s*([^.]+\.)/i);
      if (personalityMatch) {
        e.brandPersonality = personalityMatch[1].trim().replace(/\.$/, '');
        e.confidence.brandPersonality = 'high';
      } else {
        e.confidence.brandPersonality = 'absent';
      }
    } else {
      // For product register, brand personality is not required - mark absent
      // but identifyGaps will skip it.
      e.confidence.brandPersonality = 'absent';
    }

    // Anti-references
    const antiMatch = brief.match(/anti-?references?:\s*([^.]+\.)/i);
    if (antiMatch) {
      const items = antiMatch[1]
        .split(/,|;/)
        .map((s) => s.trim().replace(/\.$/, ''))
        .filter((s) => s.length > 2);
      e.antiReferences = items;
      e.confidence.antiReferences = items.length > 0 ? 'high' : 'low';
    } else {
      e.confidence.antiReferences = 'absent';
    }

    // Strategic principles
    const stratMatch = brief.match(/strategic principles?:\s*([^.]+\.?)$/i) ||
      brief.match(/strategic principles?:\s*([^.]+\.)/i);
    if (stratMatch) {
      const items = stratMatch[1]
        .split(/;|,/)
        .map((s) => s.trim().replace(/\.$/, ''))
        .filter((s) => s.length > 4);
      e.strategicPrinciples = items;
      e.confidence.strategicPrinciples = items.length > 0 ? 'high' : 'low';
    } else {
      e.confidence.strategicPrinciples = 'absent';
    }

    return e;
  }

  private mergeFromBriefAndAnswers(
    extracted: TeachExtraction,
    answers: Record<string, any>,
  ): TeachExtraction {
    const m: TeachExtraction = { ...extracted, confidence: { ...extracted.confidence } };
    for (const key of [
      'register',
      'users',
      'brandPersonality',
      'antiReferences',
      'strategicPrinciples',
    ]) {
      if (answers[key] !== undefined && m.confidence[key] !== 'high') {
        (m as any)[key] = answers[key];
        m.confidence[key] = 'high';
      }
    }
    return m;
  }

  private identifyGaps(e: TeachExtraction): Gap[] {
    const gaps: Gap[] = [];
    if (e.confidence.register !== 'high') {
      gaps.push({ field: 'register', question: 'Brand or product register?' });
    }
    if (e.confidence.users !== 'high') {
      gaps.push({ field: 'users', question: 'Who are the primary users?' });
    }
    if (e.register === 'brand' && e.confidence.brandPersonality !== 'high') {
      gaps.push({ field: 'brandPersonality', question: 'Brand personality / voice / tone?' });
    }
    if (e.confidence.antiReferences !== 'high') {
      gaps.push({
        field: 'antiReferences',
        question: 'Anti-references - what should this NOT look like?',
      });
    }
    if (e.confidence.strategicPrinciples !== 'high') {
      gaps.push({
        field: 'strategicPrinciples',
        question: 'Strategic principles - 2-4 guiding design principles?',
      });
    }
    return gaps;
  }

  private summarizeExtracted(e: TeachExtraction): string[] {
    const out: string[] = [];
    if (e.register) out.push(`- register: ${e.register}`);
    if (e.users) out.push(`- users: ${e.users}`);
    if (e.brandPersonality) out.push(`- brand personality: ${e.brandPersonality}`);
    if (e.antiReferences && e.antiReferences.length > 0) {
      out.push(`- anti-references: ${e.antiReferences.join('; ')}`);
    }
    if (e.strategicPrinciples && e.strategicPrinciples.length > 0) {
      out.push(`- strategic principles: ${e.strategicPrinciples.join('; ')}`);
    }
    return out;
  }

  private generateProductMd(e: TeachExtraction): string {
    const lines: string[] = [];
    lines.push('# PRODUCT.md');
    lines.push('');
    lines.push('## Register');
    lines.push('');
    lines.push(e.register === 'brand' ? '**Brand**' : '**Product**');
    lines.push('');
    lines.push('## Primary Users');
    lines.push('');
    lines.push(e.users || '');
    lines.push('');
    if (e.register === 'brand' && e.brandPersonality) {
      lines.push('## Brand Personality');
      lines.push('');
      lines.push(e.brandPersonality);
      lines.push('');
    }
    lines.push('## Anti-References');
    lines.push('');
    lines.push('What this should NOT look like:');
    lines.push('');
    for (const a of e.antiReferences || []) {
      lines.push(`- ${a}`);
    }
    lines.push('');
    lines.push('## Strategic Principles');
    lines.push('');
    for (const p of e.strategicPrinciples || []) {
      lines.push(`- ${p}`);
    }
    lines.push('');
    return lines.join('\n');
  }
}
