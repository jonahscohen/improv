#!/usr/bin/env node
/**
 * default-typeface PRECISION MEASUREMENT (2026-07-28) - and the evidence for gating ground A.
 *
 * The class had no precision number at all. This runs the SHIPPING scorer against the ONLY corpus that carries
 * default-typeface labels: the 23-page A5a set (11 synthetic fixtures + 12 real dev-corpus pages). Ground A is
 * opted IN here so the detector stays measurable while it is gated out of the product default.
 *
 * WHAT IT SHOWS, and why the answer is "gate it" rather than a number:
 *   - all 5 labeled POSITIVES are synthetic fixtures authored alongside the detector;
 *   - all 12 labeled REAL pages are NEGATIVES, and it is correctly silent on every one;
 *   - so P/R come out 1.000/1.000 while measuring only that the detector satisfies its own specification;
 *   - meanwhile it fires on 31/90 candidate pages and 9/37 held-out pages, and NONE of those 40 carries a label.
 * Precision on real pages is therefore 0 true positives over 0 labeled fires - UNDEFINED, not low.
 *
 * Usage: npm run build && node eval/default-typeface-precision-measure.mjs
 * Exit 0 ok, 2 dist missing, 5 a labeled page had no file (a silent skip would move the denominator).
 */
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';
const DIST = process.cwd() + '/dist/validators/subjective-rendered-scanner.js';
if (!existsSync(DIST)) { console.error('default-typeface-precision-measure: dist not built. Run npm run build.'); process.exit(2); }
const M = await import(DIST);
const L = JSON.parse(readFileSync('eval/corpus/typeface-a5a-labels.json','utf8')).labels;
const paths = (id) => [`eval/fixtures/default-typeface/${id}.html`, `eval/corpus/dev/${id}.html`].find(existsSync);
const b = await chromium.launch({headless:true});
let tp=0,fp=0,fn=0,tn=0; const rows=[];
for (const [id,v] of Object.entries(L)) {
  const lab=(v.labels||[]).find(x=>x.class==='default-typeface'); if(!lab) continue;
  // FAIL CLOSED. Skipping a labeled page changes the A5a denominator, and every number below is a ratio over it.
  const f=paths(id);
  if(!f){ console.error(`default-typeface-precision-measure: labeled page "${id}" has no file - the denominator would silently shrink.`); await b.close(); process.exit(5); }
  const ctx=await b.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce',deviceScaleFactor:1});
  const pg=await ctx.newPage();
  await pg.route('**/*',(r)=>{const u=r.request().url();return (u.startsWith('data:')||u.startsWith('about:'))?r.continue():r.abort();});
  await pg.setContent(M.stripScripts(readFileSync(f,'utf8')),{waitUntil:'domcontentloaded',timeout:60000});
  const sc=await pg.evaluate(M.inPageTypeface); await ctx.close();
  const fire = M.typefaceFindingFromScore(sc, { enableDefaultStackGround: true }) !== null;  // ground A opted IN: it is gated off by default
  const gt=!!lab.present;
  if(gt&&fire)tp++;else if(gt&&!fire)fn++;else if(!gt&&fire)fp++;else tn++;
  rows.push(`${id.padEnd(36)} gt=${gt?'P':'.'} fire=${fire?'F':'.'} share=${sc.defaultStackShare.toFixed(3)} chars=${sc.contentChars}`);
}
await b.close();
console.log(rows.join('\n'));
const EXPECTED_LABELED = 23, EXPECTED_POSITIVES = 5;
if (rows.length !== EXPECTED_LABELED || tp + fn !== EXPECTED_POSITIVES) {
  console.error(`default-typeface-precision-measure: expected ${EXPECTED_LABELED} labeled pages with ${EXPECTED_POSITIVES} positives, scored ${rows.length} with ${tp + fn}.`);
  console.error('The label set changed. Re-read it before trusting any number below.');
  process.exit(5);
}
console.log(`\nA5a set: TP=${tp} FP=${fp} FN=${fn} TN=${tn}  P=${tp+fp?(tp/(tp+fp)).toFixed(3):'undefined (no fires)'}  R=${tp+fn?(tp/(tp+fn)).toFixed(3):'n/a'}`);
const realIds = new Set(['overreacted','martinfowler','postgres-docs','redis-docs','nextjs-docs','census','nasa','ghost','linear','supabase','framer','raycast']);
const realPos = rows.filter((r) => realIds.has(r.split(' ')[0]) && r.includes('gt=P')).length;
console.log(`REAL pages labeled PRESENT for this class: ${realPos} of ${realIds.size}.`);
console.log('Every labeled positive is a SYNTHETIC fixture, so the 1.000 above measures self-consistency, not precision.');
console.log('Real-page precision is UNDEFINED (0 labeled fires). Ground A ships GATED until the 40 unlabeled real-page fires are adjudicated.');
