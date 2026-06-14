// Task 2: lane policy getter + loop helpers.
import { getLanePolicy } from '../flow-validation-capabilities';
import { isLoopLane, requiredValidatorsForLane } from '../lane-validators';

function run() {
  const policy = getLanePolicy('lane_converge');
  if (!policy) throw new Error('lane_converge must have a policy');
  const expected = ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'];
  if (JSON.stringify(policy.requiredProductValidatorIds) !== JSON.stringify(expected)) {
    throw new Error('unexpected required validators: ' + JSON.stringify(policy.requiredProductValidatorIds));
  }
  if (getLanePolicy('lane_build') !== null) throw new Error('sequence lane has no policy -> null');

  if (!isLoopLane('lane_converge')) throw new Error('lane_converge is a loop lane');
  if (isLoopLane('lane_calm')) throw new Error('lane_calm is SEQUENCE, not loop');
  if (isLoopLane('lane_build')) throw new Error('lane_build is sequence');

  const reqs = requiredValidatorsForLane('lane_converge');
  if (JSON.stringify(reqs) !== JSON.stringify(expected)) throw new Error('requiredValidatorsForLane mismatch: ' + JSON.stringify(reqs));
  // A sequence lane has no policy -> empty required set (the boundary gate never runs for it).
  if (requiredValidatorsForLane('lane_build').length !== 0) throw new Error('sequence lane -> no required loop validators');

  console.log('lane-converge-policy: OK');
}
run();
