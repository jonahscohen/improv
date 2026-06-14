// sidecoach/src/__tests__/lane-validator-gating.test.ts
import { validatorsForStep, aggregateWorstStatus, mapGateStatusToOutcome } from '../lane-validators';
import type { FlowId } from '../types';

function run() {
  // discovery: lane_build "craft" step binds flowI(adv)/flowM(adv)/flowJ(polish-standard) -> ['polish-standard']
  const craft = { flowIds: ['flowI_accessibility', 'flowM_responsive_validation', 'flowJ_tactical_polish'] as FlowId[] };
  const ids = validatorsForStep(craft);
  if (ids.length !== 1 || ids[0] !== 'polish-standard') throw new Error(`craft must discover ['polish-standard'], got ${JSON.stringify(ids)}`);

  // a step that binds the same validator via two flows de-dups
  const dupd = validatorsForStep({ flowIds: ['flowJ_tactical_polish', 'flowJ_tactical_polish'] as FlowId[] });
  if (dupd.length !== 1) throw new Error('duplicate validators must de-dup');

  // a no-validator step discovers []
  if (validatorsForStep({ flowIds: ['flowA_brand_verify'] as FlowId[] }).length !== 0) throw new Error('advisory/none flow contributes no validator');
  if (validatorsForStep({ flowIds: [] as FlowId[] }).length !== 0) throw new Error('empty step contributes no validator');

  // worst-status total order: error > findings > inconclusive > clean
  if (aggregateWorstStatus(['clean', 'clean']) !== 'clean') throw new Error('all clean -> clean');
  if (aggregateWorstStatus(['clean', 'inconclusive']) !== 'inconclusive') throw new Error('inconclusive beats clean');
  if (aggregateWorstStatus(['findings', 'inconclusive']) !== 'findings') throw new Error('findings beats inconclusive');
  if (aggregateWorstStatus(['error', 'findings', 'inconclusive']) !== 'error') throw new Error('error is worst');
  if (aggregateWorstStatus([]) !== 'clean') throw new Error('no validators -> clean (vacuously gated)');

  // mapping
  if (mapGateStatusToOutcome('clean').proceed !== true) throw new Error('clean proceeds');
  if (mapGateStatusToOutcome('findings').stepStatus !== 'validation_failed') throw new Error('findings -> validation_failed');
  if (mapGateStatusToOutcome('inconclusive').stepStatus !== 'validation_inconclusive') throw new Error('inconclusive -> validation_inconclusive');
  if (mapGateStatusToOutcome('error').stepStatus !== 'validation_error') throw new Error('error -> validation_error');
  console.log('lane-validator-gating: OK');
}
run();
