// Engine-side parity guard. The classifier core exists as two copies - this
// engine module (sidecoach/src/lane-classifier.ts) and the Python hook
// (claude/hooks/sidecoach_lanes.py) - which cannot share source across
// languages. This runs the ENGINE copy against the SAME shared corpus the
// Python copy uses (test_classifier_parity.py), so both copies are proven
// decision-identical and cannot drift.
import * as path from 'path';
import * as assert from 'assert';
import { loadRegistry, classifyIntent } from '../lane-classifier';

const REPO = path.resolve(__dirname, '..', '..', '..');
const LANES = path.join(REPO, 'claude', 'hooks', 'sidecoach-lanes.json');
const CORPUS = path.join(REPO, 'sidecoach', 'parity', 'classifier-corpus.json');

const VERBS = ['shape','craft','polish','audit','critique','harden','adapt','colorize',
  'delight','animate','quieter','distill','clarify','layout','bolder',
  'overdrive','typeset','optimize','extract','onboard','document'].map(v => ({ verb: v }));

const reg = loadRegistry(LANES);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const corpus = require(CORPUS);

let failures = 0;
for (const c of corpus.cases) {
  const r = classifyIntent(c.prompt, reg, VERBS, { intentEligible: !!c.eligible });
  try {
    assert.strictEqual(r.outcome, c.expect, `outcome for: ${c.prompt}`);
    if (c.winningLane) assert.strictEqual(r.winningLane, c.winningLane, `winningLane for: ${c.prompt}`);
    if (c.verbMatch) assert.strictEqual(r.verbMatch, c.verbMatch, `verbMatch for: ${c.prompt}`);
  } catch (e) {
    failures++;
    console.error(String(e));
  }
}
if (failures) { console.error(`ENGINE PARITY FAILURES: ${failures}`); process.exit(1); }
console.log(`engine classifier-parity: ${corpus.cases.length} cases OK`);
