#!/usr/bin/env node

/**
 * sidecoach - terminal CLI that mirrors the /sidecoach slash-command surface.
 *
 *   sidecoach <verb> [target...]     resolve a verb to its flow chain
 *   sidecoach teach [brief]          setup: generate PRODUCT.md
 *   sidecoach document               setup: generate DESIGN.md
 *   sidecoach list                   enumerate verbs and flows
 *   sidecoach help [verb]            help; with an arg, registry detail
 *
 * The retired one-word modes (forge/kiln/bloom/trim/ralph) are no longer a
 * supported surface and are not listed, but they STILL resolve as deprecated
 * back-compat aliases so existing scripts keep working (vocab collapse, GAP5).
 *
 * `sidecoach craft "a pricing page"` invokes the SAME verb->flow resolution
 * that `/sidecoach craft a pricing page` does in-session: both call
 * parseSlashCommand() from the compiled orchestrator. There is no parallel
 * mapping here - the verb->flow source of truth is the single shared
 * VERB_REGISTRY (sidecoach/src/verb-command-registry.ts), consumed via dist/
 * exactly as the MCP server and the in-session orchestrator consume it.
 *
 * EXECUTION LIMITATION: full flow execution needs a FlowExecutionContext that
 * only exists inside a Claude session (model dispatch, project context, the
 * browser surface). This CLI is therefore a faithful resolver + dispatcher: it
 * resolves the verb/mode to its flow chain, prints the plan that WOULD run
 * (flow chain, per-flow model tier, phase, guidance), and exits 0. It does not
 * fabricate a parallel flow engine. Use it for scripting, CI gating, and
 * discovery; run the slash command in-session for actual execution.
 *
 * `help` and `list` work fully offline/standalone.
 *
 * Exit codes:
 *   0 = success (resolved / listed / help shown)
 *   1 = unknown verb or mode
 *   2 = usage error / failed to load compiled orchestrator
 */

'use strict';

// ---------------------------------------------------------------------------
// Load the compiled orchestrator modules. These are the SAME dist/ artifacts
// the in-session orchestrator reads. If they are missing the project has not
// been built yet.
// ---------------------------------------------------------------------------
let parseSlashCommand;
let VERB_REGISTRY;
let getVerbEntry;
let getFlow;
let flows;
let FLOW_MODELS;
try {
  ({ parseSlashCommand } = require('../dist/slash-command-router'));
  ({ VERB_REGISTRY, getVerbEntry } = require('../dist/verb-command-registry'));
  // The retired one-word mode words (forge/kiln/bloom/trim/ralph) now resolve as
  // deprecated back-compat aliases in PHASE_ALIASES (slash-command-router), routed
  // through parseSlashCommand below exactly like the retired phase words - there is
  // no separate modes module to load anymore.
  ({ getFlow, flows } = require('../dist/flows'));
  ({ FLOW_MODELS } = require('../dist/model-routing'));
} catch (err) {
  console.error(
    'sidecoach: failed to load compiled orchestrator from ../dist. Run `npm run build` in sidecoach/ first.\n'
  );
  console.error(err && err.message ? err.message : err);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ordered phase grouping for verbs, keyed by the registry `phase` field. */
const PHASE_ORDER = ['shape', 'craft', 'tone', 'review', 'tactical', 'docs'];
const PHASE_LABEL = {
  shape: 'Shape / strategy',
  craft: 'Build',
  tone: 'Tone',
  review: 'Review',
  tactical: 'Tactical',
  docs: 'Docs',
};

// Setup commands that resolve through parseSlashCommand but run via dedicated
// handlers (no flow chain). Kept here only for help/list labelling.
const SETUP_COMMANDS = {
  teach: 'Brief-driven setup: parse the brief, ask for gaps, write PRODUCT.md',
  document: 'Generate Google-spec DESIGN.md (token frontmatter + six sections) from project HTML/CSS',
};

function verbList() {
  return Object.keys(VERB_REGISTRY);
}

function tierFor(flowId) {
  const cfg = FLOW_MODELS[flowId];
  if (!cfg) return '?';
  return cfg.preferredTier === cfg.minTier
    ? cfg.preferredTier
    : `${cfg.preferredTier} (min ${cfg.minTier})`;
}

function flowName(flowId) {
  const f = getFlow(flowId);
  return f ? f.name : '(unknown flow)';
}

function printFlowChain(flowIds, indent) {
  const pad = indent || '  ';
  if (!flowIds || flowIds.length === 0) {
    console.log(`${pad}(no flow chain - dedicated handler runs in-session)`);
    return;
  }
  flowIds.forEach((id, i) => {
    console.log(`${pad}${i + 1}. ${id}`);
    console.log(`${pad}   ${flowName(id)}  [model: ${tierFor(id)}]`);
  });
}

// ---------------------------------------------------------------------------
// help (top-level + per verb)
// ---------------------------------------------------------------------------

function topLevelHelp() {
  console.log('sidecoach - terminal mirror of the /sidecoach slash-command surface');
  console.log('');
  console.log('Usage:');
  console.log('  sidecoach <verb> [target...]   resolve a verb to its flow chain');
  console.log('  sidecoach teach [brief]        setup: generate PRODUCT.md');
  console.log('  sidecoach document             setup: generate DESIGN.md');
  console.log('  sidecoach list                 enumerate verbs and flows');
  console.log('  sidecoach help [verb]          this help, or registry detail for one');
  console.log('');

  // Verbs grouped by phase.
  const byPhase = {};
  for (const [verb, entry] of Object.entries(VERB_REGISTRY)) {
    (byPhase[entry.phase] = byPhase[entry.phase] || []).push(verb);
  }
  console.log(`Verbs (${verbList().length}):`);
  for (const phase of PHASE_ORDER) {
    const verbs = byPhase[phase];
    if (!verbs || verbs.length === 0) continue;
    console.log(`  ${PHASE_LABEL[phase] || phase}: ${verbs.join(', ')}`);
  }
  console.log('');

  console.log('Setup:');
  for (const [cmd, desc] of Object.entries(SETUP_COMMANDS)) {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  }
  console.log('');
  console.log('Run `sidecoach help <verb>` for a verb\'s flow chain and guidance,');
  console.log('or `sidecoach list` for the full flow enumeration.');
  console.log('');
  console.log('Deprecated phase and mode words (research/implement/.., forge/kiln/..)');
  console.log('are not a supported surface but still resolve for back-compat.');
  console.log('');
  console.log('Note: this CLI resolves and prints the plan that would run. Full flow');
  console.log('execution happens in a Claude session (`/sidecoach <verb>`).');
}

function helpForTarget(target) {
  const name = target.toLowerCase();

  // Verb detail.
  const entry = getVerbEntry(name);
  if (entry) {
    console.log(`verb: ${entry.command}   [phase: ${entry.phase}]`);
    console.log('');
    console.log(entry.description);
    console.log('');
    console.log('Flow chain:');
    printFlowChain(entry.flowIds);
    if (entry.guidanceAppend && entry.guidanceAppend.length) {
      console.log('');
      console.log('Guidance appended after the chain:');
      entry.guidanceAppend.forEach((g) => console.log(`  - ${g}`));
    }
    if (entry.parityPlus && entry.parityPlus.length) {
      console.log('');
      console.log('Sidecoach adds (beyond the legacy skill):');
      entry.parityPlus.forEach((p) => console.log(`  - ${p}`));
    }
    console.log('');
    console.log(`Reference: ${entry.skillRefPath}`);
    return 0;
  }

  // Setup command detail.
  if (SETUP_COMMANDS[name]) {
    console.log(`command: ${name}   (setup)`);
    console.log('');
    console.log(SETUP_COMMANDS[name]);
    console.log('');
    console.log('Runs via a dedicated handler in-session; no flow chain to resolve.');
    return 0;
  }

  console.error(`sidecoach: no verb named "${target}".`);
  console.error(`Valid verbs: ${verbList().join(', ')}`);
  return 1;
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

function listAll() {
  console.log(`Verbs (${verbList().length}) -> flow chains:`);
  console.log('');
  const byPhase = {};
  for (const [verb, entry] of Object.entries(VERB_REGISTRY)) {
    (byPhase[entry.phase] = byPhase[entry.phase] || []).push([verb, entry]);
  }
  for (const phase of PHASE_ORDER) {
    const entries = byPhase[phase];
    if (!entries) continue;
    console.log(`  [${PHASE_LABEL[phase] || phase}]`);
    for (const [verb, entry] of entries) {
      const chain = entry.flowIds.length
        ? entry.flowIds.join(' -> ')
        : '(dedicated handler, no flow chain)';
      console.log(`    ${verb.padEnd(10)} ${chain}`);
    }
  }
  console.log('');

  console.log(`Flows (${flows.length}) - the underlying registry:`);
  for (const f of flows) {
    console.log(`  ${f.id}`);
    console.log(`    ${f.name}  [model: ${tierFor(f.id)}]`);
  }
}

// ---------------------------------------------------------------------------
// verb / alias resolution (the dispatch path)
// ---------------------------------------------------------------------------

function resolveAndPrint(command, target) {
  // Route through the SAME parser the slash command uses. Verbs, retired phase
  // words, and retired mode words (forge/kiln/..) all resolve here now - the mode
  // words are back-compat aliases in PHASE_ALIASES, no longer a separate path.
  const slash = `/sidecoach ${command}${target ? ' ' + target : ''}`;
  const result = parseSlashCommand(slash);

  if (!result.isCommand) {
    console.error(`sidecoach: ${result.reason}`);
    console.error('');
    console.error(`Valid verbs: ${verbList().join(', ')}`);
    console.error(`Setup: ${Object.keys(SETUP_COMMANDS).join(', ')}`);
    console.error('Run `sidecoach help` for the full surface.');
    return 1;
  }

  // Setup commands (teach / document and other empty-chain commands).
  if (result.flowIds.length === 0) {
    console.log(`Resolved command: ${result.command}${result.target ? `   target: ${result.target}` : ''}`);
    console.log(result.reason);
    console.log('');
    if (SETUP_COMMANDS[result.command]) {
      console.log(SETUP_COMMANDS[result.command]);
    }
    console.log('No flow chain - runs via a dedicated handler in a Claude session.');
    return 0;
  }

  console.log(`Resolved verb: ${result.command}${result.target ? `   target: ${result.target}` : ''}`);
  console.log(result.reason);
  console.log('');
  console.log('Flow plan (would run in-session, execution order):');
  printFlowChain(result.flowIds);
  console.log('');
  console.log('Resolver only - run `' + slash.trim() + '` in a session to execute.');
  return 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    topLevelHelp();
    process.exit(0);
  }

  const cmd = argv[0].toLowerCase();

  // Top-level help flags.
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    const target = argv[1];
    if (target) {
      process.exit(helpForTarget(target));
    }
    topLevelHelp();
    process.exit(0);
  }

  if (cmd === 'list' || cmd === '--list') {
    listAll();
    process.exit(0);
  }

  // Per-verb help: `sidecoach craft --help` / `-h`.
  const rest = argv.slice(1);
  if (rest.includes('--help') || rest.includes('-h')) {
    process.exit(helpForTarget(cmd));
  }

  const target = rest.join(' ').trim();
  process.exit(resolveAndPrint(cmd, target));
}

main();
