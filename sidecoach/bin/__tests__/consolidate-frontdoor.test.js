#!/usr/bin/env node
'use strict';

/**
 * Front-door contract for `sidecoach consolidate` (bin/sidecoach.js). Codex F2: the front-door used to
 * only delegate to the engine when the first arg did NOT start with `-`, so `consolidate --bogus` DROPPED
 * the flag and exited 0 with the no-flow resolver plan instead of delegating to the engine (which rejects
 * an unknown flag as a usage failure). The contract now: ONLY the bare `consolidate` resolves + prints the
 * plan (exit 0); ANY argument (subcommand OR flag) delegates to the engine.
 *
 * Requires a built dist/ (bin/sidecoach.js loads the compiled router). Exits non-zero on any failure.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const RESOLVER = path.resolve(__dirname, '..', 'sidecoach.js');
const ENV = { ...process.env, SIDECOACH_AUDIT_HISTORY: '/tmp/none' };

let passed = 0;
const failures = [];
function ok(cond, label) { if (cond) { passed += 1; } else { failures.push(label); } }
function eq(a, b, label) { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

function run(args) {
  const r = spawnSync(process.execPath, [RESOLVER, ...args], { encoding: 'utf8', env: ENV });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// bare `consolidate` -> resolves + prints the plan, exit 0
{
  const r = run(['consolidate']);
  eq(r.status, 0, 'bare `consolidate` exits 0');
  ok(/Resolved command: consolidate/.test(r.out), 'bare `consolidate` prints the resolver plan');
  ok(!/Unknown command/.test(r.out), 'bare `consolidate` is not an Unknown command');
}

// `consolidate --bogus` -> delegates to the engine, which rejects the unknown flag (non-zero)
{
  const r = run(['consolidate', '--bogus']);
  ok(r.status !== 0, '`consolidate --bogus` exits non-zero (delegated to the engine, not a silent exit-0 plan)');
  eq(r.status, 2, '`consolidate --bogus` carries the engine usage exit code (2)');
  ok(/unknown flag|unknown subcommand|FAIL\(2\)/.test(r.out), 'the failure comes from the engine, not the resolver plan');
  ok(!/Resolved command: consolidate/.test(r.out), '`consolidate --bogus` does NOT fall back to the resolver plan');
}

// `consolidate map ...` and `consolidate distill-corpus ...` still delegate (exit 0 on a valid run)
{
  const rMap = run(['consolidate', 'map', '--check', '--no-beat']);
  eq(rMap.status, 0, '`consolidate map --check --no-beat` delegates and exits 0');
  ok(/--check: OK|matches the regenerated map/.test(rMap.out), '`consolidate map --check` produced the engine output');
  const rDistill = run(['consolidate', 'distill-corpus', '--json']);
  eq(rDistill.status, 0, '`consolidate distill-corpus --json` delegates and exits 0');
  ok(/taste-distill-corpus/.test(rDistill.out), '`consolidate distill-corpus --json` produced the engine JSON');
}

// `consolidate --help` delegates to the engine help (exit 0) - a flag is still an argument
{
  const r = run(['consolidate', '--help']);
  eq(r.status, 0, '`consolidate --help` delegates to the engine help and exits 0');
  ok(/sidecoach-consolidate/.test(r.out), '`consolidate --help` shows the engine help');
}

if (failures.length) {
  process.stderr.write(`consolidate-frontdoor.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`consolidate-frontdoor.test: all ${passed} assertions passed\n`);
process.exit(0);
