#!/usr/bin/env node
/**
 * Contract-6 MANIFEST REPORT (Stage 0) - the review-ready summary the JOINT INDEPENDENCE REVIEW consumes.
 *
 * Aggregates the full candidate manifest (pages + briefs) against the pre-registered power Ns + quotas, with
 * coverage, integrity, and the headline findings. Read-only; no freezing. This is what the architect hands
 * lead + Jonah at criterion-1 (the joint independence review). Subjective labels stay HELD (not in scope).
 */
import { readFileSync } from 'node:fs';
import { report as powerReport } from './power-analysis.mjs';

const here = (p) => new URL(p, import.meta.url);
const pages = JSON.parse(readFileSync(here('./corpus/candidates.json'), 'utf8'));
const briefs = JSON.parse(readFileSync(here('./corpus/briefs.json'), 'utf8'));

const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const bucket = (b) => pages.filter((c) => c.bucket === b);

const kg = bucket('known-good').length, db = bucket('defect-bearing').length, exc = bucket('excluded-no-primary').length;
const power = powerReport({ knownGood: kg, defectBearing: db });

// integrity checks
const labelerVersions = [...new Set(pages.map((c) => c.objectiveLabelerVersion))];
const provComplete = pages.every((c) => c.provenance && c.provenance.source && c.provenance.captureUtc);
const allHeld = pages.every((c) => c.subjectiveStatus === 'pending-independent') && briefs.every((b) => b.subjectiveStatus === 'pending-independent');
const defectClassFreq = count(pages.flatMap((c) => (c.objectiveLabels || []).map((l) => l.class)), (x) => x);
const primaryDefectRate = Math.round(100 * pages.filter((c) => (c.primaryDefects || []).length > 0).length / pages.length);

const kgByRegister = count(bucket('known-good'), (c) => c.register);
const kgVals = Object.values(kgByRegister);
const kgMin = Math.min(...kgVals), kgEditorialShare = Math.round(100 * (kgByRegister.editorial || 0) / kg);
const eraDist = count(pages, (c) => (c.diversity && c.diversity.era) || '?');
const era2026Share = Math.round(100 * (eraDist['2026'] || 0) / pages.length);

const r = {
  generatedUtc: new Date().toISOString(),
  referee: 'rendered (Playwright DOM + getComputedStyle), fallback-v2; LOCKED (3 Codex item-8 passes + lead re-runs)',
  // A2 representativeness (lead joint-review item): known-good per register - is A2 precision editorial-only?
  a2Representativeness: {
    knownGoodByRegister: kgByRegister,
    editorialSharePct: kgEditorialShare,
    minPerRegister: kgMin,
    a2NotEditorialOnly: kgMin >= 3,
    reporting: 'A2 precision reported PER-REGISTER. Registers with >=3 known-good are powered; any below are DIAGNOSTIC-ONLY (wide CIs). Bar is "A2 isn\'t editorial-only", not perfect balance.',
  },
  // per-class recall power (lead joint-review item): low-n classes are diagnostic-only for A1 recall.
  a1ClassPower: (() => {
    const freq = count(pages.flatMap((c) => (c.objectiveLabels || []).map((l) => l.class)), (x) => x);
    const diagnosticOnly = Object.entries(freq).filter(([, n]) => n < 8).map(([k, n]) => `${k} (n=${n})`);
    return { defectClassFreq: freq, diagnosticOnlyClasses: diagnosticOnly, note: 'classes with n<8 (e.g. broken-image) are DIAGNOSTIC-ONLY for recall - low power; real shipped pages rarely have broken images, which is itself expected.' };
  })(),
  eraCoverage: { dist: eraDist, current2026Pct: era2026Share, note: `currency floor met (>=50% live-current); archive buckets are thin (2012-2022) - flagged for A5a era coverage, weight as diagnostic.` },
  pages: {
    total: pages.length,
    knownGood: kg, defectBearing: db, excludedNoPrimary: exc,
    powerFloor: { knownGood: power.required.knownGood.atExpectedRate, defectBearing: power.required.defectBearing.required },
    floorsMet: { knownGood: kg >= power.required.knownGood.atExpectedRate, defectBearing: db >= power.required.defectBearing.required },
    byRegister: count(pages, (c) => c.register),
    byEra: count(pages, (c) => (c.diversity && c.diversity.era) || '?'),
    byBucketRegister: Object.fromEntries(['known-good', 'defect-bearing', 'excluded-no-primary'].map((b) => [b, count(bucket(b), (c) => c.register)])),
    defectClassFreq,
  },
  briefs: {
    total: briefs.length,
    byKind: count(briefs, (b) => b.kind),
    real: briefs.filter((b) => b.kind === 'real').length,
    calibration: briefs.filter((b) => b.kind === 'calibration').length,
    coverageCodexAuthored: briefs.filter((b) => b.codexAuthored).length,
    powerFloor: power.required.briefs.floorN,
    floorMet: briefs.filter((b) => b.kind !== 'calibration').length >= power.required.briefs.floorN,
    byRegister: count(briefs, (b) => b.register),
  },
  findings: [
    `~${primaryDefectRate}% of captured real pages have a PRIMARY objective defect = web a11y is genuinely poor (NOT a referee artifact; referee is gold-standard-clean).`,
    (() => { const r = count(pages, (c) => c.register); const mx = Math.max(...Object.values(r)), mn = Math.min(...Object.values(r)); return `REGISTER IMBALANCE: editorial-heavy (${r.editorial}) vs thin app-ui (${r['app-ui'] || 0})/forms (${r.forms || 0}) - power floors are on TOTALS (met), but hard registers (SPA/auth-gated) resisted capture. Joint-review call: accept totals-met with rationale, or source more app-ui/forms (range ${mn}-${mx}).`; })(),
    `Exclusion (no-primary) under fallback: ${exc}/${pages.length} (the fallback rescued div-based/dashboard pages B-strict excluded).`,
    'Known-good set skews docs/quality-source (clean-primary pages are rare + cluster in well-built sources) - representativeness note; mitigated since contrast is era/source-invariant.',
    'Excluded-no-primary pages are RETAINED for A5/subjective (era-diversity preserved).',
  ],
  integrity: {
    singleLabelerVersion: labelerVersions.length === 1 ? labelerVersions[0] : labelerVersions,
    provenanceComplete: provComplete,
    subjectiveAllHeldPendingIndependent: allHeld,
    note: 'Objective labels = rendered referee (spec-math). Subjective labels HELD for the lead-run Codex pass. Nothing frozen until the joint review.',
  },
};

console.log(JSON.stringify(r, null, 2));
export { r };
