#!/usr/bin/env node

/**
 * Sidecoach Monitor
 *
 * Monitors user messages for trigger patterns, detects intents,
 * and executes Sidecoach flows invisibly in the background.
 *
 * Called by: sidecoach-daemon.sh
 * Input: User utterance via stdin or --utterance flag
 * Output: Flow execution results to stdout
 */

const path = require('path');
const { createExecutionEngine } = require('../dist/sidecoach-orchestrator');

async function main() {
  const sub = process.argv[2];
  if (sub === 'lane') {
    const args = process.argv.slice(3);
    const op = args[0];
    const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt; };
    const project = flag('--project', process.cwd());
    const engine = createExecutionEngine();
    try {
      let result;
      if (op === 'start') {
        result = await engine.startLane(flag('--lane'), flag('--target', ''), { projectPath: project }, flag('--start-request-id', `cli-${process.pid}-${Date.now()}`));
      } else if (op === 'advance') {
        const transition = { action: flag('--action', 'complete'), expectedRevision: Number(flag('--revision', '0')) };
        // --report inline OR --report-file <path> (spec 790: file input). File path
        // is read, size-capped, and the same shape validation applies to both.
        const reportFile = flag('--report-file', '');
        let reportRaw = flag('--report', '');
        if (reportFile) { try { reportRaw = require('fs').readFileSync(reportFile, 'utf8'); } catch (e) { console.error(`--report-file unreadable: ${reportFile}`); process.exit(2); } }
        if (reportRaw) {
          if (reportRaw.length > 64 * 1024) { console.error('--report exceeds 64KB cap'); process.exit(2); }
          let parsed; try { parsed = JSON.parse(reportRaw); } catch { console.error('--report is not valid JSON'); process.exit(2); }
          const okEvidence = Array.isArray(parsed && parsed.evidence) && parsed.evidence.length >= 1 &&
            parsed.evidence.every((ev) => ev && typeof ev.kind === 'string' && typeof ev.detail === 'string');
          if (!parsed || typeof parsed.stepId !== 'string' || typeof parsed.reportId !== 'string' || typeof parsed.verb !== 'string' ||
              typeof parsed.summary !== 'string' || typeof parsed.iteration !== 'number' || !okEvidence) {
            console.error('--report must be a StepReport: stepId, reportId, verb, summary (strings), iteration (number), evidence[>=1] of {kind,detail} strings'); process.exit(2);
          }
          transition.report = parsed;
        }
        const reason = flag('--reason', ''); if (reason) transition.reason = reason;
        result = await engine.advanceLane(project, flag('--checkpoint'), transition);
      } else if (op === 'status') {
        result = engine.laneStatus(project, flag('--checkpoint'));
      } else if (op === 'list') {
        result = engine.listLanes(project, { all: args.includes('--all') });
      } else {
        console.error('usage: sidecoach-monitor lane <start|advance|status|list> [--lane --project --target --start-request-id --checkpoint --action --revision --report --reason --all]');
        process.exit(2);
      }
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (e) { console.error(String((e && e.message) || e)); process.exit(1); }
  }

  // Get utterance from command line or stdin
  let utterance = process.argv[2];

  if (!utterance) {
    // Try reading from stdin
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', chunk => {
        data += chunk;
      });

      process.stdin.on('end', () => {
        utterance = data.trim();
        if (!utterance) {
          console.error('No utterance provided');
          process.exit(1);
        }
        executeFlow(utterance).catch(reject).then(resolve);
      });

      process.stdin.on('error', reject);
    });
  }

  return executeFlow(utterance);
}

async function executeFlow(utterance) {
  try {
    // Create execution engine (loads intent detector + handlers)
    const engine = createExecutionEngine();

    // Process the utterance
    const result = await engine.process(utterance, {
      userId: process.env.CLAUDE_USER || 'unknown',
      projectPath: process.cwd(),
    });

    // Output results as JSON
    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      message: 'Error executing Sidecoach flow',
      error: error.message,
      stack: error.stack,
    }, null, 2));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
