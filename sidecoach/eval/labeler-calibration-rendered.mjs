#!/usr/bin/env node
/**
 * Contract-6 BIDIRECTIONAL CALIBRATION of the RENDERED objective labeler (the terminal referee).
 * Lead reinforcement 5: full calibration must pass before ANY labels freeze. Reinforcement 2:
 * Codex's adversarial cases are LOCKED here as permanent regression fixtures - the referee must
 * pass them forever, so no future change silently regresses them.
 *
 * Three gates:
 *  (a) CLEAN gold-standard real pages -> 0 OBJECTIVE defects (no false positives).
 *  (b) PLANTED-defect fixtures -> caught; clean controls silent (no false negatives).
 *  (c) ADVERSARIAL fixtures (Codex item-8) -> handled correctly (the regex referee failed these).
 * Exit 0 = calibrated. Requires Playwright (the rendered pass).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectiveLabelsRendered, classifyKnownGood, closeBrowser, meta } from './objective-label-rendered.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus', 'candidates');
const doc = (head, body) => `<!doctype html><html><head><style>${head}</style></head><body>${body}</body></html>`;
let fail = 0;

// (a) CLEAN gold-standard: recognized well-built / accessible pages -> must yield 0 objective defects.
const CLEAN = [
  { id: 'ed_govuk_live', why: 'gov.uk / GDS - canonical accessible gold-standard' },
  { id: 'ed_w3c_2020', why: 'w3.org - standards body' },
  { id: 'ed_mdn_live', why: 'MDN - reference docs' },
  { id: 'ed_nngroup_live', why: 'Nielsen Norman Group - UX authority' },
];

// (c) ADVERSARIAL fixtures (Codex item-8) - PERMANENT regression contract. {expect:null} = must be clean.
const ADVERSARIAL = [
  { name: 'comment-img', html: doc('', '<!-- <img> --><p>hi</p>'), expectAbsent: 'broken-image' },
  { name: 'data-src lazy (no real src)', html: doc('', '<img data-src="/lazy.jpg" alt="">'), expect: 'broken-image' },
  { name: 'custom prop --text-align', html: doc('body{--text-align:justify}', '<p>body</p>'), expectAbsent: 'justified-text' },
  { name: 'cascade justify then left', html: doc('.prose{text-align:justify}.prose{text-align:left}', '<div class="prose"><p>x</p></div>'), expectAbsent: 'justified-text' },
  { name: 'sr-only off-screen text not contrast-checked', html: doc('.s{position:absolute;left:-9999px}', '<p class="s" style="color:#bbb">hidden</p><p style="color:#111">visible</p>'), expectAbsent: 'low-contrast' },
  // --- rebuilt-referee Codex item-8 findings, locked as permanent regression fixtures ---
  { name: '#1 ancestor opacity:0 -> no contrast label', html: doc('', '<div style="opacity:0"><p style="color:#bbb;background:#fff">x</p></div>'), expectAbsent: 'low-contrast' },
  { name: '#2 inline span justify -> no justified-text', html: doc('', '<p><span style="text-align:justify">inline</span></p>'), expectAbsent: 'justified-text' },
  { name: '#3 h2 role=presentation then h4 -> no skip', html: doc('', '<h2 role="presentation">deco</h2><h4>real</h4>'), expectAbsent: 'skipped-heading' },
  { name: '#5 role="heading fallback" aria-level then heading l3 -> skip caught', html: doc('', '<div role="heading fallback" aria-level="1">A</div><div role="heading" aria-level="3">B</div>'), expect: 'skipped-heading' },
  { name: '#7 stacked translucent bg contrast (red/blue/white) -> correct', html: doc('', '<div style="background:rgba(0,0,255,.5)"><p style="background:rgba(255,0,0,.5);color:rgb(200,200,200)">stacked</p></div>'), expect: 'low-contrast' },
  { name: '#9 partial ancestor opacity -> indeterminate not wrong-flag', html: doc('', '<div style="opacity:.5"><p style="color:#000;background:#fff">x</p></div>'), expectAbsent: 'low-contrast' },
  { name: '#10 inert subtree heading excluded from outline', html: doc('', '<h1>A</h1><div inert><h2>hidden</h2></div><h2>B</h2>'), expectAbsent: 'skipped-heading' },
  { name: '#12 JS disabled -> deterministic (script no-op)', html: doc('', '<h1>A</h1><h2>B</h2><script>document.body.innerHTML="<h1>A</h1><h3>B</h3>"</script>'), expectAbsent: 'skipped-heading' },
  { name: '#4 contrast on <code> (broadened text detection)', html: doc('body{background:#fff}.bad{color:#bbb}', '<p><code class="bad">low contrast code</code></p>'), expect: 'low-contrast' },
];

// (b) PLANTED defects + clean controls.
const PLANTED = [
  { name: 'broken-image empty src', html: doc('', '<img src="">'), expect: 'broken-image' },
  { name: 'broken-image clean control', html: doc('', '<img src="/a.jpg" alt="a">'), expect: null },
  { name: 'justified body', html: doc('.prose{text-align:justify}', '<div class="prose"><p>justified body copy</p></div>'), expect: 'justified-text' },
  { name: 'justified clean control', html: doc('.prose{text-align:left}', '<div class="prose"><p>left</p></div>'), expect: null },
  { name: 'skipped-heading h1->h3', html: doc('', '<h1>T</h1><h3>S</h3>'), expect: 'skipped-heading' },
  { name: 'skipped clean control', html: doc('', '<h1>T</h1><h2>S</h2><h3>S2</h3>'), expect: null },
  { name: 'low-contrast gray on white', html: doc('body{background:#fff}p{color:#bbb}', '<p>low contrast</p>'), expect: 'low-contrast' },
  { name: 'good-contrast control', html: doc('body{background:#fff}p{color:#111}', '<p>fine</p>'), expect: null },
];

async function run() {
  console.log('referee:', JSON.stringify(await meta()));
  console.log('\n(a) CLEAN gold-standard -> 0 objective defects:');
  let cleanN = 0;
  for (const c of CLEAN) {
    const p = path.join(CORPUS, `${c.id}.html`);
    if (!existsSync(p)) { console.log(`  --  ${c.id} not captured (skip)`); continue; }
    cleanN++;
    const r = await objectiveLabelsRendered(readFileSync(p, 'utf8'));
    if (r.labels.length === 0) console.log(`  ok  ${c.id} -> [] (${c.why})`);
    else { console.error(`  FALSE-POSITIVE ${c.id} -> [${r.labels.join(',')}] (${c.why})`); fail++; }
  }
  if (cleanN === 0) { console.error('  no gold-standard pages available'); fail++; }

  console.log('\n(b) PLANTED defects caught / controls silent:');
  for (const t of PLANTED) {
    const got = (await objectiveLabelsRendered(t.html)).labels;
    if (t.expect === null) { if (got.length === 0) console.log(`  ok  ${t.name} -> []`); else { console.error(`  FALSE-POSITIVE ${t.name} -> [${got.join(',')}]`); fail++; } }
    else if (got.includes(t.expect)) console.log(`  ok  ${t.name} -> caught [${got.join(',')}]`);
    else { console.error(`  FALSE-NEGATIVE ${t.name} -> [${got.join(',')}] (missed ${t.expect})`); fail++; }
  }

  console.log('\n(c) ADVERSARIAL (Codex item-8) - permanent regression fixtures:');
  for (const t of ADVERSARIAL) {
    const got = (await objectiveLabelsRendered(t.html)).labels;
    if (t.expect) { if (got.includes(t.expect)) console.log(`  ok  ${t.name} -> caught [${got.join(',')}]`); else { console.error(`  REGRESSED ${t.name} -> [${got.join(',')}] (missed ${t.expect})`); fail++; } }
    else { if (!got.includes(t.expectAbsent)) console.log(`  ok  ${t.name} -> ${t.expectAbsent} correctly absent [${got.join(',')}]`); else { console.error(`  REGRESSED ${t.name} -> [${got.join(',')}] (${t.expectAbsent} should be absent)`); fail++; } }
  }

  // (d) LANDMARK CLASSIFICATION (Jonah ruling B) - known-good = primary-content-clean; peripheral
  // chrome defects don't disqualify; no primary region -> excluded. Full-page labels unchanged.
  console.log('\n(d) LANDMARK CLASSIFICATION (ruling B) - primary-content known-good:');
  const LAND = [
    { name: 'peripheral-only defect in <footer> -> known-good', html: doc('body{background:#fff}.f{color:#bbb}', '<main><p style="color:#111">clean primary</p></main><footer><a class="f">low-contrast footer</a></footer>'), want: 'knownGood' },
    { name: 'primary defect in <main> -> defect-bearing', html: doc('body{background:#fff}.b{color:#bbb}', '<main><p class="b">low-contrast primary</p></main>'), want: 'defectBearing' },
    { name: 'clean primary + clean chrome -> known-good', html: doc('', '<main><p style="color:#111;background:#fff">clean</p></main>'), want: 'knownGood' },
    { name: 'fallback: no-landmark div content is PRIMARY -> defect-bearing', html: doc('body{background:#fff}.b{color:#bbb}', '<div><p class="b">no landmark</p></div>'), want: 'defectBearing' },
    { name: 'fallback: fully-chrome page (all content in footer) -> excluded', html: doc('body{background:#fff}.b{color:#bbb}', '<footer><p class="b">only chrome</p></footer>'), want: 'excluded' },
    { name: 'fallback: no-landmark clean div content -> known-good', html: doc('', '<div><p style="color:#111;background:#fff">clean non-chrome</p></div>'), want: 'knownGood' },
    // Codex fallback findings: eligibility consistent with the defect pass.
    { name: 'fallback #1: broken-image-only non-chrome (no text) -> defect-bearing not excluded', html: doc('', '<div><img src=""></div>'), want: 'defectBearing' },
    { name: 'fallback #1: form-control-only non-chrome content -> eligible (known-good if clean)', html: doc('', '<div><input value="x" style="color:#111;background:#fff"></div>'), want: 'knownGood' },
    { name: 'fallback #2: all-chrome + off-screen-right text -> still excluded', html: doc('body{background:#fff}.b{color:#bbb}', '<footer><p>chrome</p></footer><p class="b" style="position:absolute;left:5000px">offscreen-right</p>'), want: 'excluded' },
    { name: 'peripheral defect must remain in FULL-PAGE labels (true positive, not FP)', html: doc('body{background:#fff}.f{color:#bbb}', '<main><p style="color:#111">clean</p></main><footer><a class="f">x</a></footer>'), wantLabel: 'low-contrast' },
    // role-override precedence (Codex landmark finding): explicit ARIA role overrides the implicit tag role.
    { name: 'role override: <nav role=main> defect -> defect-bearing (primary)', html: doc('body{background:#fff}.b{color:#bbb}', '<nav role="main"><p class="b">x</p></nav>'), want: 'defectBearing' },
    { name: 'role override: <main role=navigation> defect is peripheral -> known-good', html: doc('body{background:#fff}.b{color:#bbb}', '<main role="navigation"><a class="b">nav</a></main><article><p style="color:#111">clean primary</p></article>'), want: 'knownGood' },
  ];
  for (const t of LAND) {
    const r = await objectiveLabelsRendered(t.html);
    if (t.wantLabel) { if (r.labels.includes(t.wantLabel)) console.log(`  ok  ${t.name} -> full-page has [${r.labels.join(',')}]`); else { console.error(`  FAIL ${t.name} -> full-page [${r.labels.join(',')}] missing ${t.wantLabel}`); fail++; } continue; }
    const cl = classifyKnownGood(r);
    if (cl[t.want]) console.log(`  ok  ${t.name} -> ${t.want}`);
    else { console.error(`  FAIL ${t.name} -> kg=${cl.knownGood} db=${cl.defectBearing} exc=${cl.excluded} (want ${t.want})`); fail++; }
  }
}

run().then(async () => {
  await closeBrowser();
  if (fail === 0) { console.log('\nlabeler-calibration-rendered: BIDIRECTIONALLY CALIBRATED (clean gold-standard, planted caught, adversarial held)'); process.exit(0); }
  console.error(`\nlabeler-calibration-rendered: ${fail} FAILURE(S)`); process.exit(1);
}).catch(async (e) => { await closeBrowser(); console.error('calibration error:', e.message); process.exit(1); });
