// sidecoach/src/__tests__/product-rule-registry.test.ts
import {
  CanonicalSeverity, EvidenceKind, isBlocking,
  EVIDENCE_SOURCE_COMPATIBILITY, sourceKindsForEvidence, isStaticallySatisfiable,
} from '../product-rule-types';

function run() {
  const blocker: CanonicalSeverity = 'blocker';
  if (!isBlocking(blocker, ['blocker', 'major'])) throw new Error('blocker must block under [blocker,major]');
  if (isBlocking('minor', ['blocker', 'major'])) throw new Error('minor must not block');
  if (isBlocking('advisory', ['blocker', 'major'])) throw new Error('advisory must not block');

  // evidence-compatibility model: browser-only evidence maps to NO static source kind
  if (EVIDENCE_SOURCE_COMPATIBILITY['dom'].length !== 0) throw new Error('dom must map to no static source kind');
  if (EVIDENCE_SOURCE_COMPATIBILITY['computed-style'].length !== 0) throw new Error('computed-style must be browser-only');
  if (EVIDENCE_SOURCE_COMPATIBILITY['contrast'].length !== 0) throw new Error('contrast must be browser-only');
  if (!EVIDENCE_SOURCE_COMPATIBILITY['css-rule'].includes('css')) throw new Error('css-rule must be satisfiable from css source');

  // a css-rule rule is statically satisfiable; a dom rule is not. isStaticallySatisfiable
  // is AND-across-requirements: EVERY required kind must be statically satisfiable.
  if (!isStaticallySatisfiable(['css-rule'] as EvidenceKind[])) throw new Error('css-rule must be statically satisfiable');
  if (!isStaticallySatisfiable(['css-rule', 'markup'] as EvidenceKind[])) throw new Error('css-rule + markup are BOTH static -> statically satisfiable');
  if (isStaticallySatisfiable(['css-rule', 'dom'] as EvidenceKind[])) throw new Error('any dom requirement makes a rule non-statically-satisfiable (AND across requirements)');
  if (sourceKindsForEvidence(['markup'] as EvidenceKind[]).includes('css')) throw new Error('css cannot satisfy a markup-only requirement');

  console.log('product-rule-types: OK');
}
run();
