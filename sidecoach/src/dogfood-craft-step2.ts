// Dogfood step 2: invoke /sidecoach craft on the marketing-site project.
// Craft chain: flowF (tokens) -> flowG (components) -> flowH (motion) -> flowI (a11y) -> flowJ (polish).
// Captures all guidance/checklist/artifacts/BuildReport to /tmp/sidecoach-craft-output.md.

import { FlowExecutionEngine } from './sidecoach-orchestrator';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const projectPath = '/Users/spare3/Documents/Github/claude-dotfiles/marketing-site';
const outputFile = '/tmp/sidecoach-craft-output.md';
const historyFile = path.join(os.homedir(), '.claude', 'sidecoach-flow-history.json');

async function run() {
  // Sprint 12 T2: clear persistent flow history so the dogfood probes a clean
  // chain state. Without this, latent prereq gaps get masked by stale entries
  // recorded in earlier sprints' runs.
  if (fs.existsSync(historyFile)) {
    fs.rmSync(historyFile, { force: true });
    console.log(`[dogfood] cleared flow history at ${historyFile}`);
  }

  const engine = new FlowExecutionEngine();
  const result: any = await engine.process('/sidecoach craft marketing-site', {
    projectPath,
    projectContext: { register: 'brand' },
    metadata: { emitBuildReport: true },
  } as any);

  const lines: string[] = [];
  lines.push('# Sidecoach Craft Output - claude-dotfiles marketing-site');
  lines.push('');
  lines.push(`**Project:** \`${projectPath}\``);
  lines.push(`**Top-level success:** ${result.success}`);
  lines.push(`**Message:** ${result.message || '(none)'}`);
  lines.push('');

  // Per-flow detail
  const flowResults = result.flowResults || [];
  lines.push(`## Flows executed: ${flowResults.length}`);
  lines.push('');

  for (const fr of flowResults) {
    lines.push(`### ${fr.flowId} - ${fr.status}`);
    lines.push('');
    if (fr.message) {
      lines.push(`**Message:** ${fr.message.split('\n').slice(0,3).join(' / ')}`);
      lines.push('');
    }
    if (fr.guidance && fr.guidance.length > 0) {
      lines.push(`**Guidance (${fr.guidance.length} lines):**`);
      for (const g of fr.guidance) lines.push(`- ${g}`);
      lines.push('');
    }
    if (fr.checklist && fr.checklist.length > 0) {
      lines.push(`**Checklist (${fr.checklist.length} items):**`);
      for (const c of fr.checklist) {
        const label = typeof c === 'string' ? c : (c.label || JSON.stringify(c));
        lines.push(`- [ ] ${label}`);
      }
      lines.push('');
    }
    if (fr.artifacts && fr.artifacts.length > 0) {
      lines.push(`**Artifacts (${fr.artifacts.length}):**`);
      for (const a of fr.artifacts) {
        lines.push(`- \`${a.name}\` (${a.type})`);
      }
      lines.push('');
    }
  }

  // Top-level guidance appended by orchestrator (impeccable parity)
  if (result.guidance && result.guidance.length > 0) {
    lines.push('## Top-level appended guidance (impeccable parity)');
    lines.push('');
    for (const g of result.guidance) lines.push(g);
    lines.push('');
  }

  // BuildReport
  if (result.buildReport) {
    lines.push('## BuildReport');
    lines.push('');
    lines.push(`- Verdict: ${result.buildReport.verdict}`);
    lines.push(`- Overall grade: ${result.buildReport.overallGrade}`);
    if (result.buildReport.domainGrades && result.buildReport.domainGrades.length > 0) {
      lines.push('- Domain grades:');
      for (const dg of result.buildReport.domainGrades) {
        lines.push(`  - ${dg.domain}: ${dg.letterGrade} (${dg.passRate})`);
      }
    }
    if (result.buildReport.findings && result.buildReport.findings.length > 0) {
      lines.push(`- Findings: ${result.buildReport.findings.length}`);
      for (const f of result.buildReport.findings.slice(0, 10)) {
        lines.push(`  - [${f.severity || 'info'}] ${f.message || f.location || ''}`);
      }
    }
    lines.push('');
  }

  fs.writeFileSync(outputFile, lines.join('\n') + '\n');
  console.log(`Output written to ${outputFile} (${lines.length} lines)`);
  console.log('');
  console.log('=== Summary ===');
  console.log(`success: ${result.success}`);
  console.log(`flows executed: ${flowResults.length}`);
  console.log(`flows successful: ${flowResults.filter((f: any) => f.status === 'success').length}`);
  console.log(`buildReport verdict: ${result.buildReport?.verdict || '(none)'}`);
  console.log(`buildReport grade: ${result.buildReport?.overallGrade || '(none)'}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
