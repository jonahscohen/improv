// sidecoach/scripts/generate-tool-index.ts
//
// Emits claude/skills/sidecoach/reference/tools.md - the LOADABLE index of every tool
// sidecoach ships, with each tool's literal invocation and exit-code contract.
//
// WHY IT IS GENERATED. On 2026-07-29 the hand-written tool prose in SKILL.md carried two false
// claims at once: "six self-contained CLIs" when seven shipped, and "sidecoach-drift is the
// only flow-wired tool" when sidecoach-image is flow-wired too. Both were written once by hand
// and never re-derived, and a model that reads a false claim acts on it. So the count, the
// membership, and the flow-wired set are all DERIVED here, and `--check` fails the build if the
// committed document has drifted from the code.
//
// TWO SOURCES OF TRUTH, BOTH ENFORCED IN BOTH DIRECTIONS:
//   1. bin/sidecoach.js's STANDALONE_BINS - the registry `sidecoach list` and `sidecoach help`
//      read. Parsed rather than imported because it is a const inside a CommonJS bin script
//      with no export; if that changes, import it.
//   2. The filesystem: every bin/sidecoach-*.{js,mjs,sh} on disk.
// A tool present in (2) and absent from (1) still gets a row, marked as not listed by the
// resolver, because the whole point is that nothing sidecoach ships is missing from the
// document the model loads. A tool on disk with no DESCRIPTIONS entry below is a HARD FAILURE:
// adding a bin and leaving the loadable surface silent is the exact defect this file prevents,
// so it cannot be done accidentally.
import * as fs from 'fs';
import * as path from 'path';

const SC = path.resolve(__dirname, '..');
const IMPROV = path.resolve(SC, '..');
const OUT = path.resolve(IMPROV, 'claude', 'skills', 'sidecoach', 'reference', 'tools.md');
const BIN = path.resolve(SC, 'bin');
const RESOLVER = path.resolve(BIN, 'sidecoach.js');
const SRC = path.resolve(SC, 'src');

// The entry points install.sh symlinks onto PATH. They are the front doors, not standalone
// tools, and are described separately.
const ENTRY_POINTS = new Set(['sidecoach', 'sidecoach-monitor']);

interface Desc {
  purpose: string;
  invocation: string;
  exits: string;
  reachedBy?: string;
}

// Hand-authored PROSE, mechanically enforced coverage. Every fact that can drift (the count,
// which tools the resolver lists, which tools a flow spawns) is derived below rather than
// written here.
const DESCRIPTIONS: Record<string, Desc> = {
  sidecoach: {
    purpose:
      'The verb resolver. Resolves a verb or a retired alias to its flow chain and prints the plan that would run. Full flow EXECUTION needs a session context, so this is a faithful resolver and dispatcher, not a second flow engine.',
    invocation: 'sidecoach <verb> [target] | sidecoach list | sidecoach help [verb]',
    exits: '0 resolved/listed, 1 unknown verb, 2 usage or the compiled orchestrator is missing',
  },
  'sidecoach-monitor': {
    purpose:
      'The engine entry point the skill invokes. Runs a flow chain and RENDERS the executive report itself (`renderedReport` in --json). Print that string verbatim on a text surface; the `guidance` and `checklist` fields drive your own execution and are never pasted at the user.',
    invocation: 'sidecoach-monitor "<utterance>" --json',
    exits: '0 ran, non-zero the run did not complete',
  },
  'sidecoach-palette': {
    purpose:
      'Emit a DESIGN.md palette from brand OKLCH anchors, printed ONLY when every required contrast pair passes. A palette you are holding is a palette that already cleared WCAG; exit 1 means the palette does not exist yet, not that it needs a second look.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-palette.js --brand <brand.json>',
    exits: '0 clean, 1 a required contrast pair FAILED, 2 usage, 3 inconclusive',
  },
  'sidecoach-roll': {
    purpose:
      'Draw a design direction from the deck so the choice does not come from your own ranking. A single ranked list is deterministic, which is how every run converges on the same page. `--seed` makes a draw reproducible, `--exclude` prevents a re-roll repeating a direction, `--model-top` ranks your own instinct last on purpose.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-roll.js [--seed <uint32>] [--exclude <id,...>] [--model-top]',
    exits: '0 drew, 2 usage, 3 the deck is exhausted',
  },
  'sidecoach-deck': {
    purpose:
      'Present drawn directions as a Markdown or rich-HTML pick list for the user to choose from. The user picks by responding; this tool does not decide.',
    invocation:
      'node <sidecoach-repo>/bin/sidecoach-roll.js | node <sidecoach-repo>/bin/sidecoach-deck.js --surface text|rich',
    exits: '0 presented, 2 usage',
  },
  'sidecoach-preauthor': {
    purpose:
      'The render-before-build gate. From a brief JSON it renders board.html plus mock.html and runs the rendered-audit engine over the mock, returning a fail-closed verdict BEFORE any component code is written. Exit 3 means it could not assess, which is not permission to proceed.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-preauthor.js --brief <brief.json> [--out-dir <dir>]',
    exits: '0 proceed, 1 BLOCKED, 2 usage, 3 inconclusive',
  },
  'sidecoach-image': {
    purpose:
      'Generate a raster asset AND verify the produced bytes - geometry, format, actual render, transparency, and real WCAG contrast for the text that will sit on it. Offline by default; live spend is opt-in. A generator that does not check its own output is how a broken or blank asset ships as artwork.',
    invocation:
      'node <sidecoach-repo>/bin/sidecoach-image.js generate --prompt "<brief>" --out hero.png',
    exits: '0 produced and verified, non-zero see --help for the per-mode contract',
  },
  'sidecoach-detect': {
    purpose:
      'The detection engine behind /sidecoach audit. Four lenses: static-ban (named absolute bans over raw source), static-check (the product rule registry), objective (rendered WCAG), subjective (rendered taste). It FAILS CLOSED - a lens that did not run is never counted as clean, so a partial scan with zero findings exits 3 rather than 0.',
    invocation:
      'node <sidecoach-repo>/bin/sidecoach-detect.js <target> [--no-render] [--render-url <url>] [--quiet] [--list-rules]',
    exits: '0 clean, 1 findings, 2 usage or IO error, 3 inconclusive',
    reachedBy: '/sidecoach audit',
  },
  'sidecoach-taste-ingest': {
    purpose:
      'Read-only quarantine fetcher for the self-updating taste loop. Pulls ONLY the allowlisted SKILL.md bodies named in data/taste-sources.json from the pinned expert repos, wraps each as an UNTRUSTED SOURCE EXCERPT with provenance (commit, date, license) and a sha256 diff-since-last, and NEVER fetches agent-config files, executes anything, or installs. External taste content enters as DATA for the miner to read, never as instructions; a hostile manifest still cannot cause a forbidden fetch because the SKILL.md-only allowlist is enforced in code.',
    invocation:
      'node <sidecoach-repo>/bin/sidecoach-taste-ingest.js [--check | --fetch | --offline --fixture <dir> | --verify-allowlist] [--out <dir>] [--fail-on-change]',
    exits: '0 ok, 2 usage, 3 manifest error, 4 allowlist violation, 5 network, 6 io, 10 changes detected, 70 internal',
  },
  'sidecoach-qa-plan': {
    purpose:
      'Resolve the orchestrated QA gate - audit -> critique -> polish - for a target, printing each stage with the exact slash command and the flow chain it runs. It composes three existing verbs through the SAME router the session uses, so the sequence cannot drift from the registry; it adds no routing of its own. Fails LOUD (exit 2) if any stage becomes unroutable rather than printing a broken plan.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-qa-plan.js [--target <target>] [--json]',
    exits: '0 resolved, 2 usage / load error / an unresolvable gate stage',
    reachedBy: 'claude/hooks/sidecoach-orchestrate-edit.sh (on a substantive design edit)',
  },
  'sidecoach-drift': {
    purpose:
      "Report custom-property tokens that drifted off the project's committed DESIGN.md baseline (off-system colours, radii, spacings, easings, durations), each named with its value and file. A missing baseline fails closed and never reports 'no drift'.",
    invocation: 'node <sidecoach-repo>/bin/sidecoach-drift.js <project-dir> [--json]',
    exits: '0 no drift, 1 drift, 2 usage, 3 cannot assess',
  },
  'sidecoach-refs': {
    purpose:
      'Refresh the bundled reference systems on demand, merging and preserving your /curate captures so local captures survive an upstream refresh. `--check` is a pure read.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-refs.js [--check | --apply]',
    exits: '0 ok, 2 usage, 3 upstream, 4 validation, 5 io, 10 drift, 70 internal',
  },
  'sidecoach-doctor': {
    purpose:
      "Report which sidecoach capabilities are DISCOVERABLE, REACHABLE and VERIFIED, and which are dead weight. Catches a capability that ships but is named in no loadable document, a capability nothing invokes, and a loadable document that contradicts the registry it describes. Exit 3 means a check could not run, so it is not a pass.",
    invocation: 'node <sidecoach-repo>/bin/sidecoach-doctor.js [--json] [--quiet] [--surface <dir>]',
    exits: '0 clean, 1 findings, 2 usage or unreadable input, 3 inconclusive',
    reachedBy: '/sidecoach doctor',
  },
  'sidecoach-present': {
    purpose:
      'The executive-report renderer. Turns a flow run into the deliverable blocks, before/after tables and per-rule craft notes the user reads. Required by the monitor rather than run by hand, and listed here because a report layer nothing documents is a report layer nobody can debug.',
    invocation: "required by bin/sidecoach-monitor.js (require('./sidecoach-present'))",
    exits: 'n/a - a module, not a CLI',
  },
  'sidecoach-floor': {
    purpose:
      'The craft-floor check: the quality floor and absolute bans that apply immediately before UI is edited. Wired as a hook rather than invoked by hand.',
    invocation: 'wired from claude/hooks/sidecoach-craft-floor.sh',
    exits: 'see --help',
  },
  'sidecoach-taste-check': {
    purpose:
      'The anti-pattern ban sweep that runs on an edited .html or .css inside a project carrying a DESIGN.md. A SUBSET of /sidecoach audit, not a replacement for it.',
    invocation: 'wired from claude/hooks/sidecoach-taste-gate.sh',
    exits: '0 clean, non-zero a ban fired',
  },
  'sidecoach-daemon': {
    purpose: 'Background runner for the monitor, used by the session-start wiring.',
    invocation: 'bash <sidecoach-repo>/bin/sidecoach-daemon.sh',
    exits: '0 started, non-zero could not start',
  },
  'sidecoach-artifacts': {
    purpose:
      'Artifact-listing helper. Currently reached by nothing - see the note under Dead weight below.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-artifacts.js',
    exits: 'see --help',
  },
  'sidecoach-build-report': {
    purpose:
      'BuildReport CLI. Covered by a test but reached by no flow, resolver entry or hook - see the note under Dead weight below.',
    invocation: 'node <sidecoach-repo>/bin/sidecoach-build-report.js',
    exits: 'see --help',
  },
};

function readText(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

/** The registry `sidecoach list` and `sidecoach help` enumerate. */
function parseResolverRegistry(): string[] {
  if (!fs.existsSync(RESOLVER)) {
    console.error(`generate-tool-index: ${path.relative(IMPROV, RESOLVER)} is missing - cannot derive the listed set`);
    process.exit(2);
  }
  const text = readText(RESOLVER);
  const start = text.indexOf('STANDALONE_BINS');
  if (start === -1) {
    console.error('generate-tool-index: bin/sidecoach.js has no STANDALONE_BINS registry');
    process.exit(2);
  }
  const tail = text.slice(start);
  const end = tail.indexOf('\n};');
  const block = end === -1 ? tail : tail.slice(0, end);
  const names: string[] = [];
  const re = /\[\s*'(sidecoach-[a-z-]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) names.push(m[1]);
  if (names.length === 0) {
    console.error('generate-tool-index: STANDALONE_BINS parsed to zero entries - refusing to emit a doc claiming zero tools');
    process.exit(2);
  }
  return names;
}

/** Every tool actually on disk. */
function inventory(): string[] {
  if (!fs.existsSync(BIN)) {
    console.error(`generate-tool-index: no bin directory at ${path.relative(IMPROV, BIN)}`);
    process.exit(2);
  }
  const names = fs
    .readdirSync(BIN)
    .filter((n) => /^sidecoach.*\.(js|mjs|sh)$/.test(n))
    .map((n) => n.replace(/\.(js|mjs|sh)$/, ''))
    .filter((n, i, a) => a.indexOf(n) === i)
    .sort();
  if (names.length === 0) {
    console.error('generate-tool-index: bin/ holds no sidecoach executables - refusing to emit an empty index');
    process.exit(2);
  }
  return names;
}

/** Which tools a flow actually spawns, derived from src/ rather than asserted in prose. */
function flowWired(tools: string[]): string[] {
  const srcFiles: string[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 8 || !fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        walk(p, depth + 1);
      } else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) srcFiles.push(p);
    }
  };
  walk(SRC, 0);
  const texts = srcFiles.map(readText);
  return tools.filter((t) => {
    if (ENTRY_POINTS.has(t)) return false;
    const re = new RegExp(`${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(js|mjs)`);
    return texts.some((x) => re.test(x));
  });
}

function render(): string {
  const listed = parseResolverRegistry();
  const all = inventory();
  const wired = flowWired(all);

  const missing = all.filter((t) => !DESCRIPTIONS[t]);
  if (missing.length > 0) {
    console.error(
      `generate-tool-index: ${missing.join(', ')} ship${missing.length === 1 ? 's' : ''} in bin/ with no entry in DESCRIPTIONS.\n` +
        'A tool that ships without a row in the loadable index is exactly the defect this generator exists to prevent.\n' +
        'Add it to DESCRIPTIONS in scripts/generate-tool-index.ts and re-run the build.'
    );
    process.exit(2);
  }
  const stale = Object.keys(DESCRIPTIONS).filter((t) => !all.includes(t));
  if (stale.length > 0) {
    console.error(
      `generate-tool-index: DESCRIPTIONS describes ${stale.join(', ')}, which no longer ship in bin/.\n` +
        'A loadable document naming a tool that does not exist is worse than one that omits it.\n' +
        'Remove the entr' + (stale.length === 1 ? 'y' : 'ies') + ' from scripts/generate-tool-index.ts.'
    );
    process.exit(2);
  }

  const standalone = all.filter((t) => !ENTRY_POINTS.has(t));
  const unlisted = standalone.filter((t) => !listed.includes(t));
  const deadWeight = ['sidecoach-artifacts', 'sidecoach-build-report'].filter((t) => all.includes(t));

  const L: string[] = [];
  L.push('# tools: every tool sidecoach ships, with its invocation and exit contract');
  L.push('');
  L.push('<!-- GENERATED by sidecoach/scripts/generate-tool-index.ts - do not hand-edit.');
  L.push('     Every count and every membership claim below is derived from bin/sidecoach.js and');
  L.push('     bin/ on disk, because the hand-written version of this table shipped two false');
  L.push('     claims at once. `npm run build` fails if this file drifts from the code. -->');
  L.push('');
  L.push(
    'Load this when a flow or a verb reaches for a tool, when you need an exit contract before' +
      '\nacting on a result, or when you are about to hand-roll something sidecoach already ships.'
  );
  L.push('');
  L.push('## Read the exit codes before you act on a result');
  L.push('');
  L.push('Every tool here is FAIL-CLOSED and the contracts are not interchangeable. **A nonzero');
  L.push('exit never means clean.** In particular `3` means the check could not be performed, so a');
  L.push('`3` with no findings is unverified rather than passing, and treating it as a pass is how a');
  L.push('scan that never ran gets reported as a clean bill of health. This is a real difference');
  L.push('from the tools that exit 0 when they could not do their job.');
  L.push('');
  L.push(`## Entry points (${all.filter((t) => ENTRY_POINTS.has(t)).length}) - on PATH after install`);
  L.push('');
  for (const t of all.filter((x) => ENTRY_POINTS.has(x))) {
    const d = DESCRIPTIONS[t];
    L.push(`### \`${t}\``);
    L.push('');
    L.push(d.purpose);
    L.push('');
    L.push('```');
    L.push(d.invocation);
    L.push('```');
    L.push('');
    L.push(`Exit: ${d.exits}`);
    L.push('');
  }
  L.push(`## Standalone tools (${standalone.length})`);
  L.push('');
  L.push(
    `Of these, ${listed.length} are enumerated by \`sidecoach list\` and \`sidecoach help\`` +
      (unlisted.length
        ? `, and ${unlisted.length} are not (${unlisted.map((t) => `\`${t}\``).join(', ')}) - those are reached by a hook, a module require, or nothing at all, and each row says which.`
        : '.')
  );
  L.push('');
  L.push(
    wired.length
      ? `Flow-invoked, derived from \`src/\` rather than asserted: ${wired.map((t) => `\`${t}\``).join(', ')}. Every other tool here is run by you or by the user, never automatically.`
      : 'No tool here is currently invoked automatically by a flow.'
  );
  L.push('');
  for (const t of standalone) {
    const d = DESCRIPTIONS[t];
    const tags: string[] = [];
    tags.push(listed.includes(t) ? 'listed by the resolver' : 'not listed by the resolver');
    if (wired.includes(t)) tags.push('flow-invoked');
    if (d.reachedBy) tags.push(`reached by ${d.reachedBy}`);
    L.push(`### \`${t}\``);
    L.push('');
    L.push(`_${tags.join(' | ')}_`);
    L.push('');
    L.push(d.purpose);
    L.push('');
    L.push('```');
    L.push(d.invocation);
    L.push('```');
    L.push('');
    L.push(`Exit: ${d.exits}`);
    L.push('');
  }
  if (deadWeight.length) {
    L.push('## Dead weight, named on purpose');
    L.push('');
    L.push(
      `${deadWeight.map((t) => `\`${t}\``).join(' and ')} ship in \`bin/\` and are reached by nothing - no flow spawns them,` +
        '\nno other tool requires them, no hook wires them, and the resolver does not list them. They are' +
        '\nlisted here rather than quietly omitted because an undocumented orphan gets rediscovered every' +
        '\nfew months and re-investigated from scratch. `sidecoach doctor` reports them as `capability-unreached`' +
        '\nevery run; the two honest resolutions are to wire them or to retire them.'
    );
    L.push('');
  }
  L.push('## Related');
  L.push('');
  L.push('- `new-work.md` - the flow that invokes most of these, in order, with a gate per step.');
  L.push('- `doctor.md` - how to read the report that checks this index against the code.');
  L.push('- `routing.md` - which verb owns a request.');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// SHARED REFERENCE DOCS: the four playbooks that lived only in sidecoach/reference/.
//
// SKILL.md named three of them by the repo path `sidecoach/reference/<name>.md`. That path does
// not exist relative to the installed skill directory, so a model that loaded the skill and
// followed the pointer found nothing - three documents that were NAMED and UNREACHABLE, which
// is the same defect class as a tool named in no document, just pointing the other way.
//
// They are vendored into the loadable surface here, with --check asserting no drift, which is
// the same idiom generate-lanes-data.ts already uses for the vendored lane registry. The copy
// direction is one-way: sidecoach/reference/ is the source, the skill copy is derived. Editing
// the derived copy fails the build rather than silently winning.
const SHARED_REFS = [
  'a11y-remediation.md',
  'design-judgment-rules.md',
  'responsive-foundation.md',
  'robustness-stress-checklist.md',
];
const REF_SRC = path.resolve(SC, 'reference');
const REF_DST = path.resolve(IMPROV, 'claude', 'skills', 'sidecoach', 'reference');

function syncSharedReferences(check: boolean): boolean {
  let drift = false;
  for (const name of SHARED_REFS) {
    const src = path.resolve(REF_SRC, name);
    const dst = path.resolve(REF_DST, name);
    if (!fs.existsSync(src)) {
      console.error(
        `generate-tool-index: ${path.relative(IMPROV, src)} is missing, but SKILL.md links to it in the loadable surface.\n` +
          'Either restore the source or remove the link - a document the skill points at and cannot open is worse than no link.'
      );
      process.exit(2);
    }
    const want = readText(src);
    if (check) {
      if (!fs.existsSync(dst)) {
        console.error(`generate-tool-index --check: ${path.relative(IMPROV, dst)} is missing. Run \`npm run build\`.`);
        drift = true;
        continue;
      }
      if (readText(dst) !== want) {
        console.error(
          `generate-tool-index --check: ${path.relative(IMPROV, dst)} has DRIFTED from ${path.relative(IMPROV, src)}.\n` +
            'The loadable copy is derived, never the source. Run `npm run build` and commit the result.'
        );
        drift = true;
      }
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, want);
  }
  return drift;
}

function main() {
  const check = process.argv.includes('--check');
  const refDrift = syncSharedReferences(check);
  if (check && refDrift) process.exit(1);
  const out = render();
  if (check) {
    if (!fs.existsSync(OUT)) {
      console.error(`generate-tool-index --check: ${path.relative(IMPROV, OUT)} is missing. Run \`npm run build\`.`);
      process.exit(1);
    }
    const have = readText(OUT);
    if (have !== out) {
      console.error(
        `generate-tool-index --check: ${path.relative(IMPROV, OUT)} has DRIFTED from bin/sidecoach.js and bin/.\n` +
          'The loadable tool index no longer describes the tools that ship. Run `npm run build` and commit the result.'
      );
      process.exit(1);
    }
    console.log('generate-tool-index --check: OK (the loadable tool index matches the shipped tools)');
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log(`generate-tool-index: wrote ${path.relative(IMPROV, OUT)}`);
}

main();
