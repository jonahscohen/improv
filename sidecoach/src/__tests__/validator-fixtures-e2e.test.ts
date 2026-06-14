// sidecoach/src/__tests__/validator-fixtures-e2e.test.ts
import * as path from 'path';
import { FIXTURE_MANIFEST, getValidatorRegistration } from '../flow-validation-capabilities';

const SC = path.resolve(__dirname, '..', '..');

async function run() {
  for (const m of FIXTURE_MANIFEST) {
    const reg = getValidatorRegistration(m.validatorId);
    if (!reg || !reg.validateProduct) throw new Error(`${m.validatorId} has no validateProduct`);
    const cases: Array<['clean' | 'findings' | 'inconclusive', string]> = [
      ['clean', m.fixtures.clean], ['findings', m.fixtures.findings], ['inconclusive', m.fixtures.inconclusive],
    ];
    for (const [expected, rel] of cases) {
      const res = await reg.validateProduct!({ projectPath: path.resolve(SC, rel) });
      if (res.status !== expected) {
        throw new Error(`${m.validatorId} ${rel}: expected status ${expected}, got ${res.status} (rules: ${res.rules.map((r) => r.ruleId + '=' + r.status).join(', ')})`);
      }
    }
  }

  // Polish clean/findings include non-Framer markup so polish.animatepresence-initial
  // resolves not_applicable (rather than inconclusive, which would flip the status).
  for (const cat of ['clean', 'findings'] as const) {
    const res = await getValidatorRegistration('polish-standard')!.validateProduct!({ projectPath: path.resolve(SC, `fixtures/polish-standard/${cat}`) });
    const ap = res.rules.find((r) => r.ruleId === 'polish.animatepresence-initial');
    if (!ap || ap.status !== 'not_applicable') throw new Error(`polish.animatepresence-initial must be not_applicable in the ${cat} fixture (got ${ap?.status})`);
  }

  // a clean result MAY still carry non-blocking findings; consumers read status, not findings.length
  const apClean = await getValidatorRegistration('anti-pattern')!.validateProduct!({ projectPath: path.resolve(SC, 'fixtures/anti-pattern/clean') });
  if (apClean.status !== 'clean') throw new Error('anti-pattern clean fixture must be clean');

  console.log('validator-fixtures-e2e: OK');
}
run();
