// Anchor probe: run the SHIPPING inPageBuzzword + buzzwordFindingFromScore against three
// fixtures and print the RAW score object. No reimplementation of the detector.
const { chromium } = require('playwright');
const { inPageBuzzword, buzzwordFindingFromScore, BUZZ_DENSITY_THRESHOLD, BUZZ_MIN_DISTINCT_PEAK } =
  require('../dist/validators/subjective-rendered-scanner');
const { pathToFileURL } = require('url');

(async () => {
  console.log('BUZZ_DENSITY_THRESHOLD =', BUZZ_DENSITY_THRESHOLD, ' BUZZ_MIN_DISTINCT_PEAK =', BUZZ_MIN_DISTINCT_PEAK);
  const b = await chromium.launch();
  for (const f of process.argv.slice(2)) {
    const p = await b.newPage();
    await p.goto(pathToFileURL(f).href, { waitUntil: 'load' });
    const s = await p.evaluate(inPageBuzzword);
    const finding = buzzwordFindingFromScore(s);
    console.log('\n--- ' + f);
    console.log('  words=' + s.words + '  weighted=' + s.weighted + '  density=' + s.density.toFixed(2) +
                '  effectiveDensity=' + s.effectiveDensity.toFixed(2));
    console.log('  distinctPeak=' + s.distinctPeak + '  distinctStrong=' + s.distinctStrong +
                '  peakOccurrences=' + s.peakOccurrences);
    console.log('  matched=' + JSON.stringify(s.matched));
    console.log('  FIRES? ' + (finding ? 'YES -> ' + finding.rule + ' :: ' + finding.detail : 'NO'));
    await p.close();
  }
  await b.close();
})();
