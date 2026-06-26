// Dogfood runner: drives sidecoach end-to-end on the Improv marketing site brief.
// Brief: a brand-new marketing landing page for Improv that advertises justify,
// sidecoach, and memory tools, with links to two sub-pages (justify marketing + sidecoach
// marketing). Use existing Improv DESIGN.md tokens. New fonts selected by sidecoach.

import { FlowExecutionEngine } from './sidecoach-orchestrator';
import * as fs from 'fs';

const projectPath = '/Users/spare3/Documents/Github/improv';
const outputFile = '/tmp/sidecoach-dogfood-output.md';

const brief = `Build a brand new marketing landing page for Improv. The page advertises three primary products - justify, sidecoach, and the memory tools - and mentions other tools (Discord chat agent, voice output, voice transcription, cmux browser pane, reflect, design references). The index page links to two sub-pages: one marketing justify specifically, one marketing sidecoach specifically. Use the existing Improv DESIGN.md tokens for colors and brand materials. New typefaces should be selected by the system (fontshare). Aesthetic register: brand (not product). Tone: professional, technical, restrained.`;

interface Section {
  flow: string;
  utterance: string;
  metadata?: any;
}

const phases: Section[] = [
  { flow: 'flowA_brand_verify', utterance: 'verify brand foundation for Improv marketing site' },
  { flow: 'flowC_font_research', utterance: 'research typeface pairings via fontshare for restrained technical aesthetic' },
  { flow: 'flowB_component_research', utterance: 'research landing page hero + feature-grid + footer component patterns' },
  { flow: 'flowD_reference_inspiration', utterance: 'find design references for technical-product marketing pages' },
  { flow: 'flowW_landing_composition', utterance: 'compose landing page sections for brand register' },
  { flow: 'flowX_copywriting', utterance: 'draft copy for hero, three product cards, and supporting sections' },
  { flow: 'flowF_design_tokens', utterance: 'validate design tokens against DESIGN.md' },
  { flow: 'flowG_component_implementation', utterance: 'plan component implementation for the marketing site' },
  { flow: 'flowE_motion_patterns', utterance: 'design motion patterns for restrained technical aesthetic' },
  { flow: 'flowI_accessibility', utterance: 'plan accessibility validation WCAG 2.1 AA' },
  { flow: 'flowJ_tactical_polish', utterance: 'apply tactical polish 24-point standard plus extended domains' },
];

async function run() {
  const engine = new FlowExecutionEngine();
  const lines: string[] = [];
  lines.push('# Sidecoach Dogfood Output - Improv marketing site');
  lines.push('');
  lines.push(`**Brief:** ${brief}`);
  lines.push('');
  lines.push(`**Project path:** \`${projectPath}\``);
  lines.push('');

  for (const phase of phases) {
    lines.push('---');
    lines.push('');
    lines.push(`## Phase: ${phase.flow}`);
    lines.push('');
    lines.push(`**Utterance:** ${phase.utterance}`);
    lines.push('');

    try {
      // Use forceFlowId to direct each phase to the right handler (Sprint 5 bypass).
      const result: any = await engine.process(phase.utterance, {
        projectPath,
        projectContext: { register: 'brand' },
        metadata: { forceFlowId: phase.flow, emitBuildReport: true },
      } as any);

      lines.push(`**Status:** ${result.success ? 'SUCCESS' : 'FAILED'}`);
      lines.push('');
      if (result.message) {
        lines.push(`**Message:** ${result.message.replace(/\n/g, ' / ')}`);
        lines.push('');
      }

      const flowResult = (result.flowResults || [])[0] || {};
      if (flowResult.guidance && flowResult.guidance.length > 0) {
        lines.push('### Guidance');
        for (const g of flowResult.guidance.slice(0, 30)) {
          lines.push(`- ${g}`);
        }
        if (flowResult.guidance.length > 30) {
          lines.push(`- ...(${flowResult.guidance.length - 30} more)`);
        }
        lines.push('');
      }
      if (flowResult.checklist && flowResult.checklist.length > 0) {
        lines.push('### Checklist');
        for (const c of flowResult.checklist.slice(0, 20)) {
          const label = typeof c === 'string' ? c : (c.label || JSON.stringify(c));
          lines.push(`- [ ] ${label}`);
        }
        lines.push('');
      }
      if (flowResult.artifacts && flowResult.artifacts.length > 0) {
        lines.push(`### Artifacts (${flowResult.artifacts.length})`);
        for (const a of flowResult.artifacts) {
          const preview = (a.content || '').slice(0, 200).replace(/\n/g, ' ');
          lines.push(`- **${a.name}** (${a.type}): ${preview}${(a.content || '').length > 200 ? '...' : ''}`);
        }
        lines.push('');
      }
      if (result.buildReport) {
        const br = result.buildReport;
        lines.push('### Build Report');
        lines.push(`- Verdict: ${br.verdict}`);
        lines.push(`- Overall grade: ${br.overallGrade}`);
        if (br.domainGrades && br.domainGrades.length > 0) {
          lines.push('- Domain grades:');
          for (const dg of br.domainGrades) {
            lines.push(`  - ${dg.domain}: ${dg.letterGrade} (${dg.passRate})`);
          }
        }
        lines.push('');
      }
    } catch (err) {
      lines.push(`**ERROR:** ${(err as Error).message}`);
      lines.push('');
    }
  }

  // Write all collected output.
  fs.writeFileSync(outputFile, lines.join('\n') + '\n');
  console.log(`Output written to ${outputFile} (${lines.length} lines)`);

  // Quick summary to stdout.
  console.log('');
  console.log('=== Phase results summary ===');
  for (const phase of phases) {
    const headerIdx = lines.findIndex(l => l === `## Phase: ${phase.flow}`);
    if (headerIdx === -1) continue;
    const statusLine = lines[headerIdx + 4] || '';
    console.log(`  ${phase.flow}: ${statusLine}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
