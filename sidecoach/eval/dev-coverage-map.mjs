#!/usr/bin/env node
/**
 * Stage 1 ST0 GATE: the per-class COVERAGE MAP over the Codex-labeled dev corpus (the lead's gate before any ST1
 * detector). Reads corpus/dev-subjective-labels.json and counts, per subjective class, how many dev pages the
 * independent labeler marked PRESENT (+ a high-confidence subset). A class with too few dev instances cannot be
 * developed/validated against the dev signal and needs a DISJOINT top-up first.
 *
 * Thresholds: DEVELOPABLE >= 3 present | THIN 1-2 | ZERO 0. Writes corpus/dev-coverage-map.json (committed,
 * reproducible) and prints a table. No detector logic here - this only measures dev-signal coverage.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const SINK = path.join(CORPUS, 'dev-subjective-labels.json');

// The 22 subjective classes (the held taste frontier).
const CLASSES = ['cream-palette', 'ai-color-palette', 'hero-eyebrow-chip', 'repeated-section-kickers', 'numbered-section-markers', 'icon-tile-stack', 'italic-serif-display', 'nested-cards', 'side-stripe-borders', 'glassmorphism-default', 'hero-metric-template', 'gradient-text', 'marketing-buzzword', 'aphoristic-cadence', 'dark-glow', 'tiny-text', 'wide-tracking', 'all-caps-body', 'layout-transition', 'bounce-easing', 'tight-leading', 'extreme-negative-tracking'];
// The 5 already-shipped detectors (no-grandfathering: they get the SAME dev-coverage bar as new ones).
const EXISTING = new Set(['glassmorphism-default', 'hero-metric-template', 'gradient-text', 'side-stripe-borders', 'icon-tile-stack']);
const HI = 0.7;

const sink = JSON.parse(readFileSync(SINK, 'utf8'));
const labels = sink.labels || {};
const pages = Object.keys(labels);
const present = {}, hiconf = {}, examples = {};
for (const c of CLASSES) { present[c] = 0; hiconf[c] = 0; examples[c] = []; }
for (const id of pages) {
  for (const l of (labels[id].labels || [])) {
    if (l.present) { present[l.class]++; if ((l.confidence ?? 0) >= HI) hiconf[l.class]++; if (examples[l.class].length < 6) examples[l.class].push(id); }
  }
}
const rows = CLASSES.map((c) => ({
  class: c, present: present[c], highConfidence: hiconf[c], existingDetector: EXISTING.has(c),
  tier: present[c] >= 3 ? 'developable' : present[c] > 0 ? 'thin' : 'zero', examples: examples[c],
})).sort((a, b) => b.present - a.present);

const map = {
  generatedUtc: new Date().toISOString(),
  note: 'ST0 gate: per-class dev-signal coverage over the Codex-labeled dev corpus. DEVELOPABLE>=3, THIN 1-2, ZERO 0. A class below DEVELOPABLE needs a DISJOINT top-up before an ST1 detector can be developed/validated against it.',
  devPages: pages.length, highConfidenceThreshold: HI,
  tiers: {
    developable: rows.filter((r) => r.tier === 'developable').map((r) => r.class),
    thin: rows.filter((r) => r.tier === 'thin').map((r) => `${r.class}(${r.present})`),
    zero: rows.filter((r) => r.tier === 'zero').map((r) => r.class),
  },
  existingDetectorCoverage: rows.filter((r) => r.existingDetector).map((r) => ({ class: r.class, present: r.present, tier: r.tier })),
  perClass: rows,
};
writeFileSync(path.join(CORPUS, 'dev-coverage-map.json'), JSON.stringify(map, null, 2) + '\n');

console.log(`=== ST0 PER-CLASS COVERAGE MAP (${pages.length} dev pages) ===`);
console.log('class'.padEnd(28) + 'present  hi-conf  tier        existing');
for (const r of rows) console.log(r.class.padEnd(28) + String(r.present).padStart(5) + String(r.highConfidence).padStart(8) + '  ' + r.tier.padEnd(12) + (r.existingDetector ? 'YES' : ''));
console.log(`\nDEVELOPABLE (>=3): ${map.tiers.developable.length} | THIN (1-2): ${map.tiers.thin.length} | ZERO (0): ${map.tiers.zero.length}`);
console.log(`THIN: ${map.tiers.thin.join(', ')}`);
console.log(`ZERO: ${map.tiers.zero.join(', ')}`);
console.log(`EXISTING-detector coverage (no-grandfathering): ${map.existingDetectorCoverage.map((e) => `${e.class}=${e.present}(${e.tier})`).join(', ')}`);
console.log('-> corpus/dev-coverage-map.json');
