import { runValidatorForTest } from '../validators/run-validator';
import type { BrowserEvidenceCollection } from '../validators/browser-evidence-collector';

const failedCollector = async (): Promise<BrowserEvidenceCollection> => ({ available: false, reason: 'injected no browser' });

async function run() {
  const noUrl = await runValidatorForTest('static-a11y', { cssText: '', markup: '', files: [] });
  // a11y.color-contrast dropped: Stage 6 migrated it to the rendered scan, so it is no longer a browser/collector
  // rule. Collector degradation is covered by the dom-backed min-hit-area; color-contrast's rendered degradation
  // lives in the rendered-scan tests.
  for (const id of ['a11y.min-hit-area']) {
    const x = noUrl.executions.find((e) => e.result.ruleId === id);
    if (!x || x.result.status !== 'inconclusive') throw new Error(`${id}: no URL must surface inconclusive`);
    if (noUrl.activePolicy.requiredRuleIds.includes(id)) throw new Error(`${id}: no URL must not promote browser rule`);
  }

  const failed = await runValidatorForTest(
    'static-a11y',
    { cssText: '', markup: '', files: [], renderUrl: 'data:text/html,test' },
    { collectBrowserEvidence: failedCollector },
  );
  // a11y.color-contrast dropped: Stage 6 migrated it to the rendered scan, so it is no longer a browser/collector
  // rule. Collector degradation is covered by the dom-backed min-hit-area; color-contrast's rendered degradation
  // lives in the rendered-scan tests.
  for (const id of ['a11y.min-hit-area']) {
    const x = failed.executions.find((e) => e.result.ruleId === id);
    if (!x || x.result.status !== 'inconclusive') throw new Error(`${id}: collector failure must surface inconclusive`);
    if (failed.activePolicy.requiredRuleIds.includes(id)) throw new Error(`${id}: collector failure must not promote browser rule`);
  }
  if (failed.result.status === 'error') throw new Error('collector failure must never become validator error');

  const withCollector = await runValidatorForTest(
    'polish-standard',
    { cssText: '', markup: '', files: [], renderUrl: 'data:text/html,test' },
    {
      collectBrowserEvidence: async (renderUrl) => ({
        available: true,
        evidence: {
          browserEvidence: { available: true, kinds: ['computed-style', 'dom', 'contrast'], renderUrl: renderUrl! },
          computedStyle: {
            'concentric.checkedPairs': '1',
            'concentric.failingPairs': '0',
            'typography.checkedElements': '1',
            'typography.invalidLineHeightElements': '0',
          },
          dom: { minHitArea: { checked: 1, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
          contrast: { wcagAA: true, ratio: 7 },
        },
      }),
    },
  );
  const genericity = withCollector.executions.find((e) => e.result.ruleId === 'polish.anti-pattern-genericity');
  if (!genericity || genericity.result.status !== 'inconclusive') throw new Error('genericity must stay inconclusive with collector and valid URL');
  if (withCollector.activePolicy.requiredRuleIds.includes('polish.anti-pattern-genericity')) throw new Error('genericity must stay non-required with collector');

  console.log('browser-evidence-degradation: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
