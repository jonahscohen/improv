// sidecoach/eval/dev-corpus-disjoint.test.mjs
//
// HELD-OUT INTEGRITY (lead condition 1): the subjective DEV CORPUS must be provably DISJOINT from the frozen
// eval 90 - zero content-hash overlap AND zero provenance-host overlap. This is a committed TEST (fail-closed,
// exit 1 on any overlap), not a runtime assert, so developing detectors against the dev corpus can never be
// training on a held-out page. Reads the committed dev-manifest.json (content-sha + host per dev page) and the
// frozen candidates.json (recomputing the 90's content-shas from their .html), and asserts no intersection.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };

function run() {
  const manPath = path.join(CORPUS, 'dev-manifest.json');
  if (!existsSync(manPath)) { console.log('dev-corpus-disjoint: SKIP (no dev-manifest.json yet)'); return; }
  const dev = JSON.parse(readFileSync(manPath, 'utf8'));
  const evalManifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
  const evalShas = new Set(evalManifest.map((c) => sha256(readFileSync(path.join(CORPUS, c.file)))));
  const evalHosts = new Set(evalManifest.map((c) => hostOf((c.provenance && (c.provenance.source || c.provenance.url)) || '')).filter(Boolean));
  const overlaps = [];
  for (const p of (dev.pages || []).filter((x) => !x.failed)) {
    if (p.contentSha && evalShas.has(p.contentSha)) overlaps.push(`${p.id}: content-sha overlaps the eval 90`);
    if (p.host && evalHosts.has(p.host)) overlaps.push(`${p.id}: host ${p.host} overlaps the eval 90`);
  }
  if (overlaps.length) throw new Error(`dev-corpus NOT disjoint from the frozen 90:\n  ${overlaps.join('\n  ')}`);
  console.log(`dev-corpus-disjoint: OK (${(dev.pages || []).filter((x) => !x.failed).length} dev pages, zero content-sha/host overlap with the frozen 90)`);
}

run();
