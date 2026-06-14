// P1-2: the collector must be hermetic - same-origin (and inline data:) subresources
// only; cross-origin HTTP, Service Workers, and ALL WebSockets blocked. The allow
// decision is a pure exported function so the policy is proven deterministically with
// NO network; a real-browser case proves collection still completes when a page
// references blocked subresources.
import { collectBrowserEvidence, isSubresourceAllowed } from '../validators/browser-evidence-collector';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

async function run() {
  // --- hermetic policy unit test (no browser, no network) ---
  // data: document - only inline data: subresources allowed
  assert(isSubresourceAllowed('data:text/html,x', 'data:image/png;base64,AAAA') === true, 'data: doc may load data: subresource');
  assert(isSubresourceAllowed('data:text/html,x', 'http://evil.example/a.png') === false, 'data: doc must block cross-origin http');
  assert(isSubresourceAllowed('data:text/html,x', 'https://evil.example/a.png') === false, 'data: doc must block cross-origin https');
  assert(isSubresourceAllowed('data:text/html,x', 'ws://evil.example/s') === false, 'data: doc must block ws');
  assert(isSubresourceAllowed('data:text/html,x', 'wss://evil.example/s') === false, 'data: doc must block wss');
  // http document - same-origin only (plus inline data:)
  assert(isSubresourceAllowed('http://app.local/p', 'http://app.local/style.css') === true, 'same-origin http allowed');
  assert(isSubresourceAllowed('http://app.local/p', 'http://evil.example/x.js') === false, 'cross-origin http blocked');
  assert(isSubresourceAllowed('http://app.local/p', 'data:font/woff2;base64,AAAA') === true, 'data: subresource allowed from http doc');
  assert(isSubresourceAllowed('http://app.local/p', 'wss://app.local/s') === false, 'wss blocked even same host (cross-protocol)');
  assert(isSubresourceAllowed('https://app.local/p', 'http://app.local/x') === false, 'http blocked from https doc (cross-origin)');
  // file document - same protocol only
  assert(isSubresourceAllowed('file:///a/index.html', 'file:///a/s.css') === true, 'same-protocol file allowed');
  assert(isSubresourceAllowed('file:///a/index.html', 'http://evil.example/x') === false, 'file doc blocks http');
  // garbage requested url is never allowed
  assert(isSubresourceAllowed('http://app.local/p', 'not a url') === false, 'unparseable requested url blocked');

  // --- real-browser completion (SKIP-aware): a page referencing a cross-origin image
  //     AND attempting a cross-origin websocket must still collect cleanly ---
  const html = `<!doctype html><body style="background:#ffffff;color:#111111">`
    + `<main><p style="line-height:20px">Hermetic</p>`
    + `<img src="http://blocked.invalid/track.png" width="10" height="10" alt=""></main>`
    + `<script>try{var w=new WebSocket('wss://blocked.invalid/socket');}catch(e){}</script></body>`;
  const r = await collectBrowserEvidence(`data:text/html,${encodeURIComponent(html)}`);
  if (!r.available) { console.log(`browser-evidence-hermeticity: SKIP (${r.reason})`); return; }
  if (Number(r.evidence.computedStyle['typography.checkedElements']) < 1) {
    throw new Error('collection must complete (degrade cleanly) despite blocked cross-origin subresources');
  }
  console.log('browser-evidence-hermeticity: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
