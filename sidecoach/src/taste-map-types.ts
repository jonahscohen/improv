// sidecoach/src/taste-map-types.ts
//
// The typed schema + the PURE contradiction classifier for the taste consolidation + contradiction
// map (an inert, human-reviewed report, NOT an enforcement layer). The engine that assembles the
// corpus and writes the report lives in bin/sidecoach-consolidate.js; this module owns the parts
// that must be exact and reproducible: the record shapes and the classification of a contradiction
// from STRUCTURED, typed fields (never from prose).
//
// THE RECONCILIATION MODEL (Jonah's, session_2026-08-25_consolidation-contradiction-model.md).
// A distilled rule is classified by TYPE:
//   - hard-prohibitive   : an absolute ban/mandate ("never font X" / "always use Y").
//   - design-direction   : a stance on the intended MENU (brutalist / minimalist / bolder / quieter).
//                          PROVENANCE-GATED: only a named-direction SOURCE can carry this type, so the
//                          engine sets it from provenance, never from prose (see the gate below and in
//                          the consolidate engine).
//   - standard-measurement : a measured knob (border-radius px, easing curve, spacing unit).
//   - principle-guidance : soft advice.
// A contradiction is then classified by the TYPES of the two rules in tension:
//   - direction-pair      : two design-directions on the same axis. NOT a conflict (isConflict=false) -
//                           it is the intended menu; both are kept and never reconciled.
//   - hard-vs-hard        : two hard-prohibitives with OPPOSING polarity on the same axis. A real
//                           conflict to resolve.
//   - standard-calibration : two standard-measurements that disagree on the same knob. Pick a value/range.
//   - cross-type          : a prescriptive tension across kinds (a direction vs a hard/standard, or a
//                           hard-vs-standard). Noted for a human, not auto-resolved.
//
// LOAD-BEARING INVARIANT: because directionLabel + type='design-direction' is provenance-gated, a
// direction-typed rule can ONLY pair as 'direction-pair'. A bold-intensity rule and a restrained-
// intensity rule (both directions) therefore can NEVER be mistyped as a hard-vs-hard conflict. The
// classifier re-types the pair from the structured fields (axisSubject join, polarity, measured
// values), so the classification is reproducible, not a model's whim.

export type DistilledRuleType =
  | 'hard-prohibitive'
  | 'design-direction'
  | 'standard-measurement'
  | 'principle-guidance';

export const DISTILLED_RULE_TYPES: readonly DistilledRuleType[] = [
  'hard-prohibitive',
  'design-direction',
  'standard-measurement',
  'principle-guidance',
];

/** For a hard-prohibitive: is the absolute a ban ("never") or a mandate ("always")? */
export type Polarity = 'ban' | 'mandate';

/** A measured knob and the value/range a standard-measurement rule pins it to. */
export interface MeasuredValue {
  property: string;                     // e.g. 'border-radius', 'easing'
  value?: string | number;             // e.g. 8, '0', 'cubic-bezier(.34,1.56,.64,1)'
  unit?: string;                        // e.g. 'px', 'ms'
  range?: [number, number] | string;   // e.g. [8, 12] or '8-12px'
}

/**
 * One distilled rule - the irreducibly-semantic distillation of one prose source into one typed
 * record. The live FLOW produces the semantics (type/claim/measured); the deterministic engine
 * GATES directionLabel + the design-direction type from provenance and RE-TYPES every contradiction
 * from these structured fields.
 */
export interface DistilledRule {
  id: string;
  sourceKind: string;         // 'expert-external' | 'rule-store-for-dedup' | 'beat' | ...
  source: string;             // provenance source slug (e.g. 'oracle', 'leon-lin-taste-skill')
  sourceFile?: string;        // the file the claim was distilled from
  type: DistilledRuleType;
  concept: string;            // the human cluster label (e.g. 'border-radius')
  claim: string;              // one-line prose. DISPLAY ONLY - never read by the classifier.
  polarity?: Polarity;        // hard-prohibitive only
  axisSubject: string;        // the contradiction JOIN key (the subject two rules argue about)
  directionLabel?: string;    // PROVENANCE-GATED; present iff type === 'design-direction'
  measured?: MeasuredValue;   // standard-measurement only
  evidence: string[];         // citations (file:line etc.)
  provenance?: Record<string, unknown>;
  confidence?: 'high' | 'medium' | 'low';
  normalizationWarnings?: string[];  // set by the engine when a raw entry was malformed but filed
}

export type ContradictionType =
  | 'direction-pair'
  | 'hard-vs-hard'
  | 'standard-calibration'
  | 'cross-type';

export type Disposition = 'menu' | 'resolve' | 'calibrate' | 'note';

export interface ContradictionRecord {
  type: ContradictionType;
  isConflict: boolean;         // direction-pair => false; every other type => true
  axisSubject: string;
  members: DistilledRule[];    // exactly the two rules in tension, input order preserved
  values?: MeasuredValue[];    // standard-calibration: the two measured values
  recommendation: string;      // one human-facing recommendation for this contradiction
  disposition: Disposition;    // menu | resolve | calibrate | note
}

/** How a distilled cluster relates to our live rules. */
export interface ClusterOverlap {
  concept: string;
  status: 'covered' | 'additive' | 'single-source';
  liveMatch: string | null;    // the live rule ref (store:id) when covered, else null
  sources: string[];           // distinct distilled sources contributing to the cluster
  memberCount: number;
}

export interface OverlapView {
  covered: ClusterOverlap[];        // redundant with a live rule we already ship
  additive: ClusterOverlap[];       // >= 2 distilled sources agree, we lack it (the strongest signal)
  singleSource: ClusterOverlap[];   // one distilled source, we lack it
}

export interface TasteMapCluster {
  concept: string;
  axisSubject: string;
  members: DistilledRule[];
  overlap: ClusterOverlap;
  contradictions: ContradictionRecord[];
}

export interface ContradictionsByType {
  'direction-pair': ContradictionRecord[];
  'hard-vs-hard': ContradictionRecord[];
  'standard-calibration': ContradictionRecord[];
  'cross-type': ContradictionRecord[];
}

export interface TasteMap {
  schema: string;
  clusters: TasteMapCluster[];
  overlap: OverlapView;
  contradictionsByType: ContradictionsByType;
}

// ---------------------------------------------------------------------------
// normalization + concept seeding
// ---------------------------------------------------------------------------

/**
 * Lowercase, collapse every non-alphanumeric run to a single space, trim. This MATCHES the miner's
 * normalizeKey (bin/sidecoach-mine.js) byte-for-byte, so a distilled concept can be tested against
 * the miner's dedup index (buildDedupIndex) with the same key shape.
 */
export function normalizeConcept(s: string): string {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Seed a concept + axisSubject from a rule-store entry (a registry rule or a guidance entry). Uses
 * the canonical-key TAIL, the same human-readable slug the miner's dedup uses as its weak key, so
 * the seeded concept lines up with a distilled rule's concept when they describe the same thing.
 */
export function seedConceptFromKey(entry: {
  canonicalRuleKey?: string;
  ruleId?: string;
  registryScope?: string;
  name?: string | null;
  id?: string | null;
}): { concept: string; axisSubject: string } {
  const key = entry.canonicalRuleKey || entry.ruleId || entry.name || entry.id || entry.registryScope || '';
  const tail = String(key).split('/').pop() || String(key);
  const concept = tail.replace(/[._]+/g, '-');
  return { concept, axisSubject: normalizeConcept(concept) };
}

// ---------------------------------------------------------------------------
// the pure classifier (STRUCTURED fields only; prose is never read)
// ---------------------------------------------------------------------------

const DISPOSITION_BY_TYPE: Record<ContradictionType, Disposition> = {
  'direction-pair': 'menu',
  'hard-vs-hard': 'resolve',
  'standard-calibration': 'calibrate',
  'cross-type': 'note',
};

function opposingPolarity(a: DistilledRule, b: DistilledRule): boolean {
  return !!a.polarity && !!b.polarity && a.polarity !== b.polarity;
}

function measuredSignature(m?: MeasuredValue): string | null {
  if (!m) return null;
  const val = m.value !== undefined ? String(m.value) : '';
  const range = m.range !== undefined ? JSON.stringify(m.range) : '';
  const unit = m.unit !== undefined ? String(m.unit) : '';
  return `${val}|${range}|${unit}`;
}

/** Two standard-measurements disagree iff they pin the SAME property to a DIFFERENT value/range/unit. */
function measuredDisagree(a: DistilledRule, b: DistilledRule): boolean {
  if (!a.measured || !b.measured) return false;           // cannot calibrate without both values
  if (normalizeConcept(a.measured.property) !== normalizeConcept(b.measured.property)) return false;
  const sa = measuredSignature(a.measured);
  const sb = measuredSignature(b.measured);
  return sa !== sb;
}

function displayLabel(r: DistilledRule): string {
  const who = r.directionLabel ? `${r.source} (${r.directionLabel})` : r.source;
  return `${who}: ${r.claim}`;
}

function recommend(type: ContradictionType, axisSubject: string, a: DistilledRule, b: DistilledRule): string {
  switch (type) {
    case 'direction-pair':
      return `Keep both as a direction menu on "${axisSubject}" (${a.directionLabel || a.source} vs ${b.directionLabel || b.source}). This is the intended set of stances, not a conflict - never reconcile it.`;
    case 'hard-vs-hard':
      return `Real conflict on "${axisSubject}": ${displayLabel(a)} vs ${displayLabel(b)}. Two opposing absolutes cannot both hold - choose one.`;
    case 'standard-calibration':
      return `Measurement disagreement on "${axisSubject}": ${displayLabel(a)} vs ${displayLabel(b)}. Pick a single value or an accepted range.`;
    case 'cross-type':
      return `Cross-type tension on "${axisSubject}": ${displayLabel(a)} vs ${displayLabel(b)}. Different rule kinds - note it and decide by context.`;
  }
}

function makeRecord(type: ContradictionType, axisSubject: string, a: DistilledRule, b: DistilledRule): ContradictionRecord {
  const values = type === 'standard-calibration'
    ? [a.measured, b.measured].filter((m): m is MeasuredValue => !!m)
    : undefined;
  return {
    type,
    isConflict: type !== 'direction-pair',
    axisSubject,
    members: [a, b],
    values,
    recommendation: recommend(type, axisSubject, a, b),
    disposition: DISPOSITION_BY_TYPE[type],
  };
}

/**
 * Classify the contradiction (if any) between two distilled rules, PURELY from their structured
 * fields. Returns a full ContradictionRecord or null.
 *
 * null means "no contradiction to flag" - either the two rules are about DIFFERENT subjects
 * (different axisSubject), or they are about the same subject and AGREE (two same-polarity bans,
 * two identical measurements, a soft principle sharing an axis with a prescriptive rule).
 *
 * The classification order is deliberate:
 *   1. Same-axis gate. Different axisSubject => null (unrelated concepts).
 *   2. DIRECTION gate FIRST (load-bearing). If both rules are design-directions => direction-pair,
 *      no matter what their prose says. If exactly one is a direction, only a PRESCRIPTIVE other
 *      (a hard ban/mandate or a measured standard) stands in tension => cross-type; a soft principle
 *      sharing the axis is not a conflict => null.
 *   3. Two hard-prohibitives => hard-vs-hard only when their polarity OPPOSES (ban vs mandate).
 *   4. Two standard-measurements => standard-calibration only when they pin the same knob differently.
 *   5. A hard-prohibitive vs a standard-measurement => cross-type (a prescriptive tension).
 *   6. Anything else (a principle-guidance is involved) => null (too soft to be a hard conflict).
 */
export function classifyContradiction(a: DistilledRule, b: DistilledRule): ContradictionRecord | null {
  const axA = normalizeConcept(a.axisSubject);
  const axB = normalizeConcept(b.axisSubject);
  if (!axA || !axB || axA !== axB) return null;   // (1) unrelated concepts
  const axisSubject = a.axisSubject;

  const aDir = a.type === 'design-direction';
  const bDir = b.type === 'design-direction';

  // (2) direction gate, checked before every other rule.
  if (aDir && bDir) return makeRecord('direction-pair', axisSubject, a, b);
  if (aDir !== bDir) {
    const other = aDir ? b : a;
    if (other.type === 'hard-prohibitive' || other.type === 'standard-measurement') {
      return makeRecord('cross-type', axisSubject, a, b);
    }
    return null; // a direction vs a soft principle is not a conflict
  }

  // neither is a direction
  if (a.type === 'hard-prohibitive' && b.type === 'hard-prohibitive') {   // (3)
    return opposingPolarity(a, b) ? makeRecord('hard-vs-hard', axisSubject, a, b) : null;
  }
  if (a.type === 'standard-measurement' && b.type === 'standard-measurement') {   // (4)
    return measuredDisagree(a, b) ? makeRecord('standard-calibration', axisSubject, a, b) : null;
  }
  const kinds = new Set([a.type, b.type]);
  if (kinds.has('hard-prohibitive') && kinds.has('standard-measurement')) {   // (5)
    return makeRecord('cross-type', axisSubject, a, b);
  }
  return null;   // (6) a principle-guidance is involved - too soft to be a hard conflict
}

/** Empty, fully-typed contradiction buckets - the deterministic engine fills these. */
export function emptyContradictionsByType(): ContradictionsByType {
  return { 'direction-pair': [], 'hard-vs-hard': [], 'standard-calibration': [], 'cross-type': [] };
}
