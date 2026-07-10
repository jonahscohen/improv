// Read-only stdio smoke test for beats-mcp.
// Spawns the built server, runs the JSON-RPC handshake, then calls each tool
// once (plus a path-traversal rejection). Sequences each request after the
// prior response so ordering is deterministic. Prints a transcript and exits
// non-zero if any expected check fails.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'dist', 'server.js');

const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });

let buf = '';
const waiters = new Map(); // id -> resolve
child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && waiters.has(msg.id)) {
      waiters.get(msg.id)(msg);
      waiters.delete(msg.id);
    }
  }
});

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}
function rpc(id, method, params) {
  return new Promise((resolve) => {
    waiters.set(id, resolve);
    send({ jsonrpc: '2.0', id, method, params });
  });
}

function show(label, msg) {
  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(msg, null, 2));
}
function toolText(msg) {
  return msg?.result?.content?.[0]?.text ?? '';
}

let failures = 0;
function check(cond, desc) {
  console.log(`CHECK ${cond ? 'PASS' : 'FAIL'}: ${desc}`);
  if (!cond) failures += 1;
}

async function main() {
  const init = await rpc(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'beats-smoke', version: '0.0.0' },
  });
  show('initialize', init);
  check(!!init.result?.serverInfo, 'initialize returned serverInfo');

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const list = await rpc(2, 'tools/list', {});
  show('tools/list', list);
  const names = (list.result?.tools ?? []).map((t) => t.name).sort();
  check(
    JSON.stringify(names) === JSON.stringify(['beats_get', 'beats_related', 'beats_search', 'beats_status']),
    `tools/list exposes the 4 read-only tools (got ${names.join(', ')})`,
  );

  const status = await rpc(3, 'tools/call', { name: 'beats_status', arguments: {} });
  show('beats_status', status);
  const statusText = toolText(status);
  check(/"status":\s*"(healthy|stale|broken)"/.test(statusText), 'beats_status reports a status');
  check(/"corpus_file_count":\s*\d+/.test(statusText), 'beats_status includes a corpus file count');

  const search = await rpc(4, 'tools/call', { name: 'beats_search', arguments: { query: 'codex review gate', top: 5 } });
  show('beats_search "codex review gate"', search);
  const searchText = toolText(search);
  let searchObj = {};
  try { searchObj = JSON.parse(searchText); } catch { /* leave empty */ }
  check(Array.isArray(searchObj.results) && searchObj.results.length > 0, 'beats_search returned real hits');

  const topFile = searchObj.results?.[0]?.filename;
  check(typeof topFile === 'string' && topFile.endsWith('.md'), `beats_search top hit is a .md filename (${topFile})`);

  const get = await rpc(5, 'tools/call', { name: 'beats_get', arguments: { file: topFile } });
  show(`beats_get ${topFile}`, get);
  const getText = toolText(get);
  check(!get.result?.isError && /"markdown":/.test(getText), 'beats_get returned markdown + frontmatter');

  // Use a `.md` traversal path so the containment guard (not the extension
  // check) is what rejects it - proves the path cannot escape the corpus dir.
  const evil = await rpc(6, 'tools/call', { name: 'beats_get', arguments: { file: '../secret.md' } });
  show('beats_get ../secret.md (must reject)', evil);
  check(evil.result?.isError === true && /traversal/.test(toolText(evil)), 'beats_get rejects a ../ traversal path via the containment guard');

  const related = await rpc(7, 'tools/call', { name: 'beats_related', arguments: { file: 'decision_behavioral_verifier_build_own.md' } });
  show('beats_related decision_behavioral_verifier_build_own.md', related);
  const relText = toolText(related);
  let relObj = {};
  try { relObj = JSON.parse(relText); } catch { /* leave empty */ }
  check(Array.isArray(relObj.relates_to) && relObj.relates_to.length > 0, 'beats_related resolved relates_to targets');
  check(relObj.relates_to?.every((r) => 'name' in r || 'missing' in r || 'invalid' in r), 'beats_related refs carry name/missing/invalid');

  console.log(`\n===== SUMMARY: ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} =====`);
  child.stdin.end();
  child.kill('SIGTERM');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke driver error:', err);
  child.kill('SIGKILL');
  process.exit(2);
});
