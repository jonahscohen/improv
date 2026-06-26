#!/usr/bin/env node
/**
 * Contract-6 ORACLE COMPARATOR smoke test (Stage 0 deliverable).
 *
 * Asserts the oracle (oracle detect.mjs, headless, pinned dev/eval dep) is
 * invokable and emits parseable, normalizable findings. This is the linchpin of
 * the A1-A4 oracle-comparison; if the oracle cannot be run headless in the
 * eval/dev environment, the detector non-regression gate cannot run.
 *
 * Exit 0 = green; exit 1 = failure. Run: `node eval/smoke-test.mjs`.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOracle, resolveOraclePath } from './oracle-comparator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'fixtures', 'known-defect', 'gradient-text.html');

function fail(msg) { console.error(`SMOKE FAIL: ${msg}`); process.exit(1); }

const oraclePath = resolveOraclePath();
if (!oraclePath) {
  fail('oracle detect.mjs not resolvable. Set SIDECOACH_ORACLE_DETECT to oracle\'s detect.mjs (pinned dev/eval dependency).');
}

const res = await runOracle(fixture, { oraclePath });
if (!res.available) fail(`oracle did not run: ${res.reason}`);
if (!Array.isArray(res.findings) || res.findings.length === 0) fail('oracle returned no findings on a known-defect fixture');

const gradient = res.findings.find((f) => f.rule === 'gradient-text');
if (!gradient) fail(`expected a 'gradient-text' finding; got rules: ${res.findings.map((f) => f.rule).join(', ')}`);
if (!gradient.file || typeof gradient.line !== 'number') fail('normalized finding missing file/line for the A1-A4 diff');

// FAIL-CLOSED (Codex Stage-0 BLOCKER 1): a missing target must NOT read as clean.
const missing = await runOracle(path.join(here, 'fixtures', 'known-defect', '__does_not_exist__.html'), { oraclePath });
if (missing.available !== false) fail('missing target did not fail closed (would let a bad path read as oracle-clean)');

console.log(`SMOKE PASS: oracle=${path.basename(oraclePath)} found ${res.findings.length} finding(s); gradient-text @ line ${gradient.line}; missing-target fails closed. Comparator ready for A1-A4.`);
process.exit(0);
