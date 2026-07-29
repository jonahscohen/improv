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

// Standalone sibling bins that ship alongside this resolver. They are NOT verbs
// or flows - each is its own self-contained CLI with its own exit-code contract -
// but they are part of the sidecoach surface, so `list` and `help` enumerate them
// here to make them discoverable and reachable (grouped by role).
//
// Each entry is [bin, one-line purpose, primary invocation, flowWiring]. The
// fourth element is the load-bearing one and it is why this table is the single
// source of truth rather than one of two: a bin with a non-null `flowWiring` is
// AUTO-RUN by the named flows, and the skill document must say so.
//
// WHY THE FOURTH FIELD EXISTS (2026-07-29). The skill text carried two statements
// that were not merely stale but actively false: it counted six of these tools
// when there were seven, and it said drift was the only flow-wired one and "the
// other five are invoked directly, not auto-run by a flow" - while sidecoach-image
// was already auto-run by flow D. An omission leaves a reader with a gap; that
// sentence filled the gap with a wrong answer, so a model reading it concluded it
// had to do all image work by hand. Both facts are derivable from this table, and
// `src/__tests__/skill-surface-parity.test.ts` now asserts the skill document
// agrees with `sidecoach list --json`. Nothing checked that before, which is
// exactly how they drifted apart.
const STANDALONE_BINS = {
  generative: {
    label: 'Generative (authoring aids)',
    bins: [
      ['sidecoach-palette', 'Emit a WCAG-verified DESIGN.md palette from brand OKLCH anchors', 'node bin/sidecoach-palette.js --brand <brand.json>', null],
      ['sidecoach-roll', 'Draw a design direction from the deck (seeded = reproducible)', 'node bin/sidecoach-roll.js [--seed <uint32>]', null],
      ['sidecoach-preauthor', 'Render-before-build gate: board + mock from a brief, fail-closed proceed/block', 'node bin/sidecoach-preauthor.js --brief <brief.json>', null],
      ['sidecoach-deck', 'Present drawn directions as a Markdown or rich-HTML pick list', 'node bin/sidecoach-roll.js | node bin/sidecoach-deck.js', null],
      [
        'sidecoach-image',
        'Generate a raster asset AND verify the bytes (offline by default; live spend is opt-in)',
        'node bin/sidecoach-image.js generate --prompt "<brief>" --out hero.png',
        'flowD (design references) as the concept-sketch lens, and flowG (component implementation) as the asset-production lens',
      ],
    ],
  },
  governance: {
    label: 'Governance (checks / maintenance)',
    bins: [
      ['sidecoach-refs', 'Refresh the bundled reference systems on demand, preserving your captures', 'node bin/sidecoach-refs.js [--check | --apply]', null],
      [
        'sidecoach-drift',
        'Report custom-property tokens drifted from DESIGN.md (also feeds the audit flow)',
        'node bin/sidecoach-drift.js <project-dir>',
        'flowK (multi-lens audit) as the Theming token-drift lens',
      ],
    ],
  },
};

/** Every standalone bin as flat records. The machine-readable surface `list --json` and the parity test read. */
function standaloneBinRecords() {
  const out = [];
  for (const [group, { label, bins }] of Object.entries(STANDALONE_BINS)) {
    for (const [bin, purpose, invocation, flowWiring] of bins) {
      out.push({ bin, group, groupLabel: label, purpose, invocation, flowWiring: flowWiring || null, flowWired: Boolean(flowWiring) });
    }
  }
  return out;
}

/** Look up a standalone bin by name (accepts `sidecoach-drift` or bare `drift`). */
function findStandaloneBin(name) {
  const want = name.startsWith('sidecoach-') ? name : `sidecoach-${name}`;
  for (const group of Object.values(STANDALONE_BINS)) {
    const entry = group.bins.find(([bin]) => bin === want);
    if (entry) return { groupLabel: group.label, entry };
  }
  return null;
}

function printStandaloneBins(detailed) {
  for (const group of Object.values(STANDALONE_BINS)) {
    console.log(`  ${group.label}`);
    for (const [bin, purpose, invocation, flowWiring] of group.bins) {
      if (detailed) {
        console.log(`    ${bin}`);
        console.log(`      ${purpose}`);
        console.log(`      $ ${invocation}`);
        // A flow-wired tool runs whether or not anyone invokes it by hand. That is the single most useful thing
        // to know about one of these, so `list` says it rather than leaving it to a paragraph elsewhere.
        if (flowWiring) console.log(`      auto-run by: ${flowWiring}`);
      } else {
        console.log(`    ${bin.padEnd(20)} ${purpose}${flowWiring ? ' [auto-run by a flow]' : ''}`);
      }
    }
  }
}

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
  console.log('  sidecoach counter-rules [prov] classes a model over-produces (Stage 1c defect-mining)');
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

  console.log('Standalone tools (each is its own CLI - run `node bin/<tool>.js --help` for options):');
  printStandaloneBins(false);
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

  // Standalone-bin detail (accepts `sidecoach-drift` or bare `drift`).
  const binHit = findStandaloneBin(name);
  if (binHit) {
    const [bin, purpose, invocation] = binHit.entry;
    console.log(`tool: ${bin}   (standalone CLI - ${binHit.groupLabel})`);
    console.log('');
    console.log(purpose);
    console.log('');
    console.log(`  $ ${invocation}`);
    console.log('');
    console.log(`Run \`node bin/${bin}.js --help\` for its full options and exit-code contract.`);
    if (bin === 'sidecoach-drift') {
      console.log('Also invoked by the audit flow (flowK) as its Theming token-drift lens.');
    }
    if (bin === 'sidecoach-image') {
      console.log('Also invoked by the design-references flow (flowD, reached by `sidecoach craft` and `sidecoach colorize`)');
      console.log('as its concept-sketch lens, in offline mode, which never spends.');
      console.log('A generated asset is only reported as verified when its own bytes pass the contract:');
      console.log('geometry, format, a real rendered image rather than a blank, and contrast where text will sit.');
    }
    return 0;
  }

  console.error(`sidecoach: no verb or tool named "${target}".`);
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
  console.log('');

  const binCount = Object.values(STANDALONE_BINS).reduce((n, g) => n + g.bins.length, 0);
  console.log(`Standalone tools (${binCount}) - sibling CLIs on the sidecoach surface:`);
  printStandaloneBins(true);
  console.log('');
  console.log('Each standalone tool has its own exit-code contract; run `node bin/<tool>.js --help`,');
  console.log('or `sidecoach help <tool>` for its purpose and invocation.');
  console.log('`sidecoach-drift` also feeds the audit flow (flowK) as its token-drift lens.');
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
// counter-rules: print the Stage 1c provider-specific defect counter-rules -
// the classes a given model over-produces (from the committed defect-mining
// distribution), so a builder can watch for them. YOU name the provider; the
// CLI never guesses which model you are building with (sidecoach advises, it
// does not know your target model).
// ---------------------------------------------------------------------------
function printCounterRules(provider) {
  let mod;
  try {
    mod = require('../dist/counter-rules.generated');
  } catch (err) {
    console.error('sidecoach: counter-rules unavailable - run `npm run build` in sidecoach/ first.');
    return 2;
  }
  const { COUNTER_RULES, counterRulesForProvider } = mod;
  const providers = Array.from(new Set(COUNTER_RULES.map((r) => r.provider))).sort();

  if (!provider) {
    console.log('sidecoach counter-rules - classes each model over-produces (Stage 1c defect-mining).');
    console.log('');
    console.log(`Providers with counter-rules (${providers.length}): ${providers.join(', ')}`);
    console.log('');
    console.log('Pass one to see its watch-list, e.g. `sidecoach counter-rules claude`.');
    console.log('Advisory: name the model you are building with - sidecoach does not guess it.');
    return 0;
  }

  const key = provider.toLowerCase();
  const rules = counterRulesForProvider(key);
  if (rules.length === 0) {
    console.log(`No counter-rules for provider "${provider}".  Known: ${providers.join(', ')}.`);
    return providers.includes(key) ? 0 : 1;
  }
  console.log(`Counter-rules for ${key} - classes it over-produces, watch for these (Stage 1c):`);
  console.log('');
  for (const r of rules) console.log(`  ${r.guidance}`);
  console.log('');
  console.log(`${rules.length} class(es), most-fired first. Source: eval/corpus/defect-distribution.json.`);
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
    // `--json` is the machine-readable surface. It exists so a checker (and a caller that wants to branch on
    // availability rather than parse prose) reads the same table `list` prints, instead of a second copy that can
    // disagree with it.
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ tool: 'sidecoach', command: 'list', standaloneBins: standaloneBinRecords() }, null, 2));
      process.exit(0);
    }
    listAll();
    process.exit(0);
  }

  // Stage 1c: provider-specific defect counter-rules (you name the provider).
  if (cmd === 'counter-rules' || cmd === 'counter_rules' || cmd === 'counterrules') {
    process.exit(printCounterRules(argv[1]));
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
