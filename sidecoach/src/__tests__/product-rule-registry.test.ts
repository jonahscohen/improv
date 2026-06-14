// sidecoach/src/__tests__/product-rule-registry.test.ts
import {
  CanonicalSeverity, EvidenceKind, isBlocking,
  EVIDENCE_SOURCE_COMPATIBILITY, sourceKindsForEvidence, isStaticallySatisfiable,
  SEVERITY_TABLE,
} from '../product-rule-types';
import { RULES, getRule, getRuleById, resolveSourceAlias } from '../product-rule-registry';

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

// --- canonical registry + alias resolution ---
{
  // exactly one executable definition per canonicalRuleKey
  const keys = RULES.map((r) => r.canonicalRuleKey);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate canonicalRuleKey - one executable def per key');

  // every source alias maps to exactly one canonical rule (no conflict in the real seed)
  const seen = new Map<string, string>();
  for (const r of RULES) for (const a of r.sourceRuleAliases) {
    if (seen.has(a)) throw new Error(`source alias ${a} maps to two canonical keys`);
    seen.set(a, r.canonicalRuleKey);
  }

  // representative CROSS-REGISTRY aliasing: the polish-standard numeric id and the
  // extended-domain POLISH_0NN both resolve to the SAME canonical rule.
  const byNum = resolveSourceAlias('polish-standard:18');
  const byExt = resolveSourceAlias('POLISH_018');
  if (!byNum || !byExt) throw new Error('focus-visible aliases must resolve');
  if (byNum.canonicalRuleKey !== byExt.canonicalRuleKey) throw new Error('cross-registry aliases must resolve to ONE canonical rule');
  if (byNum.canonicalRuleKey !== 'a11y/focus-visible') throw new Error('focus-visible canonical key mismatch');

  // getRule / getRuleById round-trip
  if (getRule(byNum.canonicalRuleKey)?.canonicalRuleKey !== 'a11y/focus-visible') throw new Error('getRule round-trip failed');
  if (getRuleById('a11y.focus-visible')?.canonicalRuleKey !== 'a11y/focus-visible') throw new Error('getRuleById round-trip failed');

  // every rule carries required metadata
  for (const r of RULES) {
    if (!r.ruleId || !r.canonicalRuleKey || !r.ownerValidatorId || !r.severity || !r.findingClass || !r.scope) {
      throw new Error(`rule ${r.ruleId || '(no id)'} missing required metadata`);
    }
  }

  // the seed exercises the model: a DOM-only owned-non-required rule + a declared severity override
  const domOnly = getRuleById('a11y.min-hit-area');
  if (!domOnly || isStaticallySatisfiable(domOnly.evidenceRequirements)) throw new Error('a11y.min-hit-area must be DOM-only (not statically satisfiable)');
  const override = getRuleById('anti-pattern.identical-card-grids');
  if (!override || override.severity !== 'minor' || !override.severityOverrideReason) throw new Error('identical-card-grids must declare a minor override with a reason');
  if (SEVERITY_TABLE[override.sourceSeverity] === override.severity) throw new Error('override rule must diverge from the table default');

  console.log('product-rule-registry: OK');
}
