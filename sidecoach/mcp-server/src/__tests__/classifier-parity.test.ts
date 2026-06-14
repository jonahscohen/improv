import * as path from 'path';
import * as assert from 'assert';
import { loadRegistry, classifyIntent, intentEligible } from '../keyword-resolver';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const LANES = path.join(REPO, 'claude', 'hooks', 'sidecoach-lanes.json');
const CORPUS = path.join(REPO, 'sidecoach', 'parity', 'classifier-corpus.json');

const VERBS = ['shape','craft','polish','audit','critique','harden','adapt','colorize',
  'delight','animate','live','quieter','distill','clarify','layout','bolder',
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
const INTENT = path.join(REPO, 'claude', 'hooks', 'sidecoach-intent.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const intentReg = require(INTENT);

for (const c of corpus.cases) {
  const computed = intentEligible(c.prompt, intentReg);
  const r = classifyIntent(c.prompt, reg, VERBS, { intentEligible: computed });
  try {
    assert.strictEqual(r.outcome, c.expect, `computed-eligibility outcome for: ${c.prompt}`);
    if (c.winningLane) assert.strictEqual(r.winningLane, c.winningLane, `computed winningLane for: ${c.prompt}`);
    if (c.verbMatch) assert.strictEqual(r.verbMatch, c.verbMatch, `computed verbMatch for: ${c.prompt}`);
  } catch (e) {
    failures++;
    console.error(String(e));
  }
}

if (failures) { console.error(`PARITY FAILURES: ${failures}`); process.exit(1); }
console.log(`classifier-parity: ${corpus.cases.length} cases OK (declared + computed eligibility)`);
