#!/usr/bin/env node
'use strict';

/**
 * bin/sidecoach-doctor.js inventory correctness: a TEST FILE is not a shipped capability.
 *
 * collectSource walks bin/ recursively, so before the __tests__ exclusion the doctor descended into
 * bin/__tests__/ and treated every test file (sidecoach-consolidate.test.js, sidecoach-mine.test.js, and
 * THIS file) as a phantom "capability" - producing spurious capability-unreached / -unnamed /
 * tool-not-in-resolver findings for coverage files. This asserts the inventory is honest: no *.test
 * capability is inventoried or flagged, while every REAL tool is still inventoried and the real checks
 * (and any real findings) are untouched.
 *
 * The doctor's --json can exceed one pipe buffer, so its stdout is captured to a FILE (spawnSync pipe
 * capture truncates large stdout) - the same reason run-tests.ts captures child output to a file.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const DOCTOR = path.resolve(__dirname, '..', 'sidecoach-doctor.js');

let passed = 0;
const failures = [];
function ok(cond, label) { if (cond) { passed += 1; } else { failures.push(label); } }

// Run doctor --json, capturing stdout to a file (avoids the spawnSync pipe truncation on large output).
const outPath = path.join(os.tmpdir(), `doctor-inventory-${process.pid}.json`);
const fd = fs.openSync(outPath, 'w');
const r = spawnSync(process.execPath, [DOCTOR, '--json'], {
  stdio: ['ignore', fd, 'ignore'],
  env: { ...process.env, SIDECOACH_AUDIT_HISTORY: '/tmp/none' },
});
fs.closeSync(fd);
// doctor exits 1 when real findings remain - that is expected, not a spawn failure.
ok(r.status === 0 || r.status === 1, `doctor --json ran (exit ${r.status})`);

let d;
try { d = JSON.parse(fs.readFileSync(outPath, 'utf8')); }
catch (e) { process.stderr.write('sidecoach-doctor.test: could not parse doctor --json: ' + e.message + '\n'); process.exit(2); }
try { fs.unlinkSync(outPath); } catch (_e) { /* best-effort */ }

const findings = Array.isArray(d.findings) ? d.findings : [];
const rows = Array.isArray(d.rows) ? d.rows : [];
const toolRows = rows.filter((row) => row.kind === 'tool');
const toolNames = toolRows.map((row) => row.capability);

// The doctor really ran (not an empty/short-circuited output).
ok(rows.length > 0, 'doctor inventoried a non-empty capability set (real checks ran)');
ok(typeof d.toolsInventoried === 'number' && d.toolsInventoried >= 15, `a real set of tools is inventoried (${d.toolsInventoried})`);

// CORE: no *.test file is inventoried as a capability, and none is flagged.
const testInInventory = toolNames.filter((n) => /\.test$/.test(n));
ok(testInInventory.length === 0, `no *.test file is inventoried as a capability (offenders: ${testInInventory.join(', ') || 'none'})`);
const testInFindings = findings.filter((f) => /\.test$/.test(String(f.capability)));
ok(testInFindings.length === 0, `no finding references a *.test phantom capability (offenders: ${testInFindings.map((f) => f.id + ':' + f.capability).join(', ') || 'none'})`);

// Specifically the known bin/__tests__ files are NOT capabilities.
for (const phantom of ['sidecoach-consolidate.test', 'sidecoach-mine.test', 'sidecoach-doctor.test']) {
  ok(!toolNames.includes(phantom), `${phantom} is NOT inventoried as a capability (it is a test file)`);
}

// NOT over-excluded: every REAL tool is still inventoried (the fix removed only test files).
for (const real of ['sidecoach', 'sidecoach-consolidate', 'sidecoach-doctor', 'sidecoach-mine', 'sidecoach-drift']) {
  ok(toolNames.includes(real), `the real tool ${real} is still inventoried`);
}

// Real findings are untouched: doctor still fails closed on genuine gaps (it does not now report a clean
// bill just because the phantoms were removed). A real capability-unreached (sidecoach-taste-check) or at
// least the resolver-registry checks are still present - the doctor is not weakened.
ok(findings.length > 0, 'doctor still reports its real findings (not weakened to a false clean)');
ok(findings.every((f) => !/\.test$/.test(String(f.capability))), 'every remaining finding is about a real capability, never a test file');

if (failures.length) {
  process.stderr.write(`sidecoach-doctor.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`sidecoach-doctor.test: all ${passed} assertions passed (no *.test phantom capabilities; ${d.toolsInventoried} real tools inventoried)\n`);
process.exit(0);
