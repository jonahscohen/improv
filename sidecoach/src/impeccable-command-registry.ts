/**
 * Impeccable Command Registry
 *
 * Maps impeccable verb commands (craft, polish, audit, ...) onto sidecoach
 * flow chains. Each entry carries:
 *  - flowIds: sidecoach FlowIds the verb orchestrates (in execution order)
 *  - guidanceAppend: extra guidance lines the orchestrator appends after the
 *      flow chain finishes (these turn raw flow output into a verb-shaped
 *      response that matches impeccable's voice)
 *  - parityChecklist: real substrings from impeccable's reference .md files
 *      that MUST appear in the final output so the parity test passes
 *  - parityPlus: substrings that prove sidecoach added something beyond
 *      impeccable (validators, BuildReport, taste rules, memory entry, etc.)
 *
 * Sprint 8 T1 ships the registry skeleton + 5 prototype entries (craft,
 * polish, audit, critique, document). T5 fills in the remaining 17 verbs.
 *
 * IMPECCABLE_REF resolves to the user's cached impeccable plugin skill dir.
 * Each entry's impeccableSkillPath points at the canonical reference file
 * those strings were derived from, so a future drift-audit can diff entries
 * against the current impeccable source.
 */

import type { FlowId } from './types';

export interface ImpeccableCommandEntry {
  command: string;
  description: string;
  impeccableSkillPath: string;
  phase: 'shape' | 'craft' | 'review' | 'tone' | 'docs' | 'tactical';
  flowIds: FlowId[];
  guidanceAppend: string[];
  parityChecklist: string[];
  parityPlus: string[];
}

const IMPECCABLE_REF =
  '~/.claude/plugins/cache/impeccable/impeccable/3.1.1/skills/impeccable/reference';

export const IMPECCABLE_VERB_REGISTRY: Record<string, ImpeccableCommandEntry> = {
  craft: {
    command: 'craft',
    description:
      'Build a feature with impeccable UX and UI quality: shape the design, land the visual direction, build real production code, inspect and improve in-browser until it meets a high-end studio bar.',
    impeccableSkillPath: `${IMPECCABLE_REF}/craft.md`,
    phase: 'craft',
    flowIds: [
      'flowA_brand_verify',
      'flowF_design_tokens',
      'flowG_component_implementation',
      'flowJ_tactical_polish',
    ],
    guidanceAppend: [
      'Shape brief confirmed before any code was written; gates were not compressed.',
      'Production bar enforced: real content, semantic-first markup, deliberate spacing, full state coverage.',
      'After the first pass, iterate visually against the brief and the approved direction; patch material defects and re-inspect.',
    ],
    parityChecklist: [
      'Shape brief confirmed',
      'Production bar',
      'Real content',
      'Semantic first',
      'Iterate Visually',
    ],
    parityPlus: [
      'sidecoach brand verification gate',
      'BuildReport',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  polish: {
    command: 'polish',
    description:
      'Perform a meticulous final pass to catch all the small details that separate good work from great work. The difference between shipped and polished.',
    impeccableSkillPath: `${IMPECCABLE_REF}/polish.md`,
    phase: 'tactical',
    flowIds: ['flowJ_tactical_polish', 'flowM_responsive_validation'],
    guidanceAppend: [
      'Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).',
      'Pre-polish assessment confirmed functional completeness before any cosmetic work.',
      'Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality.',
    ],
    parityChecklist: [
      'Design System Discovery',
      'Pre-Polish Assessment',
      'Polish Systematically',
      'Polish Checklist',
      'Final Verification',
    ],
    parityPlus: [
      'polish-standard domain grade',
      'taste validation',
      'BuildReport',
      'memory entry',
    ],
  },

  audit: {
    command: 'audit',
    description:
      'Run systematic technical quality checks and generate a comprehensive report. Code-level audit across 5 dimensions; do not fix issues, document them.',
    impeccableSkillPath: `${IMPECCABLE_REF}/audit.md`,
    phase: 'review',
    flowIds: ['flowK_multi_lens_audit', 'flowI_accessibility'],
    guidanceAppend: [
      'Diagnostic scan ran across accessibility, performance, theming, responsive, and anti-patterns; each scored 0-4.',
      'Anti-patterns verdict opens the report (pass/fail on the "does this look AI-generated" question) with specific tells named.',
      'Findings tagged P0-P3 with location, impact, WCAG standard, recommended fix, and the suggested follow-up command.',
    ],
    parityChecklist: [
      'Diagnostic Scan',
      'Audit Health Score',
      'Anti-Patterns Verdict',
      'Executive Summary',
      'Detailed Findings by Severity',
    ],
    parityPlus: [
      'BuildReport',
      'category-reflex detector',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  critique: {
    command: 'critique',
    description:
      'Design review via two independent assessments (LLM design director + automated detector). Combined into a single honest report with heuristic scoring, anti-patterns verdict, and persona red flags.',
    impeccableSkillPath: `${IMPECCABLE_REF}/critique.md`,
    phase: 'review',
    flowIds: ['flowL_design_critique', 'flowK_multi_lens_audit'],
    guidanceAppend: [
      'Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.',
      'Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.',
      'Persona red flags walked the primary user action for 2-3 personas relevant to this interface type.',
    ],
    parityChecklist: [
      'Gather Assessments',
      'Assessment A: LLM Design Review',
      'Assessment B: Automated Detection',
      'Design Health Score',
      'Persona Red Flags',
    ],
    parityPlus: [
      'taste validation',
      'category-reflex detector',
      'BuildReport',
      'memory entry',
    ],
  },

  document: {
    command: 'document',
    description:
      'Generate a DESIGN.md at the project root that captures the current visual design system per the Google Stitch DESIGN.md format: YAML token frontmatter plus a six-section markdown body.',
    impeccableSkillPath: `${IMPECCABLE_REF}/document.md`,
    phase: 'docs',
    // document uses a dedicated handler (T4) rather than a flow chain - it
    // reads project code and writes DESIGN.md. flowIds intentionally empty.
    flowIds: [],
    guidanceAppend: [
      'DESIGN.md follows the Google Stitch format: YAML frontmatter for tokens, markdown body with six sections in fixed order.',
      'Scan mode auto-extracted tokens from the codebase; descriptive language was confirmed with the user before writing.',
      'Output validated against the Google DESIGN.md schema lint before reporting done.',
    ],
    parityChecklist: [
      'frontmatter: token schema',
      'six sections',
      'Scan mode',
      'Seed mode',
      'design.json sidecar',
    ],
    parityPlus: [
      'Google spec lint',
      'sidecoach brand verification gate',
      'memory entry',
    ],
  },
};

export function getImpeccableVerbs(): string[] {
  return Object.keys(IMPECCABLE_VERB_REGISTRY);
}

export function getImpeccableEntry(
  command: string,
): ImpeccableCommandEntry | undefined {
  return IMPECCABLE_VERB_REGISTRY[command];
}
