// P1-3: AbortSignal must be honored at EVERY phase (launch, navigation, collection),
// never returning available:true after an abort, never leaking a running browser, and
// not hanging until a phase finishes. The race + per-phase reason are exercised here at
// the launch phase deterministically (a near-immediate abort always lands during launch,
// which takes far longer than the scheduled abort); the same race wraps navigation and
// collection. Real-browser, SKIP-aware.
import { collectBrowserEvidence } from '../validators/browser-evidence-collector';

const url = `data:text/html,${encodeURIComponent('<!doctype html><main><p style="line-height:20px">x</p><button>b</button></main>')}`;

async function run() {
  // already-aborted -> rejected BEFORE launch, no browser started.
  const pre = new AbortController();
  pre.abort();
  const r0 = await collectBrowserEvidence(url, pre.signal);
  if (r0.available) throw new Error('already-aborted must not return available:true');
  if (!/aborted before launch/i.test(r0.reason)) throw new Error(`already-aborted reason wrong: ${r0.reason}`);

  // Is a browser launchable here? If not, skip the mid-op assertions.
  const base = await collectBrowserEvidence(url);
  if (!base.available) { console.log(`browser-evidence-abort: SKIP (${base.reason})`); return; }

  // Abort fired ~immediately lands DURING launch (launch >> a few ms). The collector
  // must observe it AT the launch phase (not only after navigation completes), returning
  // available:false with a launch-phase reason. Current pre-fix code can only report
  // "during navigation" (its sole post-goto check), so this assertion is the red->green.
  for (let i = 0; i < 2; i++) {
    const ac = new AbortController();
    const p = collectBrowserEvidence(url, ac.signal);
    setTimeout(() => ac.abort(), 2);
    const r = await p;
    if (r.available) throw new Error('mid-launch abort must not return available:true');
    if (!/aborted during launch/i.test(r.reason)) throw new Error(`mid-launch abort must be honored at the launch phase, got: ${r.reason}`);
  }

  // After aborted runs, a normal collection still succeeds (no hang, no leaked browser
  // starving subsequent launches).
  const after = await collectBrowserEvidence(url);
  if (!after.available) throw new Error('a normal collection must still succeed after aborted runs');

  console.log('browser-evidence-abort: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
