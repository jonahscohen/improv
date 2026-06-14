// P2: concentric-radius must inspect EVERY visible direct child of a rounded parent,
// not just the first. A clean first child must not hide a failing sibling.
import { collectBrowserEvidence } from '../validators/browser-evidence-collector';
import { POLISH_CHECKS } from '../validators/checks/polish-checks';
import type { ProductCheckContext } from '../validators/check-context';

// Parent: border-radius 12px, padding 4px -> a concentric inner radius should be 12-4=8.
// First child radius 8 (CLEAN: 12 == 8+4). Second child radius 20 (FAIL: 12 != 20+4).
// A first-child-only scan would see only the clean child and wrongly PASS.
const html = `<!doctype html><main>`
  + `<div style="border-radius:12px;padding:4px;background:#eeeeee">`
  + `<div style="border-radius:8px;background:#cccccc;width:40px;height:40px">a</div>`
  + `<div style="border-radius:20px;background:#cccccc;width:40px;height:40px">b</div>`
  + `</div></main>`;

async function run() {
  const renderUrl = `data:text/html,${encodeURIComponent(html)}`;
  const r = await collectBrowserEvidence(renderUrl);
  if (!r.available) { console.log(`browser-evidence-concentric: SKIP (${r.reason})`); return; }
  const e = r.evidence;
  if (Number(e.computedStyle['concentric.checkedPairs']) < 2) {
    throw new Error(`both visible children must be checked, got checkedPairs=${e.computedStyle['concentric.checkedPairs']}`);
  }
  if (Number(e.computedStyle['concentric.failingPairs']) < 1) {
    throw new Error('a failing sibling behind a clean first child must be counted as failing');
  }
  const ctx: ProductCheckContext = { cssText: '', markup: '', files: [], renderUrl, ...e };
  if (POLISH_CHECKS['polish/concentric-radius'](ctx).status !== 'fail') {
    throw new Error('a failing sibling must make concentric-radius FAIL, not PASS');
  }
  console.log('browser-evidence-concentric: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
