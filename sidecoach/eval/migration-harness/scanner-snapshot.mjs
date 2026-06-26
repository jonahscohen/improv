#!/usr/bin/env node
/**
 * MIGRATION HARNESS - scanner golden fixtures (Stage 0, item 2).
 *
 * Purpose (deletion discipline): Stage 2 deletes the scattered CURRENT detection
 * modules (taste-validator, absolute-ban-detector) and replaces them with the
 * OWNED unified scanner. Before that deletion, the new scanner must satisfy the
 * OLD modules' golden fixtures (the COMPATIBILITY CONTRACT). This tool snapshots
 * the current modules' findings (`capture`) and later diffs the new scanner
 * against them (`verify`). TEMP harness - sunset at Stage 5.
 *
 * The "current scanner" = validateTaste (idiom layer) + absolute-ban scanners,
 * normalized to {source, rule, severity, line}. This is the behavior the owned
 * scanner must reproduce (then exceed via the Contract-6 oracle eval + extension).
 *
 * Imports the COMPILED current engine from ../../dist (run `npm run build` first).
 * Modes: `capture` writes golden/scanner/<id>.json; `verify` re-runs + diffs (exit 1 on drift).
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUTS = path.join(HERE, 'inputs');
const GOLDEN = path.join(HERE, 'golden', 'scanner');
const DIST = path.join(HERE, '..', '..', 'dist');

async function loadCurrentScanner() {
  const taste = await import(path.join(DIST, 'taste-validator.js'));
  const ban = await import(path.join(DIST, 'absolute-ban-detector.js'));
  return function currentScanner(html, file) {
    const findings = [];
    // FULL normalized payload (Codex MAJOR fold): keep every user-visible/remediation
    // field so a rewrite cannot keep rule ids while dropping messages/excerpts/fixes.
    for (const v of taste.validateTaste(html)) {
      findings.push({ source: 'taste-validator', rule: v.ruleId, severity: v.severity, category: v.category ?? null, message: v.message ?? null, excerpt: v.excerpt ?? null, lineNumbers: v.lineNumbers ?? null });
    }
    const banScans = [ban.scanSideStripeBorders, ban.scanGradientText, ban.scanGlassmorphism, ban.scanIdenticalCardGrids, ban.scanHeroMetricTemplate, ban.scanModalAsFirstThought];
    for (const scan of banScans) {
      for (const b of scan(html, file)) findings.push({ source: 'absolute-ban', rule: b.banName, severity: b.severity, file: b.file ?? null, line: b.line ?? null, matchedText: b.matchedText ?? null, reason: b.reason ?? null, rewriteOptions: b.rewriteOptions ?? [] });
    }
    // Stable order so goldens are deterministic.
    return findings.sort((a, b) => (a.source + a.rule + (a.line ?? '')).localeCompare(b.source + b.rule + (b.line ?? '')));
  };
}

function inputFiles() {
  if (!existsSync(INPUTS)) return [];
  return readdirSync(INPUTS).filter((f) => /\.html?$/i.test(f)).sort();
}

async function capture() {
  const scanner = await loadCurrentScanner();
  mkdirSync(GOLDEN, { recursive: true });
  let n = 0;
  for (const f of inputFiles()) {
    const html = readFileSync(path.join(INPUTS, f), 'utf8');
    const findings = scanner(html, f);
    writeFileSync(path.join(GOLDEN, f.replace(/\.html?$/i, '.json')), JSON.stringify(findings, null, 2) + '\n');
    n++;
  }
  return n;
}

/** Diff `scanner` (default = current modules) against the captured goldens. */
async function verify(scanner) {
  scanner = scanner || await loadCurrentScanner();
  const drift = [];
  for (const f of inputFiles()) {
    const goldenPath = path.join(GOLDEN, f.replace(/\.html?$/i, '.json'));
    if (!existsSync(goldenPath)) { drift.push(`${f}: no golden (run capture)`); continue; }
    const html = readFileSync(path.join(INPUTS, f), 'utf8');
    const actual = JSON.stringify(scanner(html, f));
    const golden = JSON.stringify(JSON.parse(readFileSync(goldenPath, 'utf8')));
    if (actual !== golden) drift.push(`${f}: findings differ from golden`);
  }
  return { ok: drift.length === 0, drift };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  try {
    if (cmd === 'capture') { const n = await capture(); console.log(`captured ${n} scanner golden fixture(s) -> golden/scanner/`); }
    else if (cmd === 'verify') {
      const r = await verify();
      if (r.ok) { console.log(`scanner goldens VERIFY OK (${inputFiles().length} inputs, current == golden)`); process.exit(0); }
      console.error('scanner goldens DRIFT:'); for (const d of r.drift) console.error(`  - ${d}`); process.exit(1);
    } else { console.error('usage: scanner-snapshot.mjs <capture|verify>'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(2); }
}

export { loadCurrentScanner, capture, verify, inputFiles };
