#!/usr/bin/env node
/**
 * MIGRATION HARNESS - routing golden fixtures (Stage 0, item 2).
 *
 * Stage 4 collapses the SIX+ routing implementations + the TRIPLICATED classifier
 * into ONE. Before that, the new single classifier must reproduce the CURRENT
 * classifier's decisions on the canonical routing input set (the COMPATIBILITY
 * CONTRACT). This tool snapshots current decisions (`capture`) and diffs the new
 * classifier against them (`verify`). TEMP harness - sunset at Stage 5.
 *
 * Input set = the shared parity corpus (sidecoach/parity/classifier-corpus.json) -
 * the canonical routing fixtures. Decision = {outcome, winningLane, verbMatch} from
 * the COMPILED current classifier (dist/lane-classifier.js) with the system's reg
 * (claude/hooks/sidecoach-lanes.json) + verbs (dist/verb-command-registry.js).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');          // improv repo root
const SIDECOACH = path.join(HERE, '..', '..');           // sidecoach/
const DIST = path.join(SIDECOACH, 'dist');
const REGISTRY = path.join(ROOT, 'claude', 'hooks', 'sidecoach-lanes.json');
const CORPUS = path.join(SIDECOACH, 'parity', 'classifier-corpus.json');
const GOLDEN = path.join(HERE, 'golden', 'routing', 'decisions.json');

async function loadCurrentClassifier() {
  const { loadRegistry, classifyIntent } = await import(path.join(DIST, 'lane-classifier.js'));
  const vr = await import(path.join(DIST, 'verb-command-registry.js'));
  const verbs = Object.keys(vr.VERB_REGISTRY || {});
  const reg = loadRegistry(REGISTRY);
  return function classify(c) {
    const d = classifyIntent(c.prompt, reg, verbs, { intentEligible: !!c.eligible });
    // FULL Decision (Codex MAJOR fold): the hook consumes laneScores (evidence) +
    // diagnosticLane (VERB behavior) + schemaVersion - a rewrite could pass on
    // outcome/winningLane while breaking those, so snapshot the whole Decision.
    return {
      prompt: c.prompt,
      outcome: d.outcome,
      winningLane: d.winningLane ?? null,
      verbMatch: d.verbMatch ?? null,
      diagnosticLane: d.diagnosticLane ?? null,
      laneScores: d.laneScores ?? [],
      schemaVersion: d.schemaVersion ?? null,
    };
  };
}

function corpusCases() {
  const c = JSON.parse(readFileSync(CORPUS, 'utf8'));
  return c.cases || c.fixtures || [];
}

async function capture() {
  const classify = await loadCurrentClassifier();
  const decisions = corpusCases().map(classify);
  mkdirSync(path.dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify(decisions, null, 2) + '\n');
  return decisions.length;
}

/** Diff `classify` (default = current classifier) against the captured golden. */
async function verify(classify) {
  classify = classify || await loadCurrentClassifier();
  if (!existsSync(GOLDEN)) return { ok: false, drift: ['no golden (run capture)'] };
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const drift = [];
  const cases = corpusCases();
  if (cases.length !== golden.length) drift.push(`case count ${cases.length} != golden ${golden.length}`);
  for (let i = 0; i < cases.length; i++) {
    const actual = JSON.stringify(classify(cases[i]));
    const g = JSON.stringify(golden[i]);
    if (actual !== g) drift.push(`"${cases[i].prompt.slice(0, 40)}": decision differs from golden`);
  }
  return { ok: drift.length === 0, drift };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  try {
    if (cmd === 'capture') { const n = await capture(); console.log(`captured ${n} routing decisions -> golden/routing/decisions.json`); }
    else if (cmd === 'verify') {
      const r = await verify();
      if (r.ok) { console.log(`routing goldens VERIFY OK (current == golden)`); process.exit(0); }
      console.error('routing goldens DRIFT:'); for (const d of r.drift) console.error(`  - ${d}`); process.exit(1);
    } else { console.error('usage: routing-snapshot.mjs <capture|verify>'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(2); }
}

export { loadCurrentClassifier, capture, verify, corpusCases };
