#!/usr/bin/env node
/**
 * Contract-6 BIDIRECTIONAL CALIBRATION of the objective labeler (lead validity bar).
 *
 * The objective labeler is the ground-truth referee, so it is only trustworthy if it is
 * BIDIRECTIONALLY calibrated:
 *   (a) NO FALSE POSITIVES on a known-CLEAN gold-standard set -> each yields 0 objective defects.
 *   (b) NO FALSE NEGATIVES on planted-DEFECT fixtures -> each planted spec violation is caught,
 *       and its matched clean control stays silent.
 * A referee that fires on gov.uk, or misses a planted broken image, cannot grade A1-A4.
 *
 * Scope: the OBJECTIVE-STATIC classes (broken-image / justified-text / skipped-heading).
 * The OBJECTIVE-RENDERED classes (contrast, leading/tracking overlap) calibrate with the
 * rendered labeler (separate). Exit 0 = calibrated.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectiveLabelsStatic } from './objective-label.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus', 'candidates');
let fail = 0;

// (a) CLEAN gold-standard set: real shipped well-built pages that must yield 0 objective defects.
// gov.uk (GDS) is the canonical gold-standard; w3c + HN are clean references. (Expand as captured.)
const CLEAN = [
  { id: 'ed_govuk_live', why: 'gov.uk / GDS - canonical accessible gold-standard' },
  { id: 'ed_w3c_2020', why: 'w3.org - standards body' },
  { id: 'au_hn_live', why: 'Hacker News - minimal/utilitarian, clean' },
];
console.log('(a) CLEAN gold-standard set must yield 0 objective defects:');
let cleanChecked = 0;
for (const c of CLEAN) {
  const p = path.join(CORPUS, `${c.id}.html`);
  if (!existsSync(p)) { console.log(`  --  ${c.id} not captured (skip)`); continue; }
  cleanChecked++;
  const got = objectiveLabelsStatic(readFileSync(p, 'utf8'));
  if (got.length === 0) console.log(`  ok  ${c.id} -> [] (${c.why})`);
  else { console.error(`  FALSE-POSITIVE ${c.id} -> [${got.join(',')}] (${c.why})`); fail++; }
}
if (cleanChecked === 0) { console.error('  no clean gold-standard pages available - cannot calibrate (a)'); fail++; }

// (b) PLANTED-defect fixtures: each has exactly one known spec violation; matched clean control.
const doc = (head, body) => `<!doctype html><html><head><style>${head}</style></head><body>${body}</body></html>`;
const PLANTED = [
  { name: 'broken-image (empty src)', html: doc('', '<p>hi</p><img src="">'), expect: 'broken-image' },
  { name: 'broken-image clean control', html: doc('', '<p>hi</p><img src="/a.jpg" alt="a">'), expect: null },
  { name: 'justified-text on body', html: doc('.prose{text-align:justify}', '<div class="prose"><p>long body copy here</p></div>'), expect: 'justified-text' },
  { name: 'justified-text clean control', html: doc('.prose{text-align:left}', '<div class="prose"><p>left aligned</p></div>'), expect: null },
  { name: 'skipped-heading h1->h3', html: doc('', '<h1>Title</h1><h3>Sub</h3>'), expect: 'skipped-heading' },
  { name: 'skipped-heading clean control', html: doc('', '<h1>Title</h1><h2>Sub</h2><h3>Sub2</h3>'), expect: null },
];
console.log('\n(b) PLANTED-defect fixtures must be caught (and clean controls silent):');
for (const t of PLANTED) {
  const got = objectiveLabelsStatic(t.html);
  if (t.expect === null) {
    if (got.length === 0) console.log(`  ok  ${t.name} -> []`);
    else { console.error(`  FALSE-POSITIVE ${t.name} -> [${got.join(',')}]`); fail++; }
  } else if (got.includes(t.expect)) console.log(`  ok  ${t.name} -> caught [${got.join(',')}]`);
  else { console.error(`  FALSE-NEGATIVE ${t.name} -> [${got.join(',')}] (missed ${t.expect})`); fail++; }
}

if (fail === 0) { console.log('\nlabeler-calibration: BIDIRECTIONALLY CALIBRATED (0 FP on gold-standard, 0 FN on planted)'); process.exit(0); }
console.error(`\nlabeler-calibration: ${fail} CALIBRATION FAILURE(S)`); process.exit(1);
