#!/usr/bin/env node

/**
 * sidecoach-qa-plan - resolve and print the orchestrated QA gate
 * (audit -> critique -> polish) for a target.
 *
 *   sidecoach-qa-plan [--target <target>] [--json]
 *   sidecoach-qa-plan <target>            (bare target, same as --target)
 *
 * This is the thin CLI over src/qa-gate.ts. It resolves the gate through the
 * SAME compiled router the in-session orchestrator uses (dist/), so the printed
 * sequence is exactly what `/sidecoach audit|critique|polish <target>` would run.
 * The on-edit auto-invoke hook (claude/hooks/sidecoach-orchestrate-edit.sh) calls
 * this with --json to build its handoff; CI and humans can call it for discovery.
 *
 * Exit codes:
 *   0 = plan resolved and printed
 *   2 = usage error / failed to load the compiled orchestrator, or a gate stage
 *       failed to resolve (fail-loud: a broken gate is never printed as if valid)
 */

'use strict';

let resolveQaGate;
let qaGateToJson;
let renderQaGateText;
try {
  ({ resolveQaGate, qaGateToJson, renderQaGateText } = require('../dist/qa-gate'));
} catch (err) {
  console.error(
    'sidecoach-qa-plan: failed to load compiled orchestrator from ../dist. Run `npm run build` in sidecoach/ first.',
  );
  console.error(err && err.message ? err.message : err);
  process.exit(2);
}

function usage() {
  console.error('Usage: sidecoach-qa-plan [--target <target>] [--json]');
  console.error('       sidecoach-qa-plan <target> [--json]');
  console.error('');
  console.error('Resolves the orchestrated QA gate (audit -> critique -> polish) for a target.');
  console.error('Exit: 0 resolved, 2 usage / load error / unresolvable gate stage.');
}

function main() {
  const argv = process.argv.slice(2);
  let json = false;
  let target = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a === '--target') {
      const value = argv[++i];
      if (value === undefined) { console.error('sidecoach-qa-plan: --target needs a value'); usage(); process.exit(2); }
      target = value;
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-qa-plan: unknown option "${a}"`);
      usage();
      process.exit(2);
    } else if (!target) {
      target = a;
    } else {
      // Extra bare words are folded into the target (a prose target can be multi-word).
      target = `${target} ${a}`;
    }
  }

  let plan;
  try {
    plan = resolveQaGate(target);
  } catch (err) {
    // Fail loud: an unresolvable gate stage must never be printed as a valid plan.
    console.error(`sidecoach-qa-plan: ${err && err.message ? err.message : err}`);
    process.exit(2);
  }

  if (json) {
    process.stdout.write(qaGateToJson(plan) + '\n');
  } else {
    process.stdout.write(renderQaGateText(plan) + '\n');
  }
  process.exit(0);
}

main();
