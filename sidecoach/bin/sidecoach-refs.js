#!/usr/bin/env node

/**
 * sidecoach-refs - on-demand updater for the five bundled reference systems.
 *
 * The thin CLI over src/reference-update-service.ts. It reports which bundled
 * reference systems are stale relative to the upstream that ships with sidecoach
 * (`--check`, a pure read that changes nothing) and, on request, refreshes the
 * local user-owned copy from upstream while MERGING the user's own captured
 * references so none are lost (`--apply`). No network I/O, no scheduler: "update"
 * means "refresh the local copy from the bundles that shipped with this install."
 *
 * The differentiator vs a hosted reference catalog: the bundles are LOCAL and
 * USER-OWNED, and an apply is union-preserving - captures already in the local
 * copy AND captures in the ~/.claude/design-references curate catalog both survive
 * an upstream refresh. A capture is never clobbered.
 *
 * LOADING: prefers the TypeScript source via ts-node when it is resolvable (dev
 * checkouts), falling back to the compiled dist build (installed packages). If
 * neither loads it fails loud rather than pretending to run.
 *
 * OUTPUT
 *   stdout - a per-system status table (or the full result JSON with --json). Every
 *            system is always printed, on every run, so the exit code is never the
 *            only signal and a failure is never silent.
 *   stderr - a one-line human summary (suppress with --quiet).
 *
 * EXIT CODES (one per outcome class; nonzero always means "no clean success")
 *   0  = ok            check: every system current | apply: every requested write done (or nothing to do)
 *   2  = usage error   unknown flag or bad argument
 *   3  = upstream      an upstream bundle was missing/unreadable/invalid JSON  -> nothing written
 *   4  = validation    a merged bundle failed structural validation            -> nothing written
 *   5  = io            a local write failed                                     -> local left intact
 *   10 = drift         (--check only) one or more systems are stale/not-installed; no errors
 *   70 = internal      the service could not be loaded, or an unexpected error
 *
 * When an apply hits multiple error classes at once the exit code is the most
 * fundamental one that occurred (upstream 3 > validation 4 > io 5); the per-system
 * table still shows every class.
 */

'use strict';

const path = require('path');

const EXIT = {
  OK: 0,
  USAGE: 2,
  UPSTREAM: 3,
  VALIDATION: 4,
  IO: 5,
  DRIFT: 10,
  INTERNAL: 70,
};

// A module is only usable if it exposes the API this CLI drives. This guards against
// loading a stale compiled build whose exports predate this CLI - better to fail loud
// (exit 70) than to crash with an uncaught TypeError deep in the run.
function isUsableService(mod) {
  return mod && typeof mod.ReferenceUpdateService === 'function' && Array.isArray(mod.REFERENCE_SYSTEMS);
}

function loadService() {
  const errors = [];
  // Prefer fresh TypeScript source in a dev checkout.
  try {
    require.resolve('ts-node/register/transpile-only');
    require('ts-node/register/transpile-only');
    const mod = require('../src/reference-update-service');
    if (isUsableService(mod)) return mod;
    errors.push('ts-node src: loaded but missing expected exports');
  } catch (tsErr) {
    errors.push(`ts-node src: ${tsErr && tsErr.message}`);
  }
  // Fall back to the compiled build in an installed package.
  try {
    const mod = require('../dist/reference-update-service');
    if (isUsableService(mod)) return mod;
    errors.push('dist build: loaded but missing expected exports (stale build? run `npm run build` in sidecoach/)');
  } catch (distErr) {
    errors.push(`dist build: ${distErr && distErr.message}`);
  }
  process.stderr.write(
    'sidecoach-refs: could not load a usable reference-update service.\n' +
      errors.map((e) => `  ${e}\n`).join('') +
      '  In a dev checkout run `npm install`; in an installed package run `npm run build` in sidecoach/.\n'
  );
  process.exit(EXIT.INTERNAL);
}

const HELP = `sidecoach-refs - update the bundled design reference systems (on demand)

USAGE
  node bin/sidecoach-refs.js [--check | --apply] [options]

ACTIONS
  --check            Dry run (default). Report each system's status vs upstream.
                     Changes nothing on disk.
  --apply            Refresh stale / not-installed systems into the local copy,
                     merging user captures. Use --all to rewrite every system.

OPTIONS
  --all              With --apply, process all systems, not just stale ones.
  --systems <csv>    Limit to a comma-separated subset (e.g. fontshare,icon-source).
  --upstream <dir>   Canonical read-only bundles (default: repo bundles/).
  --local <dir>      Writable user-owned copy (default: ~/.claude/sidecoach/reference-bundles).
  --captures <dir>   The /curate catalog (default: ~/.claude/design-references).
  --design-md <path> DESIGN.md to stamp with installed versions (default: ./DESIGN.md).
  --no-design-md     Do not touch DESIGN.md on apply.
  --json             Emit machine-readable JSON instead of the table.
  --quiet            Suppress the stderr summary line.
  --help             Show this help.

EXIT CODES
  0 ok   2 usage   3 upstream   4 validation   5 io   10 drift (--check)   70 internal
`;

function parseArgs(argv) {
  const opts = {
    action: null, // 'check' | 'apply'
    all: false,
    systems: null,
    upstreamDir: undefined,
    localDir: undefined,
    capturesDir: undefined,
    designMdPath: undefined,
    noDesignMd: false,
    json: false,
    quiet: false,
    help: false,
  };
  const takesValue = new Set(['--systems', '--upstream', '--local', '--captures', '--design-md']);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const needsValue = takesValue.has(arg);
    let value;
    if (needsValue) {
      value = argv[++i];
      if (value === undefined) return { error: `flag ${arg} needs a value` };
    }
    switch (arg) {
      case '--check': opts.action = 'check'; break;
      case '--apply': opts.action = 'apply'; break;
      case '--all': opts.all = true; break;
      case '--systems': opts.systems = value.split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--upstream': opts.upstreamDir = path.resolve(value); break;
      case '--local': opts.localDir = path.resolve(value); break;
      case '--captures': opts.capturesDir = path.resolve(value); break;
      case '--design-md': opts.designMdPath = path.resolve(value); break;
      case '--no-design-md': opts.noDesignMd = true; break;
      case '--json': opts.json = true; break;
      case '--quiet': opts.quiet = true; break;
      case '--help':
      case '-h': opts.help = true; break;
      default:
        return { error: `unknown flag: ${arg}` };
    }
  }
  if (!opts.action) opts.action = 'check';
  return { opts };
}

function validateSystems(requested, known) {
  if (!requested) return { ok: true };
  const bad = requested.filter((s) => !known.includes(s));
  if (bad.length) return { ok: false, error: `unknown system(s): ${bad.join(', ')} (known: ${known.join(', ')})` };
  return { ok: true };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`sidecoach-refs: ${parsed.error}\n\n${HELP}`);
    process.exit(EXIT.USAGE);
  }
  const opts = parsed.opts;
  if (opts.help) {
    process.stdout.write(HELP);
    process.exit(EXIT.OK);
  }

  const svc = loadService();
  const { ReferenceUpdateService, REFERENCE_SYSTEMS } = svc;

  const sysCheck = validateSystems(opts.systems, REFERENCE_SYSTEMS);
  if (!sysCheck.ok) {
    process.stderr.write(`sidecoach-refs: ${sysCheck.error}\n`);
    process.exit(EXIT.USAGE);
  }

  try {
    // Construction + getPaths() are inside the try so a stale/incompatible service
    // (old API) surfaces as a clean internal error (70), not an uncaught crash.
    const service = new ReferenceUpdateService({
      upstreamDir: opts.upstreamDir,
      localDir: opts.localDir,
      capturesDir: opts.capturesDir,
      designMdPath: opts.designMdPath,
    });
    const paths = service.getPaths();
    if (opts.action === 'check') {
      runCheck(service, paths, opts);
    } else {
      runApply(service, paths, opts, REFERENCE_SYSTEMS);
    }
  } catch (err) {
    process.stderr.write(`sidecoach-refs: internal error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(EXIT.INTERNAL);
  }
}

function runCheck(service, paths, opts) {
  let results = service.check();
  if (opts.systems) results = results.filter((r) => opts.systems.includes(r.system));

  const hadError = results.some((r) => r.status === 'error');
  const hadDrift = results.some((r) => r.status === 'stale' || r.status === 'not-installed');

  if (opts.json) {
    process.stdout.write(JSON.stringify({ action: 'check', paths, results }, null, 2) + '\n');
  } else {
    process.stdout.write(`Reference systems  (upstream: ${paths.upstreamDir})\n`);
    process.stdout.write(`                   (local:    ${paths.localDir})\n\n`);
    for (const r of results) {
      const local = r.localVersion || '-';
      const up = r.upstreamVersion || '-';
      const tag = statusTag(r.status);
      process.stdout.write(
        `  ${tag} ${pad(r.system, 18)} local ${pad(local, 8)} upstream ${pad(up, 8)}  ${r.reason}` +
          (r.userCaptures ? `  (+${r.userCaptures} capture${r.userCaptures === 1 ? '' : 's'})` : '') +
          '\n'
      );
    }
  }

  let code = EXIT.OK;
  let summary = 'all reference systems current';
  if (hadError) {
    code = EXIT.UPSTREAM;
    summary = 'upstream error while checking (see rows above)';
  } else if (hadDrift) {
    code = EXIT.DRIFT;
    const n = results.filter((r) => r.status === 'stale' || r.status === 'not-installed').length;
    summary = `${n} system(s) would update - run --apply`;
  }
  if (!opts.quiet) process.stderr.write(`sidecoach-refs: ${summary}\n`);
  process.exit(code);
}

function runApply(service, paths, opts, knownSystems) {
  const applyOpts = { stampDesignMd: !opts.noDesignMd };
  if (opts.systems) applyOpts.systems = opts.systems;
  else if (opts.all) applyOpts.onlyStale = false;

  const { results, designMd } = service.apply(applyOpts);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ action: 'apply', paths, results, designMd }, null, 2) + '\n');
  } else {
    process.stdout.write(`Applying reference updates  (local: ${paths.localDir})\n\n`);
    if (!results.length) {
      process.stdout.write('  nothing to update - all systems current\n');
    }
    for (const r of results) {
      const tag = applyTag(r.status);
      let line = `  ${tag} ${pad(r.system, 18)} ${r.previousVersion || '-'} -> ${r.newVersion || '-'}`;
      if (r.mergedUserCaptures) line += `  (${r.mergedUserCaptures} capture${r.mergedUserCaptures === 1 ? '' : 's'} preserved)`;
      if (r.status === 'failed') line += `  [${r.errorClass}] ${r.error}`;
      process.stdout.write(line + '\n');
    }
    process.stdout.write(
      `\n  DESIGN.md: ${designMd.updated ? 'stamped ' + designMd.path : 'not written (' + designMd.reason + ')'}\n`
    );
  }

  // Exit-code precedence: upstream (most fundamental) > validation > io. A DESIGN.md
  // read/write failure is an io error too, so a bundle refresh that then fails to
  // stamp the doc never reports a clean success.
  const classes = new Set(results.filter((r) => r.status === 'failed').map((r) => r.errorClass));
  let code = EXIT.OK;
  let summary;
  if (classes.has('upstream')) { code = EXIT.UPSTREAM; summary = 'upstream error - nothing written for failed system(s)'; }
  else if (classes.has('validation')) { code = EXIT.VALIDATION; summary = 'validation error - nothing written for failed system(s)'; }
  else if (classes.has('io') || designMd.failed) {
    code = EXIT.IO;
    summary = designMd.failed && !classes.has('io') ? `DESIGN.md ${designMd.reason}` : 'local write error';
  }
  else {
    const written = results.filter((r) => r.status === 'installed' || r.status === 'refreshed').length;
    summary = written ? `${written} system(s) updated` : 'nothing to update - all systems current';
  }
  void knownSystems;
  if (!opts.quiet) process.stderr.write(`sidecoach-refs: ${summary}\n`);
  process.exit(code);
}

function statusTag(status) {
  switch (status) {
    case 'current': return '[current]';
    case 'stale': return '[stale]  ';
    case 'not-installed': return '[absent] ';
    case 'error': return '[ERROR]  ';
    default: return '[?]      ';
  }
}

function applyTag(status) {
  switch (status) {
    case 'installed': return '[install]';
    case 'refreshed': return '[refresh]';
    case 'unchanged': return '[same]   ';
    case 'failed': return '[FAIL]   ';
    default: return '[?]      ';
  }
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

main();
