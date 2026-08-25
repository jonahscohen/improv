// sidecoach/src/__tests__/taste-map-types.test.ts
//
// The pure classifier is the risk core of the consolidation map: a wrong TYPE is a missed conflict
// or manufactured noise. This suite hand-builds typed record pairs and asserts classifyContradiction
// returns EXACTLY direction-pair / hard-vs-hard / standard-calibration / cross-type where it should,
// null on unrelated concepts, and that a direction-pair is never a conflict. It also pins the
// load-bearing invariant: two design-directions with opposing-sounding prose can NEVER be typed as
// hard-vs-hard.

import {
  classifyContradiction,
  seedConceptFromKey,
  normalizeConcept,
  emptyContradictionsByType,
  DISTILLED_RULE_TYPES,
  DistilledRule,
} from '../taste-map-types';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void { if (cond) passed += 1; else failures.push(label); }
function eq<T>(a: T, b: T, label: string): void { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

function rule(over: Partial<DistilledRule>): DistilledRule {
  return {
    id: over.id || 'r',
    sourceKind: over.sourceKind || 'expert-external',
    source: over.source || 'src',
    sourceFile: over.sourceFile,
    type: over.type || 'principle-guidance',
    concept: over.concept || 'x',
    claim: over.claim || 'claim',
    polarity: over.polarity,
    axisSubject: over.axisSubject !== undefined ? over.axisSubject : 'x',
    directionLabel: over.directionLabel,
    measured: over.measured,
    evidence: over.evidence || [],
    provenance: over.provenance,
    confidence: over.confidence,
  };
}

// ---------------------------------------------------------------------------
// null on unrelated concepts
// ---------------------------------------------------------------------------
{
  const a = rule({ type: 'hard-prohibitive', polarity: 'ban', axisSubject: 'typeface-inter' });
  const b = rule({ type: 'hard-prohibitive', polarity: 'mandate', axisSubject: 'border-radius' });
  eq(classifyContradiction(a, b), null, 'different axisSubject => null (unrelated concepts)');
}
{
  const a = rule({ type: 'hard-prohibitive', polarity: 'ban', axisSubject: '' });
  const b = rule({ type: 'hard-prohibitive', polarity: 'mandate', axisSubject: '' });
  eq(classifyContradiction(a, b), null, 'empty axisSubject => null (no join key)');
}

// ---------------------------------------------------------------------------
// direction-pair (both design-directions on the same axis) => isConflict false
// ---------------------------------------------------------------------------
{
  const bolder = rule({ source: 'oracle', type: 'design-direction', directionLabel: 'bolder', axisSubject: 'accent-intensity', claim: 'push saturated accents' });
  const quieter = rule({ source: 'oracle', type: 'design-direction', directionLabel: 'quieter', axisSubject: 'accent-intensity', claim: 'restrained near-monochrome' });
  const r = classifyContradiction(bolder, quieter);
  ok(r !== null, 'two design-directions on the same axis produce a record');
  eq(r!.type, 'direction-pair', 'two design-directions => direction-pair');
  eq(r!.isConflict, false, 'direction-pair.isConflict === false');
  eq(r!.disposition, 'menu', 'direction-pair disposition is menu');
}

// LOAD-BEARING: two directions whose prose reads as opposing intensities are STILL a direction-pair,
// never hard-vs-hard - the direction gate is checked before polarity. (Give them polarity to prove
// the gate wins even if a downstream author mislabeled them.)
{
  const a = rule({ source: 'oracle', type: 'design-direction', directionLabel: 'bolder', polarity: 'mandate', axisSubject: 'intensity' });
  const b = rule({ source: 'oracle', type: 'design-direction', directionLabel: 'quieter', polarity: 'ban', axisSubject: 'intensity' });
  eq(classifyContradiction(a, b)!.type, 'direction-pair', 'direction gate beats polarity: bold vs restrained is never hard-vs-hard');
}

// ---------------------------------------------------------------------------
// hard-vs-hard (two hard-prohibitives, OPPOSING polarity, same axis)
// ---------------------------------------------------------------------------
{
  const ban = rule({ source: 'taste-skill', type: 'hard-prohibitive', polarity: 'ban', axisSubject: 'typeface-inter', claim: 'never ship Inter' });
  const mandate = rule({ source: 'refactoring-ui', type: 'hard-prohibitive', polarity: 'mandate', axisSubject: 'typeface-inter', claim: 'Inter is a safe UI default' });
  const r = classifyContradiction(ban, mandate);
  eq(r!.type, 'hard-vs-hard', 'ban vs mandate on the same subject => hard-vs-hard');
  eq(r!.isConflict, true, 'hard-vs-hard is a real conflict');
  eq(r!.disposition, 'resolve', 'hard-vs-hard disposition is resolve');
}
// two SAME-polarity bans agree - not a contradiction.
{
  const a = rule({ type: 'hard-prohibitive', polarity: 'ban', axisSubject: 'typeface-inter' });
  const b = rule({ type: 'hard-prohibitive', polarity: 'ban', axisSubject: 'typeface-inter' });
  eq(classifyContradiction(a, b), null, 'two same-polarity bans agree => null (not a conflict)');
}
// a hard-prohibitive with no polarity cannot be asserted as opposing - fail toward NOT flagging.
{
  const a = rule({ type: 'hard-prohibitive', axisSubject: 'typeface-inter' });
  const b = rule({ type: 'hard-prohibitive', polarity: 'mandate', axisSubject: 'typeface-inter' });
  eq(classifyContradiction(a, b), null, 'missing polarity => null (never a fabricated hard-vs-hard)');
}

// ---------------------------------------------------------------------------
// standard-calibration (two standard-measurements, same knob, different value)
// ---------------------------------------------------------------------------
{
  const a = rule({ source: 'jakub', type: 'standard-measurement', axisSubject: 'border-radius', measured: { property: 'border-radius', value: 8, unit: 'px', range: [8, 12] }, claim: '8-12px' });
  const b = rule({ source: 'bencium', type: 'standard-measurement', axisSubject: 'border-radius', measured: { property: 'border-radius', value: 0, unit: 'px' }, claim: '0px hard edges' });
  const r = classifyContradiction(a, b);
  eq(r!.type, 'standard-calibration', 'differing measured values on the same knob => standard-calibration');
  eq(r!.isConflict, true, 'standard-calibration is a conflict to calibrate');
  eq(r!.disposition, 'calibrate', 'standard-calibration disposition is calibrate');
  ok(Array.isArray(r!.values) && r!.values!.length === 2, 'standard-calibration carries the two measured values');
}
// identical measurements agree - not a calibration conflict.
{
  const a = rule({ type: 'standard-measurement', axisSubject: 'border-radius', measured: { property: 'border-radius', value: 8, unit: 'px' } });
  const b = rule({ type: 'standard-measurement', axisSubject: 'border-radius', measured: { property: 'border-radius', value: 8, unit: 'px' } });
  eq(classifyContradiction(a, b), null, 'identical measurements => null (agreement)');
}

// ---------------------------------------------------------------------------
// cross-type
// ---------------------------------------------------------------------------
// a direction vs a hard ban on the same axis (serif banned-on-UI vs serif-for-Elegant).
{
  const dir = rule({ source: 'taste-skill', type: 'design-direction', directionLabel: 'named-vibe', axisSubject: 'serif-family', claim: 'Elegant archetype prescribes a serif' });
  const ban = rule({ source: 'jakub', type: 'hard-prohibitive', polarity: 'ban', axisSubject: 'serif-family', claim: 'never set UI body in a serif' });
  const r = classifyContradiction(dir, ban);
  eq(r!.type, 'cross-type', 'a direction vs a hard ban on the same axis => cross-type');
  eq(r!.disposition, 'note', 'cross-type disposition is note');
}
// a hard-prohibitive vs a standard-measurement on the same axis.
{
  const ban = rule({ type: 'hard-prohibitive', polarity: 'ban', axisSubject: 'border-radius', claim: 'never round corners' });
  const std = rule({ type: 'standard-measurement', axisSubject: 'border-radius', measured: { property: 'border-radius', value: 8, unit: 'px' } });
  eq(classifyContradiction(ban, std)!.type, 'cross-type', 'hard-prohibitive vs standard on the same axis => cross-type');
}
// a direction vs a SOFT principle is not a conflict.
{
  const dir = rule({ source: 'oracle', type: 'design-direction', directionLabel: 'quieter', axisSubject: 'whitespace' });
  const principle = rule({ type: 'principle-guidance', axisSubject: 'whitespace', claim: 'prefer breathing room' });
  eq(classifyContradiction(dir, principle), null, 'a direction vs a soft principle => null (not a conflict)');
}
// two principles that share an axis are never a hard conflict.
{
  const a = rule({ type: 'principle-guidance', axisSubject: 'contrast' });
  const b = rule({ type: 'principle-guidance', axisSubject: 'contrast' });
  eq(classifyContradiction(a, b), null, 'two soft principles => null');
}

// ---------------------------------------------------------------------------
// seedConceptFromKey + normalizeConcept + buckets
// ---------------------------------------------------------------------------
{
  const s = seedConceptFromKey({ canonicalRuleKey: 'anti-pattern/gradient-text' });
  eq(s.concept, 'gradient-text', 'seedConceptFromKey takes the canonical-key tail as concept');
  eq(s.axisSubject, 'gradient text', 'seedConceptFromKey normalizes the axisSubject');
  const s2 = seedConceptFromKey({ ruleId: 'theming.border-radius-consistency' });
  eq(s2.concept, 'theming-border-radius-consistency', 'seedConceptFromKey falls back to ruleId (dots/underscores -> hyphen)');
  eq(normalizeConcept('Border_Radius!! 8px'), 'border radius 8px', 'normalizeConcept collapses non-alphanumerics');
  const buckets = emptyContradictionsByType();
  ok(DISTILLED_RULE_TYPES.length === 4, 'four distilled rule types');
  ok(Object.keys(buckets).length === 4 && buckets['hard-vs-hard'].length === 0, 'empty contradiction buckets have all four keys');
}

if (failures.length) {
  process.stderr.write(`taste-map-types.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
console.log(`taste-map-types: OK (${passed} assertions)`);
