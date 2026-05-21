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
const { createOrchestrator } = require('../dist/sidecoach-orchestrator');

async function main() {
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
    // Create orchestrator (loads intent detector + handlers)
    const orchestrator = createOrchestrator();

    // Process the utterance
    const result = await orchestrator.process(utterance, {
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
