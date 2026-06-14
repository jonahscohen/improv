// Task 8: convergence preflight evaluates EVERY requiredCoverageByScope record
// independently with AND-across-requirements / OR-within-a-requirement.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { convergencePreflight, evaluateCoverageRecordForTest } from '../lane-convergence-preflight';

async function run() {
  // --- direct regression: do not flatten requirement families or records ---
  const synthetic = evaluateCoverageRecordForTest(
    { ruleId: 'r.synthetic', scope: 'project', evidenceAlternativesByRequirement: [['css', 'scss'], ['html', 'tsx']], requireAllDiscoveredApplicableFiles: false },
    [{ path: 'style.css', sourceKind: 'css', outcome: 'inspected' }],
  );
  if (synthetic.ok) throw new Error('CSS satisfies only requirement 0; missing markup requirement must reject');
  if (synthetic.missingRequirements.map((x) => x.requirementIndex).join(',') !== '1') throw new Error('must report exact unsatisfied requirement family');

  // --- independent record evaluation: a CSS-only target satisfies the CSS record but
  // not the markup record; only the markup record is reported (no flattening). ---
  const recCssOnly = evaluateCoverageRecordForTest(
    { ruleId: 'r.css', scope: 'project', evidenceAlternativesByRequirement: [['css', 'scss']], requireAllDiscoveredApplicableFiles: false },
    [{ path: 'style.css', sourceKind: 'css', outcome: 'inspected' }],
  );
  if (!recCssOnly.ok) throw new Error('a CSS-only record is satisfied by a CSS file');
  const recMarkupOnly = evaluateCoverageRecordForTest(
    { ruleId: 'r.markup', scope: 'project', evidenceAlternativesByRequirement: [['html', 'tsx']], requireAllDiscoveredApplicableFiles: false },
    [{ path: 'style.css', sourceKind: 'css', outcome: 'inspected' }],
  );
  if (recMarkupOnly.ok) throw new Error('a markup-only record is NOT satisfied by a CSS-only target');
  if (recMarkupOnly.missingRequirements.map((x) => x.requirementIndex).join(',') !== '0') throw new Error('markup record must report its own requirement family');

  // --- empty target: no supported sources -> reject, gap names a required validator ---
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-empty-'));
  const r1 = await convergencePreflight(empty, 'lane_converge');
  if (r1.ok) throw new Error('an empty target cannot satisfy the release floor');
  if (r1.gaps.length === 0) throw new Error('preflight names the unmet validator(s)');
  if (!/cannot be measured/.test(r1.message || '')) throw new Error('actionable message: ' + r1.message);

  // --- CSS + HTML target: supported -> ok ---
  const good = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-good-'));
  fs.writeFileSync(path.join(good, 'style.css'), '.btn { color: #111; }\n');
  fs.writeFileSync(path.join(good, 'index.html'), '<!doctype html><html><body><button>Go</button></body></html>\n');
  const r2 = await convergencePreflight(good, 'lane_converge');
  if (!r2.ok) throw new Error('a CSS+HTML target meets the release floor, got: ' + r2.message);

  // --- CSS-only target satisfies the css-rule floor but NOT the markup-only required
  // rules (polish.animatepresence-initial + the anti-pattern project rules). The merged
  // release floor carries the markup requirement in polish-standard/anti-pattern, not
  // static-a11y (whose required a11y.focus-visible is a css-rule check). ---
  const cssOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-css-only-'));
  fs.writeFileSync(path.join(cssOnly, 'style.css'), '.btn { color: #111; }\n');
  const rCssOnly = await convergencePreflight(cssOnly, 'lane_converge');
  if (rCssOnly.ok) throw new Error('CSS-only/markup-unsupported target must reject');
  if (!rCssOnly.gaps.some((g) => g.validatorId === 'anti-pattern' && g.ruleId && g.missingRequirements.length)) {
    throw new Error('css-only rejection must name an exact rule/requirement/source gap for a markup-needing validator: ' + JSON.stringify(rCssOnly.gaps));
  }

  // --- mixed source: supported HTML/CSS plus unsupported Vue file must reject ---
  fs.writeFileSync(path.join(good, 'Widget.vue'), '<template><button>Go</button></template>\n');
  const mixed = await convergencePreflight(good, 'lane_converge');
  if (mixed.ok) throw new Error('mixed target with an uncovered applicable source file must reject');
  if (!mixed.gaps.some((g) => g.sourceFile === 'Widget.vue')) throw new Error('mixed-source gap must name Widget.vue: ' + JSON.stringify(mixed.gaps));

  // --- unknown lane / no policy -> reject ---
  const r3 = await convergencePreflight(good, 'lane_build');
  if (r3.ok) throw new Error('a lane with no policy cannot preflight as a convergence lane');

  console.log('lane-convergence-preflight: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
