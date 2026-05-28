// Fault injection: a validator throws mid-call. The tool must return a
// structured VALIDATOR_FAILURE error and the server stays alive.

import { TOOLS } from '../../src/tools';
import { SidecoachToolError } from '../../src/errors';
import { createLogger } from '../../src/logger';
import { test, assert } from '../harness';

// We monkey-patch the validator modules; restore must happen in finally.
import * as polishMod from '../../../dist/polish-standard-validator';
import * as tasteMod from '../../../dist/taste-validator';
import * as extDomMod from '../../../dist/extended-domain-validator';

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

const fakeRegs = {
  verbs: null,
  modes: { modes: [] },
  flows: [],
  cheatsheet: null,
} as const;

export async function run(): Promise<void> {
  await test('validate_polish_standard returns VALIDATOR_FAILURE when validator throws', async () => {
    const original = polishMod.PolishStandardValidator.validateAll;
    try {
      (polishMod.PolishStandardValidator as any).validateAll = () => {
        throw new Error('simulated polish failure');
      };
      const h = TOOLS.find((t) => t.definition.name === 'sidecoach_validate_polish_standard')!
        .handler;
      try {
        await h(
          { html: '<div/>' },
          { logger: silentLogger(), registries: fakeRegs as any },
        );
        assert.fail('expected throw');
      } catch (e) {
        assert.ok(e instanceof SidecoachToolError);
        assert.strictEqual((e as SidecoachToolError).code, 'VALIDATOR_FAILURE');
      }
    } finally {
      (polishMod.PolishStandardValidator as any).validateAll = original;
    }
  });

  await test('validate_taste returns VALIDATOR_FAILURE when taste validator throws', async () => {
    const original = tasteMod.validateTaste;
    try {
      (tasteMod as any).validateTaste = () => {
        throw new Error('simulated taste failure');
      };
      const h = TOOLS.find((t) => t.definition.name === 'sidecoach_validate_taste')!.handler;
      try {
        await h(
          { html: '<div/>' },
          { logger: silentLogger(), registries: fakeRegs as any },
        );
        assert.fail('expected throw');
      } catch (e) {
        assert.strictEqual((e as SidecoachToolError).code, 'VALIDATOR_FAILURE');
      }
    } finally {
      (tasteMod as any).validateTaste = original;
    }
  });

  await test('validate_extended_domain returns VALIDATOR_FAILURE when validator throws', async () => {
    const original = extDomMod.ExtendedDomainValidator.validateAll;
    try {
      (extDomMod.ExtendedDomainValidator as any).validateAll = () => {
        throw new Error('simulated extended-domain failure');
      };
      const h = TOOLS.find(
        (t) => t.definition.name === 'sidecoach_validate_extended_domain',
      )!.handler;
      try {
        await h(
          { css: '.x { color: red; }' },
          { logger: silentLogger(), registries: fakeRegs as any },
        );
        assert.fail('expected throw');
      } catch (e) {
        assert.strictEqual((e as SidecoachToolError).code, 'VALIDATOR_FAILURE');
      }
    } finally {
      (extDomMod.ExtendedDomainValidator as any).validateAll = original;
    }
  });

  await test('a normal call after a thrown validator still succeeds (server resilient)', async () => {
    // After all monkey-patches above are restored, run a clean call.
    const h = TOOLS.find((t) => t.definition.name === 'sidecoach_validate_taste')!.handler;
    const r = await h(
      { html: '<div>hello</div>' },
      { logger: silentLogger(), registries: fakeRegs as any },
    );
    assert.ok(typeof (r.data as any).violationCount === 'number');
  });
}
